document.addEventListener('DOMContentLoaded', function () {
    function getTrainers() {
        fetch(`${localStorage.getItem('urlBE')}/getTrainers`)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    console.error('Erro ao obter os dados dos treinadores:', data.error);
                } else {
                    const qtdRegistros = data.length;
                    const qtdDiferentes = getUniquePokemonCount(data);

                    document.getElementById('qtdRegistros').innerText = qtdRegistros;
                    document.getElementById('qtdDiferentes').innerText = qtdDiferentes;

                    populatePokemonTable(data);
                }
            })
            .catch(error => {
                console.error('Erro ao buscar os treinadores:', error);
            });
    }

    function getUniquePokemonCount(trainers) {
        const allPokemon = trainers.flatMap(trainer => {
            if (trainer.pokemonList && trainer.pokemonList.length > 0) {
                try {
                    return trainer.pokemonList;
                } catch (e) {
                    console.error('Erro ao processar pokemonList:', e);
                    return [];
                }
            } else {
                return [];
            }
        });
        const uniquePokemon = new Set(allPokemon);
        return uniquePokemon.size;
    }

    function populatePokemonTable(trainers) {
        const tableBody = document.getElementById('pokemonTableBody');
        tableBody.innerHTML = '';

        trainers.forEach(trainer => {
            const row = document.createElement('tr');

            const nameCell = document.createElement('td');
            nameCell.textContent = trainer.name;
            row.appendChild(nameCell);

            const emailCell = document.createElement('td');
            emailCell.textContent = trainer.email;
            row.appendChild(emailCell);

            const pokemonCell = document.createElement('td');
            pokemonCell.textContent = trainer.pokemonList.join(', ');
            row.appendChild(pokemonCell);

            tableBody.appendChild(row);
        });

        $('#pokemonTable').DataTable({
            responsive: true,
        });
    }

    getTrainers();
});
