document.addEventListener('DOMContentLoaded', function () {
    const urlBE = localStorage.getItem('urlBE')
    function getTrainers() {
        fetch(`${urlBE}/getTrainers`)
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

    async function deleteTrainer(idToDelete) {
        const url = `${urlBE}/deleteTrainers/${idToDelete}`;
        try {
          const response = await fetch(url, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
          });
      
          const result = await response.json();
      
          if (!response.ok) {
            console.error(`Erro ao deletar treinador(es) (Status: ${response.status}):`, result.error || result.message);
            throw new Error(result.error || result.message || 'Erro ao deletar treinador(es).');
          }
          return result;
      
        } catch (error) {
          console.error('Erro na requisição DELETE:', error);
          throw error;
        }
    }

    $('#resetarDados').on('click', (event) => {
        event.preventDefault();
    
        Swal.fire({
            title: 'Tem certeza?',
            text: 'Esta ação irá deletar todos os treinadores!',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sim, deletar!',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                deleteTrainer('all')
                    .then(data => {
                        Swal.fire({
                            icon: 'success',
                            title: 'Treinadores deletados',
                            text: data.message,
                        });
                    })
                    .catch(() => {
                        Swal.fire({
                            icon: 'error',
                            title: 'Erro',
                            text: 'Erro ao resetar lista de participantes, tente novamente mais tarde.',
                        });
                    });
            }
        });
    });
    

    getTrainers();
});
