$(document).ready(function () {
  let sprites;
  let allPokes = [];
  let pokemonArray = [];
  const urlBE = localStorage.getItem('urlBE');

  function getPrize(codigo) {
    return fetch(`${urlBE}/getPrizes?codigo=${codigo}`)
        .then(response => response.json())
        .then(data => {
          return data.length ? data[0] : null; // Retorna o prêmio, caso encontrado
        })
        .catch(error => {
          console.error('Erro ao buscar prêmio:', error);
          return null;
        });
  }


  function debounce(func, delay) {
    let timer;
    return function () {
      const context = this;
      const args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        func.apply(context, args);
      }, delay);
    };
  }


  fetch(`${urlBE}/getConfig`)
      .then(response => response.json())
      .then(async config => {
        if (config.error) {
          Swal.fire({
            icon: 'error',
            title: 'Erro ao carregar configurações',
            text: config.error,
          });
          return;
        }

        if (config.encerrado === 1) {
          window.location.href = 'encerradas.html';
        }

        let lendariosLiberados = config.listaLimitado || [];
        let lendariosBanidos = config.listaBanido || [];
        let gen = config.gen || 3;
        let qtdLimitado = config.qtdLimitado || 2;
        let qtdEscolha = config.qtdEscolha || 10;
        sprites = config.sprites || 'emerald';

        $('title').text(config.titulo);
        $('#title2').text(config.titulo2);
        $('#labelSelect').text(`Selecione até ${qtdEscolha} Pokémon`);

        let primeiraGen, segundaGen, terceiraGen, quartaGen;

        async function carregarGens() {
          try {
            const [gen1, gen2, gen3, gen4] = await Promise.all([
              fetch('assets/json/primeiraGen.json').then(response => response.json()),
              fetch('assets/json/segundaGen.json').then(response => response.json()),
              fetch('assets/json/terceiraGen.json').then(response => response.json()),
              fetch('assets/json/quartaGen.json').then(response => response.json()),
            ]);

            primeiraGen = gen1;
            segundaGen = gen2;
            terceiraGen = gen3;
            quartaGen = gen4;

            if (gen === 1) {
              allPokes = primeiraGen;
            } else if (gen === 2) {
              allPokes = primeiraGen.concat(segundaGen);
            } else if (gen === 3) {
              allPokes = primeiraGen.concat(segundaGen, terceiraGen);
            } else if (gen === 4) {
              allPokes = primeiraGen.concat(segundaGen, terceiraGen, quartaGen);
            } else {
              Swal.fire({
                icon: 'warning',
                title: 'Geração Inválida',
                text: 'A geração especificada não é válida. Usando todos os Pokémon por padrão.',
              });
              allPokes = primeiraGen.concat(segundaGen, terceiraGen);
            }

            pokemonArray = allPokes.filter(pokemon => !lendariosBanidos.includes(pokemon));

            pokemonArray.forEach(pokemon => {
              $('#pokemon-list').append(new Option(pokemon, pokemon));
            });

            $('#pokemon-list').select2({
              placeholder: 'Escolha seus Pokémon',
              allowClear: true,
            });
          } catch (error) {
            console.error('Erro ao carregar os arquivos JSON:', error);
          }
        }

        await carregarGens();

        function applyPrizePokemon(prize) {
          const pokemonList = prize.pokemonList || [];

          const filteredPokemonList = pokemonList.filter(pokemon =>
              allPokes.includes(pokemon)
          );
          filteredPokemonList.forEach(pokemon => {
            // Verifica se o Pokémon já está na lista de opções
            if ($('#pokemon-list').find(`option[value="${pokemon}"]`).length === 0) {
              $('#pokemon-list').append(new Option(pokemon, pokemon));
            }
          });

          // Atualiza o select2 com os novos Pokémon (não modificamos o pokemonArray aqui)
          $('#pokemon-list').trigger('change');
        }

        $('#codigo').on('input', debounce(function () {
          const codigo = $(this).val().trim();
          if (codigo) {
            getPrize(codigo).then(async prize => {
              if (prize) {
                applyPrizePokemon(prize);
                $('#codigo').prop('disabled', true);
              }
            });
          }
        }, 500));


        $('#pokemon-list').on('change', function () {
          const selectedOptions = $(this).val();
          const lendariosSelecionados = selectedOptions.filter(pokemon =>
              lendariosLiberados.includes(pokemon)
          );

          if (lendariosSelecionados.length > qtdLimitado) {
            Swal.fire({
              icon: 'warning',
              title: 'Limite de Lendários Excedido',
              text: `Você pode selecionar no máximo ${qtdLimitado} Pokémon lendários.`,
            });

            const removedOption = lendariosSelecionados.pop();
            const novaSelecao = selectedOptions.filter(pokemon => pokemon !== removedOption);
            $(this).val(novaSelecao).trigger('change');
            return;
          }

          if (selectedOptions.length > qtdEscolha) {
            Swal.fire({
              icon: 'warning',
              title: 'Limite Excedido',
              text: `Você pode selecionar no máximo ${qtdEscolha} Pokémon.`,
            });
            const removedOption = selectedOptions.pop();
            $(this).val(selectedOptions).trigger('change');
          }
        });
      })
      .catch(error => {
        Swal.fire({
          icon: 'error',
          title: 'Erro ao carregar dados',
          text: 'Não foi possível carregar as configurações do servidor.',
        });
        console.error('Erro ao buscar configurações:', error);
      });

  $('#simpleForm').on('submit', function (event) {
    event.preventDefault();

    const name = $('#name').val().trim();
    const email = $('#email').val().trim();
    const pokemonList = $('#pokemon-list').val();

    if (!name || !email || pokemonList.length === 0) {
      Swal.fire({
        icon: 'error',
        title: 'Campos Obrigatórios',
        text: 'Por favor, preencha todos os campos.',
      });
      return;
    }

    if (pokemonList.length !== 10) {
      Swal.fire({
        icon: 'error',
        title: 'Seleção Inválida',
        text: 'Você deve escolher exatamente 10 Pokémon para levar na sua jornada.',
      });
      return;
    }

    // Mostrar confirmação com os Pokémon escolhidos
    Swal.fire({
      icon: 'info',
      title: 'Confirmar Escolha',
      html: pokemonList
          .map(pokemon => {
            const pokemonIndex = allPokes.indexOf(pokemon) + 1;
            const spriteUrl = `https://veekun.com/dex/media/pokemon/main-sprites/${sprites}/${pokemonIndex}.png`;
            return `
            <div style="margin-bottom: 10px;">
              <p><strong>${pokemon}</strong></p>
              <img src="${spriteUrl}" alt="${pokemon}" style="width:100px; height:auto;">
            </div>
          `;
          })
          .join(''),
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
    }).then(result => {
      if (result.isConfirmed) {
        // Enviar dados após confirmação
        fetch(`${urlBE}/submit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: name,
            email: email,
            pokemonList: pokemonList,
          }),
        })
            .then(response => response.json())
            .then(data => {
              if (data.message) {
                Swal.fire({
                  icon: 'success',
                  title: 'Formulário Enviado',
                  text: data.message,
                });
                $('#name').val('');
                $('#email').val('');
                $('#pokemon-list').val([]).trigger('change');
              } else {
                Swal.fire({
                  icon: 'error',
                  title: 'Erro no Envio',
                  text: data.error || 'Algo deu errado. Tente novamente.',
                });
              }
            })
            .catch(error => {
              Swal.fire({
                icon: 'error',
                title: 'Erro de Conexão',
                text: 'Não foi possível conectar ao servidor. Tente novamente.',
              });
              console.error('Erro ao enviar os dados:', error);
            });
      }
    });
  });
});
