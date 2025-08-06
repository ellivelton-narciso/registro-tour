$(document).ready(function () {
  let sprites;
  let allPokes = [];
  let pokemonArray = [];
  const urlBE = localStorage.getItem('urlBE');
  let qtdEscolha;
  let allPokemonData = [];

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

        if (config.prizes === 0) {
          $('label[for="codigo"]').hide();
          $('#codigo').hide();
        }

        if (config.monotype === 0) {
          $('label[for="monotype-list"]').hide();
          $('#monotype-list').hide()
        } else {
          $('#monotype-list').select2({
            placeholder: 'Escolha seu tipo',
            allowClear: true,
            multiple: false,
          });
        }

        let pokemonsLimitados = config.listaLimitado || [];
        let lendariosLimitados = config.listaLimitadoLendario || [];
        let lendariosBanidos = config.listaBanido || [];
        let gen = config.gen || 3;
        let qtdLimitado = config.qtdLimitado || 2;
        let qtdLimitadoLendario = config. qtdLimitadoLendario || 2
        qtdEscolha = config.qtdEscolha || 10;
        sprites = config.sprites || 'emerald';

        $('title').text(config.titulo);
        $('#title2').text(config.titulo2);
        $('#labelSelect').text(`Selecione até ${qtdEscolha} Pokémon`);

        async function carregarGens() {
          let primeiraGen, segundaGen, terceiraGen, quartaGen, quintaGen;
          try {
            const [gen1, gen2, gen3, gen4, gen5] = await Promise.all([
              fetch('assets/json/primeiraGen.json').then(response => response.json()),
              fetch('assets/json/segundaGen.json').then(response => response.json()),
              fetch('assets/json/terceiraGen.json').then(response => response.json()),
              fetch('assets/json/quartaGen.json').then(response => response.json()),
              fetch('assets/json/quintaGen.json').then(response => response.json()),
            ]);

            primeiraGen = gen1;
            segundaGen = gen2;
            terceiraGen = gen3;
            quartaGen = gen4;
            quintaGen = gen5;

            if (gen === 1) {
              allPokemonData = primeiraGen;
            } else if (gen === 2) {
              allPokemonData = primeiraGen.concat(segundaGen);
            } else if (gen === 3) {
              allPokemonData = primeiraGen.concat(segundaGen, terceiraGen);
            } else if (gen === 4) {
              allPokemonData = primeiraGen.concat(segundaGen, terceiraGen, quartaGen);
            } else if (gen === 5) {
              allPokemonData = primeiraGen.concat(segundaGen, terceiraGen, quartaGen, quintaGen);
            } else {
              Swal.fire({
                icon: 'warning',
                title: 'Geração Inválida',
                text: 'A geração especificada não é válida. Usando todos os Pokémon por padrão.',
              });
              allPokemonData = primeiraGen.concat(segundaGen, terceiraGen, quartaGen, quintaGen);
            }

            processarPokemonData();

          } catch (error) {
            console.error('Erro ao carregar os arquivos JSON:', error);
          }
        }

        function processarPokemonData() {
          const pokemonPorId = {};

          const pokemonNaoBanidos = allPokemonData.filter(pokemon =>
              !lendariosBanidos.includes(pokemon.name)
          );

          pokemonNaoBanidos.forEach(pokemon => {
            const id = pokemon.id;
            if (!pokemonPorId[id]) {
              pokemonPorId[id] = [];
            }
            pokemonPorId[id].push(pokemon.name);
          });

          pokemonArray = [];
          allPokes = [];

          Object.values(pokemonPorId).forEach(grupo => {
            if (grupo.length > 1) {
              // Mais de uma forma, adicionar como array
              pokemonArray.push(grupo);
              allPokes.push(grupo);
            } else {
              // Apenas uma forma, adicionar como string
              pokemonArray.push(grupo[0]);
              allPokes.push(grupo[0]);
            }
          });

          pokemonArray.forEach(pokemon => {
            if (Array.isArray(pokemon)) {
              pokemon.forEach(forma => {
                $('#pokemon-list').append(new Option(forma, forma));
              });
            } else {
              $('#pokemon-list').append(new Option(pokemon, pokemon));
            }
          });

          $('#pokemon-list').select2({
            placeholder: 'Escolha seus Pokémon',
            allowClear: true,
          });

          const selectedType = $('#monotype-list').val();

          if (config.monotype === 1 && selectedType) {
            $('#pokemon-list').empty();

            const pokemonsFiltrados = allPokes.filter(pokemon => {
              const nome = Array.isArray(pokemon) ? pokemon[0] : pokemon;
              const data = encontrarPokemonPorNome(nome);
              return data && data.type.includes(selectedType);
            });

            pokemonsFiltrados.forEach(pokemon => {
              if (Array.isArray(pokemon)) {
                pokemon.forEach(forma => {
                  $('#pokemon-list').append(new Option(forma, forma));
                });
              } else {
                $('#pokemon-list').append(new Option(pokemon, pokemon));
              }
            });
          } else {
            pokemonArray.forEach(pokemon => {
              if (Array.isArray(pokemon)) {
                pokemon.forEach(forma => {
                  $('#pokemon-list').append(new Option(forma, forma));
                });
              } else {
                $('#pokemon-list').append(new Option(pokemon, pokemon));
              }
            });
          }

        }

        await carregarGens();

        function applyPrizePokemon(prize) {
          const pokemonList = prize.pokemonList || [];

          const filteredPokemonList = pokemonList.filter(pokemon => {
            return allPokemonData.some(p => p.name === pokemon);
          });

          filteredPokemonList.forEach(pokemon => {
            if ($('#pokemon-list').find(`option[value="${pokemon}"]`).length === 0) {
              $('#pokemon-list').append(new Option(pokemon, pokemon));
            }
          });

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
          const selectedOptions = $(this).val() || [];

          // Verifica se ultrapassou o limite de lendários
          const limitadosSelecionados = selectedOptions.filter(pokemon =>
              pokemonsLimitados.includes(pokemon)
          );

          if (limitadosSelecionados.length > qtdLimitado) {
            Swal.fire({
              icon: 'warning',
              title: 'Limite de Pokemons Limitados Excedido',
              text: `Você pode selecionar no máximo ${qtdLimitado} Pokémon limitados.`,
            });

            // Reverte para a seleção anterior
            const prevSelection = $(this).data('prevSelection') || [];
            $(this).val(prevSelection).trigger('change.select2');
            return;
          }

          const lendariosSelecionados = selectedOptions.filter(pokemon =>
            lendariosLimitados.includes(pokemon)
        );

        if (lendariosSelecionados.length > qtdLimitadoLendario) {
          Swal.fire({
            icon: 'warning',
            title: 'Limite de Lendários Excedido',
            text: `Você pode selecionar no máximo ${qtdLimitadoLendario} Pokémon lendários.`,
          });

          // Reverte para a seleção anterior
          const prevSelection = $(this).data('prevSelection') || [];
          $(this).val(prevSelection).trigger('change.select2');
          return;
        }

          // Verifica se ultrapassou o limite total de Pokémon
          if (selectedOptions.length > qtdEscolha) {
            Swal.fire({
              icon: 'warning',
              title: 'Limite Excedido',
              text: `Você pode selecionar no máximo ${qtdEscolha} Pokémon.`,
            });

            // Reverte para a seleção anterior
            const prevSelection = $(this).data('prevSelection') || [];
            $(this).val(prevSelection).trigger('change.select2');
            return;
          }

          // Atualiza a seleção anterior armazenada para a próxima alteração
          $(this).data('prevSelection', selectedOptions);
        });

        $('#monotype-list').on('change', function () {
          const selectedType = $(this).val();

          // Limpa a seleção atual de Pokémon
          $('#pokemon-list').val(null).trigger('change.select2');
          $('#pokemon-list').empty();

          if (!selectedType) {
            pokemonArray.forEach(pokemon => {
              if (Array.isArray(pokemon)) {
                pokemon.forEach(forma => {
                  $('#pokemon-list').append(new Option(forma, forma));
                });
              } else {
                $('#pokemon-list').append(new Option(pokemon, pokemon));
              }
            });

            return;
          }

          // Filtra os Pokémon com o tipo selecionado
          const pokemonsFiltrados = allPokes.filter(pokemon => {
            const nome = Array.isArray(pokemon) ? pokemon[0] : pokemon;
            const data = encontrarPokemonPorNome(nome);
            return data && data.type.includes(selectedType);
          });

          // Adiciona ao select apenas os Pokémon com o tipo escolhido
          pokemonsFiltrados.forEach(pokemon => {
            if (Array.isArray(pokemon)) {
              pokemon.forEach(forma => {
                $('#pokemon-list').append(new Option(forma, forma));
              });
            } else {
              $('#pokemon-list').append(new Option(pokemon, pokemon));
            }
          });
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

  // Função para encontrar dados de um Pokémon pelo nome
  function encontrarPokemonPorNome(nome) {
    return allPokemonData.find(pokemon => pokemon.name === nome);
  }

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

    if (pokemonList.length !== qtdEscolha) {
      Swal.fire({
        icon: 'error',
        title: 'Seleção Inválida',
        text: 'Você deve escolher exatamente '+qtdEscolha+' Pokémon para levar na sua jornada.',
      });
      return;
    }

    // Mostrar confirmação com os Pokémon escolhidos
    Swal.fire({
      icon: 'info',
      title: 'Confirmar Escolha',
      html: pokemonList
          .map(pokemonName => {
            const pokemonData = encontrarPokemonPorNome(pokemonName);
            if (!pokemonData) return '';

            const id = pokemonData.id;
            let spriteUrl;

            if (pokemonData.af) {
              spriteUrl = `https://veekun.com/dex/media/pokemon/main-sprites/black-white/${id}-${pokemonData.af}.png`;
            } else {
              spriteUrl = `https://veekun.com/dex/media/pokemon/main-sprites/black-white/${id}.png`;
            }

            return `
              <div style="margin-bottom: 10px;">
                <p><strong>${pokemonName}</strong></p>
                <img src="${spriteUrl}" alt="${pokemonName}" style="width:100px; height:auto;">
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