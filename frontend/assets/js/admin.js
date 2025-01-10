$(document).ready(function () {
    const apiUrl = 'https://api.registro.old-gen.com';
    let primeiraGen, segundaGen, terceiraGen, quartaGen, allPokes = [];
    const lendariosBanidos = [];

    $('#limitados-list, #ban-list').select2({
        placeholder: "Selecione os Pokémon",
        width: '100%'
    });

    async function carregarGens(gen) {
        try {
            // Carregar todas as gerações simultaneamente
            const [gen1, gen2, gen3, gen4] = await Promise.all([
                fetch('../assets/json/primeiraGen.json').then(response => response.json()),
                fetch('../assets/json/segundaGen.json').then(response => response.json()),
                fetch('../assets/json/terceiraGen.json').then(response => response.json()),
                fetch('../assets/json/quartaGen.json').then(response => response.json()),
            ]);

            primeiraGen = gen1;
            segundaGen = gen2;
            terceiraGen = gen3;
            quartaGen = gen4;

            // Determinar os Pokémon disponíveis com base na geração ativa
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
                allPokes = primeiraGen.concat(segundaGen, terceiraGen, quartaGen);
            }

            const pokemonArray = allPokes.filter(pokemon => !lendariosBanidos.includes(pokemon));

            $('#limitados-list').empty();
            pokemonArray.forEach(pokemon => {
                const option = new Option(pokemon, pokemon);
                $('#limitados-list').append(option);
            });
            $('#ban-list').empty();
            pokemonArray.forEach(pokemon => {
                const option = new Option(pokemon, pokemon);
                $('#ban-list').append(option);
            });


            $('#limitados-list').trigger('change');
            $('#ban-list').trigger('change');
        } catch (error) {
            console.error('Erro ao carregar os arquivos JSON:', error);
        }
    }

    function loadConfig() {
        $.ajax({
            url: `${apiUrl}/getConfig`,
            method: 'GET',
            dataType: 'json',
            success: async function (data) {
                $('#titulo').val(data.titulo || '');
                $('#titulo2').val(data.titulo2 || '');
                $('#generation').val(data.gen || '1').change();
                $('#game-sprites').val(data.sprites || 'red-green').change();
                $('#legendary-limit').val(data.qtdLimitado || 2);
                $('#webhook').val(data.hook || '');
                $('#notifications-enabled').prop('checked', data.enviarDiscord === 1);
                $('#panel-enabled').prop('checked', data.encerrado === 1);

                const gen = parseInt(data.gen || 1);
                await carregarGens(gen);

                // Preencher os valores selecionados para banidos e limitados
                $('#limitados-list').val(data.listaLimitado || []).trigger('change');
                $('#ban-list').val(data.listaBanido || []).trigger('change');
            },
            error: function () {
                Swal.fire({
                    icon: 'error',
                    title: 'Erro',
                    text: 'Não foi possível carregar as configurações. Tente novamente mais tarde.',
                });
            }
        });
    }

    // Atualizar lista ao mudar a geração
    $('#generation').on('change', function () {
        const selectedGen = parseInt($(this).val());
        carregarGens(selectedGen);
    });

    // Carregar configurações ao iniciar
    loadConfig();
});
