$(document).ready(async function () {
    let allPokes = [];
    const urlBE = localStorage.getItem('urlBE'); // URL do backend
    let premioTable;

    async function carregarGens() {
        try {
            const [gen1, gen2, gen3, gen4, gen5] = await Promise.all([
                fetch('../assets/json/primeiraGen.json').then(response => response.json()),
                fetch('../assets/json/segundaGen.json').then(response => response.json()),
                fetch('../assets/json/terceiraGen.json').then(response => response.json()),
                fetch('../assets/json/quartaGen.json').then(response => response.json()),
                fetch('../assets/json/quintaGen.json').then(response => response.json()),
            ]);

            allPokes = [...gen1, ...gen2, ...gen3, ...gen4, ...gen5];
        } catch (error) {
            console.error('Erro ao carregar os arquivos JSON:', error);
        }
    }

    function inicializarTabela() {
        premioTable = $('#premioTable').DataTable({
            columns: [
                { data: 'nome' },
                { data: 'codigo' },
                { data: 'pokemonList', render: data => data.join(', ') },
                {
                    data: 'id',
                    render: id => `
                        <button class="btn btn-warning btn-sm editPrize" data-id="${id}">Editar</button>
                    `,
                },
            ],
        });
    }

    async function carregarPrizes() {
        try {
            const response = await fetch(`${urlBE}/getPrizes`);
            const prizes = await response.json();

            premioTable.clear();
            premioTable.rows.add(prizes);
            premioTable.draw();
        } catch (error) {
            console.error('Erro ao carregar prêmios:', error);
        }
    }

    async function abrirModal(isEdit = false, prize = {}) {
        const { id = '', nome = '', codigo = '', pokemonList = [] } = prize;
        let pokemonNames = [];

        allPokes.forEach(pokemon => {
            if (typeof pokemon === 'object' && pokemon.name) {
                pokemonNames.push(pokemon.name);
            } else {
                pokemonNames.push(pokemon);
            }
        });

        const { value: formData } = await Swal.fire({
            title: isEdit ? 'Editar Prêmio' : 'Adicionar Prêmio',
            html: `
                <div class="mb-3">
                    <label for="swalParticipantName" class="form-label">Nome do Participante</label>
                    <input type="text" class="form-control" id="swalParticipantName" value="${nome}" required>
                </div>
                <div class="mb-3">
                    <label for="swalPrizeList" class="form-label">Selecione os prêmios para este código</label>
                    <select id="swalPrizeList" class="form-select" multiple required></select>
                </div>
                <div class="mb-3">
                    <label for="swalUniqueCode" class="form-label">Código Gerado</label>
                    <input type="text" class="form-control" id="swalUniqueCode" value="${codigo}" required>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: isEdit ? 'Salvar Alterações' : 'Adicionar',
            didOpen: () => {
                const select = $('#swalPrizeList');
                pokemonNames.forEach(name => {
                    select.append(new Option(name, name));
                });
                select.val(pokemonList).select2({
                    dropdownParent: Swal.getPopup(),
                    placeholder: 'Escolha os prêmios',
                    allowClear: true,
                });
            },
            preConfirm: () => {
                const nome = $('#swalParticipantName').val();
                const codigo = $('#swalUniqueCode').val();
                const pokemonList = $('#swalPrizeList').val();

                if (!nome || !codigo || !pokemonList.length) {
                    Swal.showValidationMessage('Preencha todos os campos.');
                    return null;
                }
                return { id, nome, codigo, pokemonList };
            },
        });

        if (formData) {
            await submitPrize(formData);
        }
    }

    async function submitPrize({ id, nome, codigo, pokemonList }) {
        try {
            const response = await fetch(`${urlBE}/submitPrizes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, nome, codigo, pokemonList }),
            });

            const result = await response.json();

            if (response.ok) {
                Swal.fire('Sucesso!', result.message || 'Prêmio salvo com sucesso!', 'success');
                carregarPrizes();
            } else {
                Swal.fire('Erro!', result.error || 'Erro ao salvar o prêmio.', 'error');
            }
        } catch (error) {
            console.error('Erro ao salvar o prêmio:', error);
        }
    }

    await carregarGens();
    inicializarTabela();
    await carregarPrizes();

    $('#premioTable').on('click', '.editPrize', async function () {
        const id = $(this).data('id');
        const response = await fetch(`${urlBE}/getPrizes`);
        const prizes = await response.json();
        const prize = prizes.find(p => p.id == id);
        abrirModal(true, prize);
    });

    $('#addPrizeButton').on('click', () => abrirModal());
});
