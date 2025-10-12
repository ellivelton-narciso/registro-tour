const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const pool = require('./db/connection');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.post('/submit', async (req, res) => {
  const { name, email, pokemonList, tournamentId } = req.body;
  if (!name || !pokemonList || !tournamentId) {
    return res.status(400).json({ error: 'Dados inválidos. Preencha todos os campos obrigatórios.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const playerResult = await client.query(
      'SELECT * FROM players WHERE name = $1',
      [name]
    );
    if (playerResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Jogador não cadastrado. Um admin precisa cadastrar antes.' });
    }
    const player = playerResult.rows[0];

    if (email && email !== player.email) {
      await client.query(
        'UPDATE players SET email = $1 WHERE id = $2',
        [email, player.id]
      );
    }

    const participantCheck = await client.query(
      'SELECT * FROM participants WHERE tournaments_id = $1 AND players_id = $2',
      [tournamentId, player.id]
    );
    if (participantCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Jogador já cadastrado neste torneio.' });
    }

    const participantInsert = await client.query(
      'INSERT INTO participants (tournaments_id, players_id) VALUES ($1, $2) RETURNING id',
      [tournamentId, player.id]
    );
    const participantId = participantInsert.rows[0].id;

    const pokemonsResult = await client.query(
      'SELECT id, name FROM pokemons WHERE name = ANY($1::text[])',
      [pokemonList]
    );
    if (pokemonsResult.rows.length !== pokemonList.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Um ou mais Pokémon não encontrados.' });
    }

    for (const poke of pokemonsResult.rows) {
      await client.query(
        'INSERT INTO choices (participants_id, pokemons_id, tournaments_id) VALUES ($1, $2, $3)',
        [participantId, poke.id, tournamentId]
      );
    }

    await client.query('COMMIT');

    return res.status(200).json({ message: 'Participante cadastrado com sucesso no torneio!' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return res.status(500).json({ error: 'Erro ao cadastrar participante no torneio.' });
  } finally {
    client.release();
  }
});


app.get('/getConfig', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM v_config LIMIT 1');
    if (result.rows.length === 0) return res.status(404).json({ error: 'Nenhuma configuração encontrada.' });

    const config = result.rows[0];
    config.listaLimitado = JSON.parse(config.listaLimitado || '[]');
    config.listaLimitadoLendario = JSON.parse(config.listaLimitadoLendario || '[]');
    config.listaBanido = JSON.parse(config.listaBanido || '[]');

    return res.status(200).json(config);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao processar dados da configuração.' });
  }
});


app.post('/createTournament', async (req, res) => {
  const {
    titulo,
    titulo2,
    gen,
    sprites,
    qtdLimitado,
    qtdLimitadoLendario,
    qtdEscolha,
    hook,
    enviarDiscord,
    listaLimitado,
    listaLimitadoLendario,
    listaBanido,
    encerrado,
    prizes,
    monotype
  } = req.body;

  // Validação básica
  if (!titulo || !gen || !sprites || !qtdLimitado) {
    return res.status(400).json({ error: 'Campos obrigatórios não preenchidos.' });
  }

  try {
    const query = `
      INSERT INTO tournaments (
        name,
        titulo2,
        gen,
        sprites,
        qtdEscolha,
        qtdLimitado,
        qtdLimitadoLendario,
        hook,
        enviarDiscord,
        listaLimitado,
        listaLimitadoLendario,
        listaBanido,
        encerrado,
        prizes,
        monotype
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
      )
      RETURNING id
    `;

    const values = [
      titulo,
      titulo2 || '',
      gen,
      sprites,
      qtdEscolha || null,
      qtdLimitado,
      qtdLimitadoLendario || null,
      hook || '',
      enviarDiscord || false,
      listaLimitado || [],
      listaLimitadoLendario || [],
      listaBanido || [],
      encerrado || false,
      prizes || false,
      monotype || false
    ];

    const result = await pool.query(query, values);

    const newTournamentId = result.rows[0].id;

    return res.status(201).json({
      message: 'Torneio criado com sucesso!',
      tournamentId: newTournamentId
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao criar o torneio.' });
  }
});


app.post('/updateConfig', async (req, res) => {
  const {
    tournamentId,
    titulo,
    titulo2,
    gen,
    sprites,
    qtdLimitado,
    qtdLimitadoLendario,
    qtdEscolha,
    hook,
    enviarDiscord,
    listaLimitado,
    listaLimitadoLendario,
    listaBanido,
    encerrado,
    prizes,
    monotype,
    dateEnd
  } = req.body;

  if (!tournamentId || !titulo || !gen || !sprites || !qtdLimitado) {
    return res.status(400).json({ error: 'Campos obrigatórios não preenchidos.' });
  }

  try {
    const query = `
      UPDATE tournaments SET
        name = $1,
        titulo2 = $2,
        gen = $3,
        sprites = $4,
        qtdEscolha = $5,
        qtdLimitado = $6,
        qtdLimitadoLendario = $7,
        hook = $8,
        enviarDiscord = $9,
        listaLimitado = $10,
        listaLimitadoLendario = $11,
        listaBanido = $12,
        encerrado = $13,
        prizes = $14,
        monotype = $15,
        dateEnd = COALESCE($16, dateEnd)
      WHERE id = $17
    `;

    const values = [
      titulo,
      titulo2 || '',
      gen,
      sprites,
      qtdEscolha || null,
      qtdLimitado,
      qtdLimitadoLendario || null,
      hook || '',
      enviarDiscord || false,
      listaLimitado || [],
      listaLimitadoLendario || [],
      listaBanido || [],
      encerrado || false,
      prizes || false,
      monotype || false,
      dateEnd || null,
      tournamentId
    ];

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Torneio não encontrado.' });
    }

    return res.status(200).json({ message: 'Configurações do torneio atualizadas com sucesso!' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao atualizar o torneio.' });
  }
});


app.post('/login', async (req, res) => {
  const { user, password } = req.body;
  if (!user || !password) return res.status(400).json({ error: 'Usuário e senha obrigatórios.' });

  try {
    const result = await pool.query('SELECT * FROM usuarios WHERE "user"=$1 LIMIT 1', [user]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Usuário incorreto.' });

    const storedPassword = result.rows[0].password;
    if (password === storedPassword) return res.status(200).json({ success: true });
    return res.status(401).json({ error: 'Senha incorreta.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao consultar usuário.' });
  }
});


app.get('/getTrainers', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM v_trainers ORDER BY player_id');
    const trainers = result.rows.map(trainer => {
      let pokemonList = [];

      if (Array.isArray(trainer.pokemon_list)) {
        pokemonList = trainer.pokemon_list;
      } else if (typeof trainer.pokemon_list === 'string') {
        try {
          pokemonList = JSON.parse(trainer.pokemon_list);
        } catch {
          pokemonList = trainer.pokemon_list.replace(/[{}]/g, '').split(',').filter(Boolean);
        }
      }

      return {
        id: trainer.player_id,
        name: trainer.name,
        email: trainer.email,
        tournamentId: trainer.tournament_id,
        tournamentName: trainer.tournament_name,
        pokemonList
      };
    });

    return res.status(200).json(trainers);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao consultar jogadores.' });
  }
});



app.delete('/deleteTrainers/:trainerId', async (req, res) => {
  const { trainerId } = req.params;
  const { tournamentsId } = req.body;

  try {
    if (!tournamentsId) {
      return res.status(400).json({ error: 'O campo tournamentsId é obrigatório.' });
    }

    if (trainerId === 'all') {
      const result = await pool.query(
        'DELETE FROM participants WHERE tournaments_id = $1',
        [tournamentsId]
      );
      return res.status(200).json({
        message: `${result.rowCount} participante(s) deletado(s) do torneio ${tournamentsId}.`
      });
    }

    const idNum = parseInt(trainerId, 10);
    if (isNaN(idNum)) {
      return res.status(400).json({ error: 'ID de treinador inválido.' });
    }

    const result = await pool.query(
      'DELETE FROM participants WHERE tournaments_id = $1 AND players_id = $2',
      [tournamentsId, idNum]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: `Treinador ${idNum} não encontrado no torneio ${tournamentsId}.`
      });
    }

    return res.status(200).json({
      message: `Treinador ${idNum} deletado com sucesso do torneio ${tournamentsId}.`
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao deletar participante.' });
  }
});


app.post('/submitPrizes', async (req, res) => {
  const { id, nome, codigo, playerId, pokemonList } = req.body;

  // validações iniciais
  if (!nome || !codigo || !Array.isArray(pokemonList) || pokemonList.length === 0)
    return res.status(400).json({ error: 'Campos obrigatórios faltando ou lista de Pokémon vazia.' });

  if (!playerId)
    return res.status(400).json({ error: 'playerId é obrigatório.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ✅ checa se o jogador existe
    const { rows: playerExists } = await client.query(
      'SELECT id FROM players WHERE id=$1',
      [playerId]
    );
    if (playerExists.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Jogador com ID ${playerId} não encontrado.` });
    }

    // valida se os IDs de pokémon existem no banco
    const pokeIds = pokemonList.map(p => p.id);
    const pokeQuery = `
      SELECT id, af FROM pokemons WHERE id = ANY($1)
    `;
    const { rows: existingPokemons } = await client.query(pokeQuery, [pokeIds]);

    // checa se todos foram encontrados
    const foundIds = existingPokemons.map(p => p.id);
    const missing = pokeIds.filter(id => !foundIds.includes(id));
    if (missing.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Pokémons não encontrados: ${missing.join(', ')}` });
    }

    let prizeId = id;

    if (id) {
      // update no prêmio existente
      const updateQuery = `
        UPDATE prizes_config
        SET nome=$1, codigo=$2, player_id=$3
        WHERE id=$4
        RETURNING id
      `;
      const result = await client.query(updateQuery, [nome, codigo, playerId, id]);
      if (result.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Prêmio não encontrado.' });
      }

      // apaga lista antiga antes de recriar
      await client.query('DELETE FROM prizes_list WHERE prizes_id=$1', [id]);
    } else {
      // cria novo prêmio
      const insertQuery = `
        INSERT INTO prizes_config (nome, codigo, player_id)
        VALUES ($1, $2, $3)
        RETURNING id
      `;
      const result = await client.query(insertQuery, [nome, codigo, playerId]);
      prizeId = result.rows[0].id;
    }

    // insere nova lista de pokémons vinculada ao prêmio
    for (const p of pokemonList) {
      const pk = existingPokemons.find(e => e.id === p.id);
      await client.query(
        `
          INSERT INTO prizes_list (prizes_id, pokemons_id, pokemons_af)
          VALUES ($1, $2, $3)
          ON CONFLICT (prizes_id, pokemons_id, pokemons_af) DO NOTHING
        `,
        [prizeId, p.id, p.af ?? pk.af ?? '']
      );
    }

    await client.query('COMMIT');

    return res.status(id ? 200 : 201).json({
      message: id ? 'Prêmio atualizado com sucesso!' : 'Prêmio criado com sucesso!',
      id: prizeId
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);

    if (err.code === '23505')
      return res.status(400).json({ error: 'Nome ou código já existe.' });

    return res.status(500).json({ error: 'Erro ao salvar prêmio.' });
  } finally {
    client.release();
  }
});



app.get('/getPrizes', async (req, res) => {
  const { codigo } = req.query;
  let query = 'SELECT * FROM v_prizes';
  let params = [];
  if (codigo) { query += ' WHERE prize_code=$1'; params.push(codigo); }

  try {
    const result = await pool.query(query, params);
    const prizes = result.rows.map(prize => ({
      id: prize.prize_id,
      nome: prize.prize_name,
      codigo: prize.prize_code,
    }));
    return res.status(200).json(prizes);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao consultar prêmios.' });
  }
});


const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Servidor rodando na porta ${port}`));
