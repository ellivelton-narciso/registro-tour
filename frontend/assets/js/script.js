$(document).ready(function () {
  // Lista de Pokémon
  const primeiraGen = [// Generation 1
    'Bulbasaur', 'Ivysaur', 'Venusaur',
    'Charmander', 'Charmeleon', 'Charizard',
    'Squirtle', 'Wartortle', 'Blastoise',
    'Caterpie', 'Metapod', 'Butterfree',
    'Weedle', 'Kakuna', 'Beedrill',
    'Pidgey', 'Pidgeotto', 'Pidgeot',
    'Rattata', 'Raticate',
    'Spearow', 'Fearow',
    'Ekans', 'Arbok',
    'Sandshrew', 'Sandslash',
    'Nidoran♀', 'Nidorina', 'Nidoqueen',
    'Nidoran♂', 'Nidorino', 'Nidoking',
    'Clefairy', 'Clefable',
    'Vulpix', 'Ninetales',
    'Jigglypuff', 'Wigglytuff',
    'Zubat', 'Golbat',
    'Oddish', 'Gloom', 'Vileplume',
    'Paras', 'Parasect',
    'Venonat', 'Venomoth',
    'Diglett', 'Dugtrio',
    'Meowth', 'Persian',
    'Psyduck', 'Golduck',
    'Mankey', 'Primeape',
    'Growlithe', 'Arcanine',
    'Poliwag', 'Poliwhirl', 'Poliwrath',
    'Abra', 'Kadabra', 'Alakazam',
    'Machop', 'Machoke', 'Machamp',
    'Bellsprout', 'Weepinbell', 'Victreebel',
    'Tentacool', 'Tentacruel',
    'Geodude', 'Graveler', 'Golem',
    'Ponyta', 'Rapidash',
    'Slowpoke', 'Slowbro',
    'Magnemite', 'Magneton',
    'Farfetch’d',
    'Doduo', 'Dodrio',
    'Seel', 'Dewgong',
    'Grimer', 'Muk',
    'Shellder', 'Cloyster',
    'Gastly', 'Haunter', 'Gengar',
    'Onix',
    'Drowzee', 'Hypno',
    'Krabby', 'Kingler',
    'Voltorb', 'Electrode',
    'Exeggcute', 'Exeggutor',
    'Cubone', 'Marowak',
    'Hitmonlee', 'Hitmonchan',
    'Lickitung',
    'Koffing', 'Weezing',
    'Rhyhorn', 'Rhydon',
    'Chansey',
    'Tangela',
    'Kangaskhan',
    'Horsea', 'Seadra',
    'Goldeen', 'Seaking',
    'Staryu', 'Starmie',
    'Mr. Mime',
    'Scyther',
    'Jynx',
    'Electabuzz',
    'Magmar',
    'Pinsir',
    'Tauros',
    'Magikarp', 'Gyarados',
    'Lapras',
    'Ditto',
    'Eevee', 'Vaporeon', 'Jolteon', 'Flareon',
    'Porygon',
    'Omanyte', 'Omastar',
    'Kabuto', 'Kabutops',
    'Aerodactyl',
    'Snorlax',
    'Dratini', 'Dragonair', 'Dragonite'
  ];
  const segundaGen = [// Generation 2
    'Chikorita', 'Bayleef', 'Meganium',
    'Cyndaquil', 'Quilava', 'Typhlosion',
    'Totodile', 'Croconaw', 'Feraligatr',
    'Sentret', 'Furret',
    'Hoothoot', 'Noctowl',
    'Ledyba', 'Ledian',
    'Spinarak', 'Ariados',
    'Crobat',
    'Chinchou', 'Lanturn',
    'Pichu', 'Cleffa', 'Igglybuff',
    'Togepi', 'Togetic',
    'Natu', 'Xatu',
    'Mareep', 'Flaaffy', 'Ampharos',
    'Bellossom',
    'Marill', 'Azumarill',
    'Sudowoodo',
    'Politoed',
    'Hoppip', 'Skiploom', 'Jumpluff',
    'Aipom',
    'Sunkern', 'Sunflora',
    'Yanma',
    'Wooper', 'Quagsire',
    'Espeon', 'Umbreon',
    'Murkrow',
    'Slowking',
    'Misdreavus',
    'Unown',
    'Wobbuffet',
    'Girafarig',
    'Pineco', 'Forretress',
    'Dunsparce',
    'Gligar',
    'Steelix',
    'Snubbull', 'Granbull',
    'Qwilfish',
    'Scizor',
    'Shuckle',
    'Heracross',
    'Sneasel',
    'Teddiursa', 'Ursaring',
    'Slugma', 'Magcargo',
    'Swinub', 'Piloswine',
    'Corsola',
    'Remoraid', 'Octillery',
    'Delibird',
    'Mantine',
    'Skarmory',
    'Houndour', 'Houndoom',
    'Kingdra',
    'Phanpy', 'Donphan',
    'Porygon2',
    'Stantler',
    'Smeargle',
    'Tyrogue', 'Hitmontop',
    'Smoochum', 'Elekid', 'Magby',
    'Miltank',
    'Blissey',
    'Larvitar', 'Pupitar', 'Tyranitar'
  ];
  const terceiraGen = [// Generation 3
    'Treecko', 'Grovyle', 'Sceptile',
    'Torchic', 'Combusken', 'Blaziken',
    'Mudkip', 'Marshtomp', 'Swampert',
    'Poochyena', 'Mightyena',
    'Zigzagoon', 'Linoone',
    'Wurmple', 'Silcoon', 'Beautifly',
    'Cascoon', 'Dustox',
    'Lotad', 'Lombre', 'Ludicolo',
    'Seedot', 'Nuzleaf', 'Shiftry',
    'Taillow', 'Swellow',
    'Wingull', 'Pelipper',
    'Ralts', 'Kirlia', 'Gardevoir',
    'Surskit', 'Masquerain',
    'Shroomish', 'Breloom',
    'Slakoth', 'Vigoroth', 'Slaking',
    'Nincada', 'Ninjask', 'Shedinja',
    'Whismur', 'Loudred', 'Exploud',
    'Makuhita', 'Hariyama',
    'Azurill',
    'Nosepass',
    'Skitty', 'Delcatty',
    'Sableye',
    'Mawile',
    'Aron', 'Lairon', 'Aggron',
    'Meditite', 'Medicham',
    'Electrike', 'Manectric',
    'Plusle', 'Minun',
    'Volbeat', 'Illumise',
    'Roselia',
    'Gulpin', 'Swalot',
    'Carvanha', 'Sharpedo',
    'Wailmer', 'Wailord',
    'Numel', 'Camerupt',
    'Torkoal',
    'Spoink', 'Grumpig',
    'Spinda',
    'Trapinch', 'Vibrava', 'Flygon',
    'Cacnea', 'Cacturne',
    'Swablu', 'Altaria',
    'Zangoose', 'Seviper',
    'Lunatone', 'Solrock',
    'Barboach', 'Whiscash',
    'Corphish', 'Crawdaunt',
    'Baltoy', 'Claydol',
    'Lileep', 'Cradily',
    'Anorith', 'Armaldo',
    'Feebas', 'Milotic',
    'Castform',
    'Kecleon',
    'Shuppet', 'Banette',
    'Duskull', 'Dusclops',
    'Tropius',
    'Chimecho',
    'Absol',
    'Wynaut',
    'Snorunt', 'Glalie',
    'Spheal', 'Sealeo', 'Walrein',
    'Clamperl', 'Huntail', 'Gorebyss',
    'Relicanth',
    'Luvdisc',
    'Bagon', 'Shelgon', 'Salamence',
    'Beldum', 'Metang', 'Metagross'
  ];
  const quartaGen = [
    'Turtwig', 'Grotle', 'Torterra',
    'Chimchar', 'Monferno', 'Infernape',
    'Piplup', 'Prinplup', 'Empoleon',
    'Starly', 'Staravia', 'Staraptor',
    'Bidoof', 'Bibarel',
    'Kricketot', 'Kricketune',
    'Shinx', 'Luxio', 'Luxray',
    'Budew', 'Roserade',
    'Cranidos', 'Rampardos',
    'Shieldon', 'Bastiodon',
    'Burmy', 'Wormadam', 'Mothim',
    'Combee', 'Vespiquen',
    'Pachirisu',
    'Buizel', 'Floatzel',
    'Cherubi', 'Cherrim',
    'Shellos', 'Gastrodon',
    'Ambipom',
    'Drifloon', 'Drifblim',
    'Buneary', 'Lopunny',
    'Mismagius',
    'Honchkrow',
    'Glameow', 'Purugly',
    'Chingling',
    'Stunky', 'Skuntank',
    'Bronzor', 'Bronzong',
    'Bonsly',
    'Mime Jr.',
    'Happiny',
    'Chatot',
    'Spiritomb',
    'Gible', 'Gabite', 'Garchomp',
    'Munchlax',
    'Riolu', 'Lucario',
    'Hippopotas', 'Hippowdon',
    'Skorupi', 'Drapion',
    'Croagunk', 'Toxicroak',
    'Carnivine',
    'Finneon', 'Lumineon',
    'Mantyke',
    'Snover', 'Abomasnow',
    'Weavile',
    'Magnezone',
    'Lickilicky',
    'Rhyperior',
    'Tangrowth',
    'Electivire',
    'Magmortar',
    'Togekiss',
    'Yanmega',
    'Leafeon',
    'Glaceon',
    'Gliscor',
    'Mamoswine',
    'Porygon-Z',
    'Gallade',
    'Probopass',
    'Dusknoir',
    'Froslass',
    'Rotom'
  ];
  const lendariosLiberados = [
    'Moltres', 'Zapdos', 'Articuno',
    'Entei', 'Suicune', 'Raikou',
    'Regirock', 'Regice', 'Registeel',
    'Uxie', 'Mesprit', 'Azelf'
  ]

  const pokemonArray  = primeiraGen.concat(segundaGen, terceiraGen, quartaGen, lendariosLiberados);

  pokemonArray.forEach(pokemon => {
    $('#pokemon-list').append(new Option(pokemon, pokemon));
  });

  $('#pokemon-list').select2({
    placeholder: 'Escolha seus Pokémon',
    allowClear: true,
  });

  $('#pokemon-list').on('change', function () {
    const selectedOptions = $(this).val();
    const lendariosSelecionados = selectedOptions.filter(pokemon =>
        lendariosLiberados.includes(pokemon)
    );

    if (lendariosSelecionados.length > 2) {
      Swal.fire({
        icon: 'warning',
        title: 'Limite de Lendários Excedido',
        text: 'Você pode selecionar no máximo 2 Pokémon lendários.',
      });

      // Remove o último lendário selecionado
      const removedOption = lendariosSelecionados.pop();
      const novaSelecao = selectedOptions.filter(pokemon => pokemon !== removedOption);
      $(this).val(novaSelecao).trigger('change');
      return;
    }


    if (selectedOptions.length > 10) {
      Swal.fire({
        icon: 'warning',
        title: 'Limite Excedido',
        text: 'Você pode selecionar no máximo 10 Pokémon.',
      });
      const removedOption = selectedOptions.pop();
      $(this).val(selectedOptions).trigger('change');
    }
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
          .map(
              pokemon => `
        <div style="margin-bottom: 10px;">
          <p><strong>${pokemon}</strong></p>
          <img src="../images/${pokemon.toLowerCase()}.gif" alt="${pokemon}" style="width:100px; height:auto;">
        </div>
      `
          )
          .join(''),
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'Cancelar',
    }).then(result => {
      if (result.isConfirmed) {
        // Enviar dados após confirmação
        fetch('https://localhost:3000/submit', {
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
