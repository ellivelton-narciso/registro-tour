$(document).ready(function () {
  let allPokemonData = [];
  let allPokes = [];
  let pokemonArray = [];
  let sprites;
  let qtdEscolha;
  let tournamentId;
  const urlBE = localStorage.getItem('urlBE');

  function debounce(func, delay) {
    let timer;
    return function () {
      const context = this;
      const args = arguments;
      clearTimeout(timer);
      timer = setTimeout(() => func.apply(context, args), delay);
    };
  }

  function encontrarPokemonPorNome(nome) {
    return allPokemonData.find(pokemon => pokemon.name === nome);
  }

  function getPrize(codigo) {
    return fetch(`${urlBE}/getPrizes?codigo=${codigo}`)
      .then(res => res.json())
      .then(data => data.length ? data[0] : null)
      .catch(err => {
        console.error('Erro ao buscar prêmio:', err);
        return null;
      });
  }

  function applyPrizePokemon(prize) {
    const pokemonList = prize.pokemonList || [];
    const filteredPokemonList = pokemonList.filter(p =>
      allPokemonData.some(ap => ap.name === p)
    );

    filteredPokemonList.forEach(pokemon => {
      if ($('#pokemon-list').find(`option[value="${pokemon}"]`).length === 0) {
        $('#pokemon-list').append(new Option(pokemon, pokemon));
      }
    });
    $('#pokemon-list').trigger('change');
  }

  async function carregarPokemons(gen) {
    try {
      const gens = [];
      for (let g = 1; g <= gen; g++) {
        gens.push(fetch(`${urlBE}/pokemons?gen=${g}`).then(res => res.json()));
      }

      const resultados = await Promise.all(gens);
      allPokemonData = resultados.flat();
      processarPokemonData();
    } catch (error) {
      console.error('Erro ao buscar pokemons: ', error);
    }
  }


  function processarPokemonData() {
    const porId = {};
    allPokemonData.forEach(p => {
      if (!porId[p.id]) porId[p.id] = [];
      porId[p.id].push(p);
    });

    allPokes = [];
    pokemonArray = [];

    Object.values(porId).forEach(grupo => {
      if (grupo.length > 1) {
        pokemonArray.push(grupo);
        allPokes.push(grupo);
      } else {
        pokemonArray.push(grupo[0]);
        allPokes.push(grupo[0]);
      }
    });

    renderPokemonList();
  }

  function renderPokemonList(selectedType = null) {
    $('#pokemon-list').empty();

    const bannedList = window.config?.listabanido?.map(p => p.toLowerCase()) || [];

    allPokes.forEach(p => {
      if (Array.isArray(p)) {
        const formasFiltradas = p.filter(pd => {
          if (!pd.name) return false;
          if (bannedList.includes(pd.name.toLowerCase())) return false;
          if (!selectedType) return true;
          return pd.type && pd.type.includes(selectedType);
        });

        formasFiltradas.forEach(pd => {
          $('#pokemon-list').append(new Option(pd.name, pd.name));
        });

      } else {
        if (!p.name) return;
        if (bannedList.includes(p.name.toLowerCase())) return;
        if (selectedType && (!p.type || !p.type.includes(selectedType))) return;

        $('#pokemon-list').append(new Option(p.name, p.name));
      }
    });

    $('#pokemon-list').select2({
      placeholder: 'Escolha seus Pokémon',
      allowClear: true
    });
  }



  fetch(`${urlBE}/getConfig`)
  .then(res => res.json())
  .then(async config => {
    if (config.error) {
      Swal.fire({ icon: 'error', title: 'Erro ao carregar configurações', text: config.error });
      return;
    }
    
    if (config.encerrado) window.location.href = 'encerradas.html';
    window.config = config;
    if (!config.prizes) {
      $('label[for="codigo"]').hide();
      $('#codigo').hide();
    }

    if (!config.monotype) {
      $('label[for="monotype-list"]').hide();
      $('#monotype-list').hide();
    } else {
      $('#monotype-list').select2({ placeholder: 'Escolha seu tipo', multiple: false });
    }

    tournamentId = config.id;
    sprites = config.sprites ?? 'emerald';
    qtdEscolha = config.qtdescolha ?? 10;

    $('title').text(config.titulo);
    $('#title2').text(config.titulo2);
    $('#labelSelect').text(`Selecione até ${qtdEscolha} Pokémon`);

    await carregarPokemons(config.gen ?? 3);

    $('#codigo').on('input', debounce(function () {
      const codigo = $(this).val().trim();
      if (codigo) {
        getPrize(codigo).then(prize => {
          if (prize) {
            applyPrizePokemon(prize);
            $('#codigo').prop('disabled', true);
          }
        });
      }
    }, 500));

    $('#pokemon-list').on('change', function () {
      const selected = $(this).val() || [];
      const pokemonsLimitados = config.listalimitado || [];
      const lendariosLimitados = config.listalimitadolendario || [];

      if (selected.filter(p => pokemonsLimitados.includes(p)).length > (config.qtdlimitado ?? 0)) {
        Swal.fire({ icon: 'warning', title: 'Limite de Pokemons Limitados Excedido', text: `Você pode selecionar no máximo ${config.qtdlimitado ?? 0} Pokémon limitados.` });
        $(this).val($(this).data('prevSelection')).trigger('change.select2');
        return;
      }

      if (selected.filter(p => lendariosLimitados.includes(p)).length > (config.qtdlimitadolendario ?? 0)) {
        Swal.fire({ icon: 'warning', title: 'Limite de Lendários Excedido', text: `Você pode selecionar no máximo ${config.qtdlimitadolendario ?? 0} Pokémon lendários.` });
        $(this).val($(this).data('prevSelection')).trigger('change.select2');
        return;
      }

      if (selected.length > qtdEscolha) {
        Swal.fire({ icon: 'warning', title: 'Limite Excedido', text: `Você pode selecionar no máximo ${qtdEscolha} Pokémon.` });
        $(this).val($(this).data('prevSelection')).trigger('change.select2');
        return;
      }

      $(this).data('prevSelection', selected);
    });

    $('#monotype-list').on('change', function () {
      const tipo = $(this).val();
      renderPokemonList(tipo);
    });

    const tipoSelecionado = config.monotype ? $('#monotype-list').val() : null;
    renderPokemonList(tipoSelecionado);
  })
  .catch(err => {
    Swal.fire({ icon: 'error', title: 'Erro de Conexão', text: 'Não foi possível carregar as configurações do servidor.' });
    console.error(err);
  });


$('#simpleForm').on('submit', function (event) {
  event.preventDefault();
  const name = $('#name').val().trim();
  const email = $('#email').val().trim();
  const pokemonList = $('#pokemon-list').val();

  if (!name || !email || !pokemonList.length) {
    Swal.fire({ icon: 'error', title: 'Campos Obrigatórios', text: 'Preencha todos os campos.' });
    return;
  }

  if (pokemonList.length !== qtdEscolha) {
    Swal.fire({ icon: 'error', title: 'Seleção Inválida', text: `Escolha exatamente ${qtdEscolha} Pokémon.` });
    return;
  }

  Swal.fire({
    icon: 'info',
    title: 'Confirmar Escolha',
    html: pokemonList.map(nome => {
      const data = encontrarPokemonPorNome(nome);
      if (!data) return '';
      const spriteUrl = data.af
        ? `https://veekun.com/dex/media/pokemon/main-sprites/${sprites}/${data.id}-${data.af}.png`
        : `https://veekun.com/dex/media/pokemon/main-sprites/${sprites}/${data.id}.png`;
      return `<div style="margin-bottom:10px;"><p><strong>${nome}</strong></p><img src="${spriteUrl}" style="width:100px;"></div>`;
    }).join(''),
    showCancelButton: true,
    confirmButtonText: 'Confirmar',
    cancelButtonText: 'Cancelar'
  }).then(result => {
    if (result.isConfirmed) {
      const pokemonPayload = pokemonList.map(nome => {
        const p = encontrarPokemonPorNome(nome);
        return { id: p.id, af: p.af || '' };
      });

      fetch(`${urlBE}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId, name, email, pokemonList: pokemonPayload })
      })
        .then(res => res.json())
        .then(data => {
          if (data.message) {
            Swal.fire({ icon: 'success', title: 'Formulário Enviado', text: data.message });
            $('#name').val(''); $('#email').val(''); $('#pokemon-list').val([]).trigger('change');
          } else {
            Swal.fire({ icon: 'error', title: 'Erro no Envio', text: data.error || 'Algo deu errado.' });
          }
        })
        .catch(err => {
          Swal.fire({ icon: 'error', title: 'Erro de Conexão', text: 'Não foi possível conectar ao servidor.' });
          console.error(err);
        });
    }
  });
});
});
