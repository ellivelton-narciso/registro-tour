$(document).ready(function () {

    const apiUrl = localStorage.getItem('urlBE');
    let primeiraGen, segundaGen, terceiraGen, quartaGen, quintaGen, allPokes = [];
    const lendariosBanidos = [];

    $('#limitados-list, #ban-list').select2({
        placeholder: "Selecione os Pokémon",
        width: '100%'
    });

    async function carregarGens(gen) {
        try {
            // Carregar todas as gerações simultaneamente
            const [gen1, gen2, gen3, gen4, gen5] = await Promise.all([
                fetch('../assets/json/primeiraGen.json').then(response => response.json()),
                fetch('../assets/json/segundaGen.json').then(response => response.json()),
                fetch('../assets/json/terceiraGen.json').then(response => response.json()),
                fetch('../assets/json/quartaGen.json').then(response => response.json()),
                fetch('../assets/json/quintaGen.json').then(response => response.json()),
            ]);

            primeiraGen = gen1;
            segundaGen = gen2;
            terceiraGen = gen3;
            quartaGen = gen4;
            quintaGen = gen5;

            if (gen === 1) {
                allPokes = primeiraGen;
            } else if (gen === 2) {
                allPokes = primeiraGen.concat(segundaGen);
            } else if (gen === 3) {
                allPokes = primeiraGen.concat(segundaGen, terceiraGen);
            } else if (gen === 4) {
                allPokes = primeiraGen.concat(segundaGen, terceiraGen, quartaGen);
            } else if (gen === 5) {
                allPokes = primeiraGen.concat(segundaGen, terceiraGen, quartaGen, quintaGen);
            } else {
                Swal.fire({
                    icon: 'warning',
                    title: 'Geração Inválida',
                    text: 'A geração especificada não é válida. Usando todos os Pokémon por padrão.',
                });
                allPokes = primeiraGen.concat(segundaGen, terceiraGen, quartaGen, quintaGen);
            }

            // Extrair os nomes dos Pokémon
            let pokemonNames = [];

            allPokes.forEach(pokemon => {
                // Se for um objeto com name, extrair o name
                if (typeof pokemon === 'object' && pokemon.name) {
                    pokemonNames.push(pokemon.name);
                } else {
                    pokemonNames.push(pokemon);
                }
            });

            pokemonNames = pokemonNames.filter(name => !lendariosBanidos.includes(name));

            // Limpar e preencher os selects
            $('#limitados-list').empty();
            $('#ban-list').empty();

            pokemonNames.forEach(name => {
                $('#limitados-list').append(new Option(name, name));
                $('#ban-list').append(new Option(name, name));
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
                $('#prizes-enabled').prop('checked', data.prizes === 1);
                $('#panel-enabled').prop('checked', data.encerrado === 0);
                $('#escolha-limit').val(data.qtdEscolha || 10);

                const gen = parseInt(data.gen || 1);
                await carregarGens(gen);

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

    $('#submitConfig').on('click', function (event) {
        event.preventDefault();
        const titulo = $('#titulo').val();
        const titulo2 = $('#titulo2').val();
        const gen = $('#generation').val();
        const sprites = $('#game-sprites').val();
        const qtdLimitado = $('#legendary-limit').val();
        const hook = $('#webhook').val();
        const enviarDiscord = $('#notifications-enabled').prop('checked') ? 1 : 0;
        const prizes = $('#prizes-enabled').prop('checked') ? 1 : 0;
        const encerrado = $('#panel-enabled').prop('checked') ? 0 : 1;
        const listaLimitado = $('#limitados-list').val() || [];
        const listaBanido = $('#ban-list').val() || [];
        const qtdEscolha = $('#escolha-limit').val();

        $.ajax({
            url: `${apiUrl}/updateConfig`,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                titulo,
                titulo2,
                gen,
                sprites,
                qtdLimitado,
                hook,
                enviarDiscord,
                encerrado,
                listaLimitado,
                listaBanido,
                qtdEscolha,
                prizes
            }),
            success: function () {
                Swal.fire({
                    icon: 'success',
                    title: 'Configuração Atualizada',
                    text: 'As configurações foram atualizadas com sucesso.',
                });
            },
            error: function () {
                Swal.fire({
                    icon: 'error',
                    title: 'Erro',
                    text: 'Não foi possível atualizar as configurações. Tente novamente mais tarde.',
                });
            }
        });
    });

    loadConfig();
});