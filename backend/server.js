const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const pool = require('./db/connection');
const auth = require('./authMiddleware');
const cupKnockout = require('./cupKnockout');
const cupSwiss = require('./cupSwiss');
const tournamentFees = require('./tournamentFees');
const { upload, getTeamImagesDir, isChampionsGen, resolveTeamImagePath } = require('./championsUpload');
const { sendChampionsTeamsToDiscord } = require('./championsDiscord');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use('/team-images', express.static(getTeamImagesDir()));

app.post('/upload-team-image', upload.single('teamImage'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhuma imagem enviada.' });
  }
  return res.status(200).json({
    filename: req.file.filename,
    url: `/team-images/${req.file.filename}`
  });
});

app.post('/submit', async (req, res) => {
  const { name, email, pokemonList, tournamentId, teamImage } = req.body;
  if (!name || !tournamentId) {
    return res.status(400).json({ error: 'Dados inválidos. Preencha todos os campos obrigatórios.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tournamentResult = await client.query(
      'SELECT id, gen, paymentregister FROM tournaments WHERE id = $1',
      [tournamentId]
    );
    if (tournamentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Torneio não encontrado.' });
    }
    const tournament = tournamentResult.rows[0];
    const championsMode = isChampionsGen(tournament.gen);

    if (championsMode) {
      if (!teamImage || !resolveTeamImagePath(teamImage)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Envie um print do seu time antes de confirmar a inscrição.' });
      }
    } else if (!pokemonList || !pokemonList.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Dados inválidos. Preencha todos os campos obrigatórios.' });
    }

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

    const baseFee = tournament.paymentregister ?? tournament.paymentRegister ?? 0;

    const feeInfo = await tournamentFees.resolveRegistrationFee(
      client,
      tournamentId,
      player.id,
      baseFee
    );

    if (player.coins < feeInfo.fee) {
      await client.query('ROLLBACK');
      const extra = feeInfo.doubled
        ? ` Taxa dobrada (${feeInfo.woCount} W.O. no torneio anterior).`
        : '';
      return res.status(400).json({
        error: `Saldo insuficiente. Inscrição: ${feeInfo.fee} coins.${extra}`
      });
    }

    await client.query(
      'UPDATE players SET coins = coins - $1 WHERE id = $2',
      [feeInfo.fee, player.id]
    );

    const participantInsert = await client.query(
      championsMode
        ? 'INSERT INTO participants (tournaments_id, players_id, team_image) VALUES ($1, $2, $3) RETURNING id'
        : 'INSERT INTO participants (tournaments_id, players_id) VALUES ($1, $2) RETURNING id',
      championsMode ? [tournamentId, player.id, path.basename(teamImage)] : [tournamentId, player.id]
    );
    const participantId = participantInsert.rows[0].id;

    if (!championsMode) {
      const values = [];
      const conditions = pokemonList.map((p) => {
        values.push(p.id, p.af);
        return `($${values.length-1}, $${values.length})`;
      }).join(',');

      const pokemonsResult = await client.query(
        `SELECT id, name, af FROM pokemons WHERE (id, af) IN (${conditions})`,
        values
      );

      for (const poke of pokemonsResult.rows) {
        await client.query(
          'INSERT INTO choices (participants_id, pokemons_id, tournaments_id) VALUES ($1, $2, $3)',
          [participantId, poke.id, tournamentId]
        );
      }
    }

    await client.query('COMMIT');

    let message = 'Participante cadastrado com sucesso no torneio!';
    if (feeInfo.doubled) {
      message += ` Taxa cobrada: ${feeInfo.fee} coins (dobrada por ${feeInfo.woCount} W.O. no torneio anterior).`;
    } else if (feeInfo.fee > 0) {
      message += ` Taxa cobrada: ${feeInfo.fee} coins.`;
    }

    return res.status(200).json({ message, fee: feeInfo.fee, feeDoubled: feeInfo.doubled });
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

app.get('/public/cupStandings', async (req, res) => {
  const client = await pool.connect();
  try {
    const tournamentRes = await client.query(
      `
      SELECT id, name, titulo2, gen, qtdClassificados, formatoCopa, dateEnd
      FROM tournaments
      WHERE dateEnd IS NULL
      ORDER BY dateStart DESC, id DESC
      LIMIT 1
      `
    );

    if (tournamentRes.rows.length === 0) {
      return res.status(200).json({ active: false });
    }

    const tournament = tournamentRes.rows[0];
    const tournamentId = tournament.id;
    const qtdClassificados =
      tournament.qtdclassificados ?? tournament.qtdClassificados ?? 2;
    const formatoCopa = readFormatoCopa(tournament);
    const championsMode = isChampionsGen(tournament.gen);

    let standings = [];
    let hasGroups = false;

    if (formatoCopa === 'knockout') {
      // Só mata-mata: sem fase de grupos/suíço.
      standings = [];
      hasGroups = false;
    } else if (formatoCopa === 'swiss') {
      const swissData = await cupSwiss.fetchSwissStandings(client, tournamentId, qtdClassificados);
      standings = swissData.standings;
      hasGroups = standings.length > 0 && (await cupSwiss.getSwissState(client, tournamentId)).hasSwiss;
    } else {
      const groupData = await cupKnockout.fetchGroupStandings(
        client,
        tournamentId,
        qtdClassificados
      );
      standings = groupData.standings;
      hasGroups = standings.length > 0;
    }

    const knockoutRes = await client.query(
      `
      SELECT
        tm.id,
        tm.phase,
        tm.best_of,
        tm.score_a,
        tm.score_b,
        tm.winner_id,
        tm.player_a_id,
        tm.player_b_id,
        pa.name AS player_a_name,
        pb.name AS player_b_name,
        pw.name AS winner_name
      FROM tournament_matches tm
      JOIN players pa ON pa.id = tm.player_a_id
      JOIN players pb ON pb.id = tm.player_b_id
      LEFT JOIN players pw ON pw.id = tm.winner_id
      WHERE tm.tournament_id = $1
        AND tm.phase NOT LIKE 'swiss_%'
        AND tm.phase <> 'groups'
      ORDER BY
        CASE tm.phase
          WHEN 'r128' THEN 1
          WHEN 'r64' THEN 2
          WHEN 'r32' THEN 3
          WHEN 'r16' THEN 4
          WHEN 'qf' THEN 5
          WHEN 'sf' THEN 6
          WHEN '3p' THEN 7
          WHEN 'final' THEN 8
          ELSE 9
        END,
        tm.id
      `,
      [tournamentId]
    );

    const finalWinnerRes = await client.query(
      `
      SELECT COUNT(*)::int AS n
      FROM tournament_matches
      WHERE tournament_id = $1 AND phase = 'final' AND winner_id IS NOT NULL
      `,
      [tournamentId]
    );

    let participants = [];
    if (championsMode) {
      const participantsRes = await client.query(
        `
        SELECT
          pa.id AS participant_id,
          p.id AS player_id,
          p.name,
          pa.team_image AS "teamImage"
        FROM participants pa
        JOIN players p ON p.id = pa.players_id
        WHERE pa.tournaments_id = $1
        ORDER BY p.name
        `,
        [tournamentId]
      );
      participants = participantsRes.rows.map((row) => ({
        participant_id: row.participant_id,
        player_id: row.player_id,
        name: row.name,
        teamImage: row.teamImage ?? row.teamimage ?? null
      }));
    }

    const hasKnockout = knockoutRes.rows.length > 0;

    return res.status(200).json({
      active: true,
      tournamentId,
      tournamentName: tournament.name,
      titulo2: tournament.titulo2,
      formatoCopa,
      championsMode,
      qtdClassificados,
      hasGroups,
      hasPublishedContent: hasGroups || hasKnockout,
      standings,
      participants,
      knockout: {
        hasKnockout,
        cupFinished: finalWinnerRes.rows[0].n > 0,
        matches: knockoutRes.rows
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar classificação pública dos grupos.' });
  } finally {
    client.release();
  }
});

app.post('/createTournament', auth, async (req, res) => {
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
    monotype,
    paymentRegister
  } = req.body;

  // Validação básica
  const championsMode = isChampionsGen(gen);
  if (!titulo || !gen) {
    return res.status(400).json({ error: 'Campos obrigatórios não preenchidos.' });
  }
  if (!championsMode && (!sprites || !qtdLimitado)) {
    return res.status(400).json({ error: 'Campos obrigatórios não preenchidos.' });
  }

  const resolvedSprites = championsMode ? 'champions' : sprites;
  const resolvedQtdLimitado = championsMode ? 0 : qtdLimitado;
  const resolvedQtdLimitadoLendario = championsMode ? 0 : (qtdLimitadoLendario || null);
  const resolvedQtdEscolha = championsMode ? null : (qtdEscolha || null);
  const resolvedListaLimitado = championsMode ? [] : (listaLimitado || []);
  const resolvedListaLimitadoLendario = championsMode ? [] : (listaLimitadoLendario || []);
  const resolvedListaBanido = championsMode ? [] : (listaBanido || []);
  const resolvedPrizes = championsMode ? false : (prizes || false);
  const resolvedMonotype = championsMode ? false : (monotype || false);

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
        monotype,
        paymentRegister
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      )
      RETURNING id
    `;

    const values = [
      titulo,
      titulo2 || '',
      gen,
      resolvedSprites,
      resolvedQtdEscolha,
      resolvedQtdLimitado,
      resolvedQtdLimitadoLendario,
      hook || '',
      enviarDiscord || false,
      resolvedListaLimitado,
      resolvedListaLimitadoLendario,
      resolvedListaBanido,
      encerrado || false,
      resolvedPrizes,
      resolvedMonotype,
      paymentRegister || 50
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

app.post('/updateConfig', auth, async (req, res) => {
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
    paymentRegister,
    dateEnd
  } = req.body;

  if (!tournamentId || !titulo || !gen) {
    return res.status(400).json({ error: 'Campos obrigatórios não preenchidos.' });
  }

  const championsMode = isChampionsGen(gen);
  if (!championsMode && (!sprites || !qtdLimitado)) {
    return res.status(400).json({ error: 'Campos obrigatórios não preenchidos.' });
  }

  const resolvedSprites = championsMode ? 'champions' : sprites;
  const resolvedQtdLimitado = championsMode ? 0 : qtdLimitado;
  const resolvedQtdLimitadoLendario = championsMode ? 0 : (qtdLimitadoLendario || null);
  const resolvedQtdEscolha = championsMode ? null : (qtdEscolha || null);
  const resolvedListaLimitado = championsMode ? [] : (listaLimitado || []);
  const resolvedListaLimitadoLendario = championsMode ? [] : (listaLimitadoLendario || []);
  const resolvedListaBanido = championsMode ? [] : (listaBanido || []);
  const resolvedPrizes = championsMode ? false : (prizes || false);
  const resolvedMonotype = championsMode ? false : (monotype || false);

  const client = await pool.connect();
  try {
    const previousState = await client.query(
      'SELECT encerrado, gen FROM tournaments WHERE id = $1',
      [tournamentId]
    );
    if (previousState.rows.length === 0) {
      return res.status(404).json({ error: 'Torneio não encontrado.' });
    }

    const wasOpen = !previousState.rows[0].encerrado;
    const isClosing = Boolean(encerrado) && wasOpen;

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
        paymentRegister = $16,
        dateEnd = COALESCE($17, dateEnd)
      WHERE id = $18
    `;

    const values = [
      titulo,
      titulo2 || '',
      gen,
      resolvedSprites,
      resolvedQtdEscolha,
      resolvedQtdLimitado,
      resolvedQtdLimitadoLendario,
      hook || '',
      enviarDiscord || false,
      resolvedListaLimitado,
      resolvedListaLimitadoLendario,
      resolvedListaBanido,
      encerrado || false,
      resolvedPrizes,
      resolvedMonotype,
      paymentRegister || 50,
      dateEnd || null,
      tournamentId
    ];

    const result = await client.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Torneio não encontrado.' });
    }

    if (isClosing && championsMode && hook && enviarDiscord) {
      try {
        const discordResult = await sendChampionsTeamsToDiscord(client, tournamentId, hook);
        console.log(`Champions Discord: ${discordResult.sent} imagens enviadas, ${discordResult.skipped} ignoradas.`);
      } catch (discordErr) {
        console.error('Erro ao enviar times Champions ao Discord:', discordErr);
      }
    }

    return res.status(200).json({ message: 'Configurações do torneio atualizadas com sucesso!' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao atualizar o torneio.' });
  } finally {
    client.release();
  }
});

function parsePositiveInt(value) {
  const n = typeof value === 'string' ? parseInt(value, 10) : value;
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function parseFormatoMataMata(value) {
  // Front envia MD1/MD3 como 1 ou 3.
  const n = typeof value === 'string' ? parseInt(value, 10) : value;
  if (n === 1 || n === 3) return n;
  return null;
}

function parseFormatoCopa(value) {
  const normalized = String(value ?? 'groups').trim().toLowerCase();
  if (normalized === 'groups' || normalized === 'knockout' || normalized === 'swiss') return normalized;
  return null;
}

function readFormatoCopa(row) {
  return row?.formatocopa ?? row?.formatoCopa ?? 'groups';
}

async function runDirectKnockoutGeneration(client, tournamentId, formatoMataMata) {
  const existingMatches = await client.query(
    'SELECT COUNT(*)::int AS n FROM tournament_matches WHERE tournament_id = $1',
    [tournamentId]
  );
  if (existingMatches.rows[0].n > 0) {
    await client.query('DELETE FROM tournament_matches WHERE tournament_id = $1', [tournamentId]);
  }

  await client.query(
    `UPDATE tournaments SET formatoCopa = 'knockout', formatoMataMata = $1 WHERE id = $2`,
    [formatoMataMata, tournamentId]
  );

  const playerIds = await cupKnockout.fetchAllParticipantPlayerIds(client, tournamentId);
  if (playerIds.length < 2) {
    throw new Error('Mínimo de 2 inscritos para gerar o mata-mata.');
  }

  const bracketRound = cupKnockout.buildDirectKnockoutRound(playerIds);
  const { pairings, byes, totalSlots, playerCount } = bracketRound;

  if (pairings.length === 0 && byes.length === 0) {
    throw new Error('Não foi possível montar a chave do mata-mata.');
  }

  const phase = cupKnockout.knockoutPhaseForBracketSize(totalSlots);
  if (!phase) {
    throw new Error('Quantidade de inscritos não suportada para chave (máx. 128).');
  }

  const created = await cupKnockout.insertKnockoutRound(
    client,
    tournamentId,
    pairings,
    formatoMataMata,
    phase
  );
  const byeMatchIds = await cupKnockout.insertKnockoutByes(
    client,
    tournamentId,
    byes,
    phase
  );

  return {
    phase,
    playerCount,
    totalSlots,
    qtdConfrontos: created.length,
    qtdByes: byeMatchIds.length,
    matchIds: [...created, ...byeMatchIds]
  };
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

app.get('/getCupSetup', auth, async (req, res) => {
  const tournamentId = req.query.tournamentId;
  const id = typeof tournamentId === 'string' ? tournamentId.trim() : tournamentId;

  if (!id) return res.status(400).json({ error: 'tournamentId é obrigatório.' });

  try {
    const tournamentResult = await pool.query(
      'SELECT qtdGrupos, qtdClassificados, formatoMataMata, formatoCopa, qtdRodadasSuico FROM tournaments WHERE id = $1',
      [id]
    );
    if (tournamentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Torneio não encontrado.' });
    }

    const participantsResult = await pool.query(
      'SELECT COUNT(*)::int AS qtdParticipantes, COUNT(DISTINCT grupo)::int AS qtdGruposComSorteio FROM participants WHERE tournaments_id = $1',
      [id]
    );

    const row = tournamentResult.rows[0];
    const participantsRow = participantsResult.rows[0] || {};
    const qtdParticipantes = participantsRow.qtdparticipantes
      ?? participantsRow.qtdParticipantes
      ?? 0;
    const qtdGruposComSorteio = participantsRow.qtdgruposcomsorteio
      ?? participantsRow.qtdGruposComSorteio
      ?? 0;
    const qtdClassificados = row.qtdclassificados ?? row.qtdClassificados ?? null;
    const minRodadasSuico = cupSwiss.minimumSwissRounds(qtdParticipantes, qtdClassificados);
    const rodadasSuicoAutomaticas = cupSwiss.recommendedSwissRounds(qtdParticipantes, qtdClassificados);

    // node-pg lowercases unquoted aliases; expose camelCase for the admin UI.
    return res.status(200).json({
      qtdGrupos: row.qtdgrupos ?? row.qtdGrupos ?? null,
      qtdClassificados,
      formatoMataMata: row.formatomatamata ?? row.formatoMataMata ?? null,
      qtdRodadasSuico: row.qtdrodadassuico ?? row.qtdRodadasSuico ?? null,
      formatoCopa: readFormatoCopa(row),
      qtdParticipantes,
      qtdGruposComSorteio,
      minRodadasSuico,
      rodadasSuicoAutomaticas
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar setup da copa.' });
  }
});

app.get('/getTournamentParticipants', auth, async (req, res) => {
  const tournamentId = req.query.tournamentId;
  const id = typeof tournamentId === 'string' ? tournamentId.trim() : tournamentId;

  if (!id) return res.status(400).json({ error: 'tournamentId é obrigatório.' });

  try {
    const result = await pool.query(
      `
      SELECT
        pa.id AS participant_id,
        p.id AS player_id,
        p.name,
        p.email,
        pa.grupo
      FROM participants pa
      JOIN players p ON p.id = pa.players_id
      WHERE pa.tournaments_id = $1
      ORDER BY pa.grupo NULLS LAST, p.name
      `,
      [id]
    );

    return res.status(200).json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao listar participantes.' });
  }
});

app.post('/updateCupSetup', auth, async (req, res) => {
  const {
    tournamentId,
    qtdGrupos,
    qtdClassificados,
    formatoMataMata,
    formatoCopa,
    qtdRodadasSuico
  } = req.body;

  if (!tournamentId) return res.status(400).json({ error: 'tournamentId é obrigatório.' });

  const parsedFormatoCopa = parseFormatoCopa(formatoCopa ?? 'groups');
  const parsedFormatoMataMata = parseFormatoMataMata(formatoMataMata);

  if (!parsedFormatoCopa) {
    return res.status(400).json({ error: 'formatoCopa deve ser "groups", "knockout" ou "swiss".' });
  }
  if (!parsedFormatoMataMata) {
    return res.status(400).json({ error: 'formatoMataMata deve ser 1 (MD1) ou 3 (MD3).' });
  }

  let parsedQtdGrupos = null;
  let parsedQtdClassificados = null;
  let parsedQtdRodadasSuico = null;

  if (parsedFormatoCopa === 'groups') {
    parsedQtdGrupos = parsePositiveInt(qtdGrupos);
    parsedQtdClassificados = parsePositiveInt(qtdClassificados);
    if (!parsedQtdGrupos || parsedQtdGrupos > 26) {
      return res.status(400).json({ error: 'qtdGrupos deve ser um inteiro positivo entre 1 e 26.' });
    }
    if (!parsedQtdClassificados) {
      return res.status(400).json({ error: 'qtdClassificados deve ser um inteiro positivo.' });
    }
  } else if (parsedFormatoCopa === 'swiss') {
    parsedQtdClassificados = parsePositiveInt(qtdClassificados);
    if (!parsedQtdClassificados) {
      return res.status(400).json({ error: 'qtdClassificados deve ser um inteiro positivo (classificados para o mata-mata).' });
    }
    if (qtdRodadasSuico !== undefined && qtdRodadasSuico !== null && qtdRodadasSuico !== '') {
      parsedQtdRodadasSuico = parsePositiveInt(qtdRodadasSuico);
      if (!parsedQtdRodadasSuico || parsedQtdRodadasSuico > cupSwiss.SWISS_MAX_ROUNDS) {
        return res.status(400).json({
          error: `qtdRodadasSuico deve ser entre 1 e ${cupSwiss.SWISS_MAX_ROUNDS}.`
        });
      }
    }
  }

  try {
    if (parsedFormatoCopa === 'swiss') {
      const participantsCountRes = await pool.query(
        'SELECT COUNT(*)::int AS n FROM participants WHERE tournaments_id = $1',
        [tournamentId]
      );
      const qtdParticipantes = participantsCountRes.rows[0].n;
      const minRodadasSuico = cupSwiss.minimumSwissRounds(qtdParticipantes, parsedQtdClassificados);

      if (qtdParticipantes >= 2 && parsedQtdClassificados > qtdParticipantes) {
        return res.status(400).json({
          error: 'qtdClassificados não pode exceder o número de inscritos.'
        });
      }
      if (parsedQtdRodadasSuico && parsedQtdRodadasSuico < minRodadasSuico) {
        return res.status(400).json({
          error: `qtdRodadasSuico deve ser no mínimo ${minRodadasSuico} para ${qtdParticipantes} inscrito(s) e top ${parsedQtdClassificados} classificados.`
        });
      }
    }
    let result;
    if (parsedFormatoCopa === 'knockout') {
      result = await pool.query(
        `
        UPDATE tournaments
        SET formatoCopa = $1, formatoMataMata = $2
        WHERE id = $3
        RETURNING qtdGrupos, qtdClassificados, formatoMataMata, formatoCopa, qtdRodadasSuico
        `,
        [parsedFormatoCopa, parsedFormatoMataMata, tournamentId]
      );
    } else if (parsedFormatoCopa === 'swiss') {
      result = await pool.query(
        `
        UPDATE tournaments
        SET
          qtdClassificados = $1,
          formatoMataMata = $2,
          formatoCopa = $3,
          qtdRodadasSuico = $4
        WHERE id = $5
        RETURNING qtdGrupos, qtdClassificados, formatoMataMata, formatoCopa, qtdRodadasSuico
        `,
        [parsedQtdClassificados, parsedFormatoMataMata, parsedFormatoCopa, parsedQtdRodadasSuico, tournamentId]
      );
    } else {
      result = await pool.query(
        `
        UPDATE tournaments
        SET
          qtdGrupos = $1,
          qtdClassificados = $2,
          formatoMataMata = $3,
          formatoCopa = $4
        WHERE id = $5
        RETURNING qtdGrupos, qtdClassificados, formatoMataMata, formatoCopa, qtdRodadasSuico
        `,
        [parsedQtdGrupos, parsedQtdClassificados, parsedFormatoMataMata, parsedFormatoCopa, tournamentId]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Torneio não encontrado.' });
    }

    return res.status(200).json({ message: 'Setup da copa atualizado com sucesso!', ...result.rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao atualizar setup da copa.' });
  }
});

app.post('/generateCupGroups', auth, async (req, res) => {
  const { tournamentId, qtdGrupos, qtdClassificados, formatoMataMata } = req.body;

  const parsedTournamentId = parsePositiveInt(tournamentId);
  if (!parsedTournamentId) return res.status(400).json({ error: 'tournamentId inválido.' });

  const parsedQtdGruposBody = qtdGrupos !== undefined ? parsePositiveInt(qtdGrupos) : null;
  const parsedQtdClassificadosBody = qtdClassificados !== undefined ? parsePositiveInt(qtdClassificados) : null;
  const parsedFormatoMataMataBody = formatoMataMata !== undefined ? parseFormatoMataMata(formatoMataMata) : null;

  if (qtdGrupos !== undefined && (!parsedQtdGruposBody || parsedQtdGruposBody > 26)) {
    return res.status(400).json({ error: 'qtdGrupos deve ser um inteiro positivo entre 1 e 26.' });
  }
  if (qtdClassificados !== undefined && !parsedQtdClassificadosBody) {
    return res.status(400).json({ error: 'qtdClassificados deve ser um inteiro positivo.' });
  }
  if (formatoMataMata !== undefined && !parsedFormatoMataMataBody) {
    return res.status(400).json({ error: 'formatoMataMata deve ser 1 (MD1) ou 3 (MD3).' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Bloqueia a linha para evitar condições de corrida entre configs/sorteios.
    const tournamentResult = await client.query(
      'SELECT qtdGrupos, qtdClassificados, formatoMataMata FROM tournaments WHERE id = $1 FOR UPDATE',
      [parsedTournamentId]
    );

    if (tournamentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Torneio não encontrado.' });
    }

    let {
      qtdGrupos: qtdGruposDb,
      qtdClassificados: qtdClassificadosDb,
      formatoMataMata: formatoMataMataDb
    } = tournamentResult.rows[0];

    // Se o front enviar valores, aplicamos antes do sorteio.
    const qtdGruposFinal = parsedQtdGruposBody ?? qtdGruposDb;
    const qtdClassificadosFinal = parsedQtdClassificadosBody ?? qtdClassificadosDb;
    const formatoMataMataFinal = parsedFormatoMataMataBody ?? formatoMataMataDb;

    await client.query(
      `
      UPDATE tournaments
      SET
        qtdGrupos = $1,
        qtdClassificados = $2,
        formatoMataMata = $3,
        formatoCopa = 'groups'
      WHERE id = $4
      `,
      [qtdGruposFinal, qtdClassificadosFinal, formatoMataMataFinal, parsedTournamentId]
    );

    if (!qtdGruposFinal || qtdGruposFinal < 1 || qtdGruposFinal > 26) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'qtdGrupos inválido.' });
    }
    if (!qtdClassificadosFinal || qtdClassificadosFinal < 1) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'qtdClassificados inválido.' });
    }
    if (formatoMataMataFinal !== 1 && formatoMataMataFinal !== 3) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'formatoMataMata inválido.' });
    }

    const participantsResult = await client.query(
      'SELECT id, players_id FROM participants WHERE tournaments_id = $1 ORDER BY id',
      [parsedTournamentId]
    );

    const participants = participantsResult.rows;
    const total = participants.length;

    if (total === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Não há participantes cadastrados para este torneio.' });
    }
    if (qtdGruposFinal > total) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'qtdGrupos não pode ser maior que a quantidade de participantes.' });
    }

    // Shuffle Fisher-Yates
    for (let i = participants.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [participants[i], participants[j]] = [participants[j], participants[i]];
    }

    // Distribui participantes o mais parelho possível entre grupos.
    const baseSize = Math.floor(total / qtdGruposFinal);
    const rem = total % qtdGruposFinal;

    // Como a distribuição pode criar grupos menores (quando `rem > 0`),
    // para garantir "qtdClassificados por grupo" precisamos que o menor grupo comporte isso.
    const minGroupSize = baseSize; // grupos "sem sobra" têm tamanho baseSize
    if (qtdClassificadosFinal > minGroupSize) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'qtdClassificados não pode exceder o tamanho mínimo de grupo com a distribuição atual.'
      });
    }

    const labels = ALPHABET.slice(0, qtdGruposFinal).split('');
    const assignments = []; // { participantId, grupo }
    const groupMembers = new Map(); // grupo -> playersId[]

    for (const label of labels) groupMembers.set(label, []);

    let idx = 0;
    for (let g = 0; g < qtdGruposFinal; g++) {
      const label = labels[g];
      const size = baseSize + (g < rem ? 1 : 0);
      const slice = participants.slice(idx, idx + size);
      idx += size;

      for (const participant of slice) {
        assignments.push({ participantId: participant.id, grupo: label });
        groupMembers.get(label).push(participant.players_id);
      }
    }

    // Reseta estatísticas e aplica o grupo.
    await client.query(
      `
      UPDATE participants
      SET
        grupo = NULL,
        pontos = 0,
        vitorias = 0,
        derrotas = 0,
        empates = 0,
        saldo = 0,
        posicao = NULL
      WHERE tournaments_id = $1
      `,
      [parsedTournamentId]
    );

    // Bulk update grupo via VALUES:
    // participantId placeholders: 2..(2N+1) par e grupo: 3..(2N+2) impar.
    const valuesFlat = [];
    const groupsTuples = [];
    for (let k = 0; k < assignments.length; k++) {
      const { participantId, grupo } = assignments[k];
      // Placeholder 1 é tournamentId. Depois vêm pares.
      const pIdx = 1 + k * 2 + 1; // participantId
      const gIdx = 1 + k * 2 + 2; // grupo
      valuesFlat.push(participantId, grupo);
      groupsTuples.push(`($${pIdx}::int, $${gIdx}::char(1))`);
    }

    await client.query(
      `
      UPDATE participants p
      SET
        grupo = v.grupo
      FROM (VALUES ${groupsTuples.join(',')}) AS v(participant_id, grupo)
      WHERE p.id = v.participant_id AND p.tournaments_id = $1
      `,
      [parsedTournamentId, ...valuesFlat]
    );

    // Recria jogos da fase de grupos.
    await client.query('DELETE FROM tournament_matches WHERE tournament_id = $1', [parsedTournamentId]);

    const GROUP_PHASE_BEST_OF = 1;
    const createdMatches = [];

    const insertGroupMatch = async (playerAId, playerBId, grupo) => {
      const matchInsertRes = await client.query(
        `
        INSERT INTO tournament_matches
          (tournament_id, player_a_id, player_b_id, winner_id, phase, best_of, score_a, score_b, grupo)
        VALUES
          ($1, $2, $3, NULL, 'groups', $4, 0, 0, $5)
        RETURNING id
        `,
        [parsedTournamentId, playerAId, playerBId, GROUP_PHASE_BEST_OF, grupo]
      );

      const matchId = matchInsertRes.rows[0].id;
      createdMatches.push(matchId);

      await client.query(
        'INSERT INTO tournament_games (match_id, game_number) VALUES ($1, 1)',
        [matchId]
      );
    };

    for (const [grupo, members] of groupMembers.entries()) {
      // Round-robin ida e volta: cada par se enfrenta nos dois sentidos (1 jogo por confronto).
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const playerAId = members[i];
          const playerBId = members[j];

          await insertGroupMatch(playerAId, playerBId, grupo);
          await insertGroupMatch(playerBId, playerAId, grupo);
        }
      }
    }

    await client.query('COMMIT');

    return res.status(200).json({
      message: 'Grupos sorteados e fase de grupos gerada com sucesso!',
      qtdParticipantes: total,
      qtdGrupos: qtdGruposFinal,
      qtdClassificadosPorGrupo: qtdClassificadosFinal,
      formatoMataMata: formatoMataMataFinal,
      qtdPartidasGeradas: createdMatches.length
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return res.status(500).json({ error: 'Erro ao gerar grupos.' });
  } finally {
    client.release();
  }
});

app.post('/generateSwissRound', auth, async (req, res) => {
  const parsedTournamentId = parsePositiveInt(req.body.tournamentId);
  const reset = Boolean(req.body.reset);

  if (!parsedTournamentId) return res.status(400).json({ error: 'tournamentId inválido.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tournamentResult = await client.query(
      'SELECT qtdClassificados, formatoMataMata, formatoCopa, qtdRodadasSuico FROM tournaments WHERE id = $1 FOR UPDATE',
      [parsedTournamentId]
    );

    if (tournamentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Torneio não encontrado.' });
    }

    const tournament = tournamentResult.rows[0];
    const qtdClassificados =
      tournament.qtdclassificados ?? tournament.qtdClassificados ?? 8;
    const formatoMataMata =
      tournament.formatomatamata ?? tournament.formatoMataMata ?? 3;
    const qtdRodadasSuicoDb =
      tournament.qtdrodadassuico ?? tournament.qtdRodadasSuico;

    const participantsResult = await client.query(
      'SELECT players_id FROM participants WHERE tournaments_id = $1 ORDER BY id',
      [parsedTournamentId]
    );
    const playerIds = participantsResult.rows.map((row) => row.players_id);
    const total = playerIds.length;

    if (total < 2) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'São necessários pelo menos 2 participantes.' });
    }

    if (qtdClassificados > total) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'qtdClassificados não pode exceder o número de inscritos.' });
    }

    const totalRounds = cupSwiss.resolveSwissRounds(total, qtdRodadasSuicoDb, qtdClassificados);
    const swissState = await cupSwiss.getSwissState(client, parsedTournamentId);

    if (reset || !swissState.hasSwiss) {
      await client.query(
        `
        UPDATE participants
        SET grupo = NULL, pontos = 0, vitorias = 0, derrotas = 0, empates = 0, saldo = 0, posicao = NULL
        WHERE tournaments_id = $1
        `,
        [parsedTournamentId]
      );
      await client.query('DELETE FROM tournament_matches WHERE tournament_id = $1', [parsedTournamentId]);
      await client.query(
        `UPDATE tournaments SET formatoCopa = 'swiss', formatoMataMata = $1, qtdClassificados = $2 WHERE id = $3`,
        [formatoMataMata, qtdClassificados, parsedTournamentId]
      );
    } else if (!swissState.latestComplete) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'A rodada suíça atual ainda tem confrontos pendentes.' });
    } else if (swissState.currentRound >= totalRounds) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Todas as rodadas suíças já foram geradas.' });
    }

    const roundNumber = reset || !swissState.hasSwiss ? 1 : swissState.nextRound;
    const phase = cupSwiss.swissPhaseName(roundNumber);

    let pairings = [];
    let bye = null;

    if (roundNumber === 1) {
      ({ pairings, bye } = cupSwiss.pairSwissRound1(playerIds));
    } else {
      await cupSwiss.rebuildSwissStats(client, parsedTournamentId);
      const standings = await cupSwiss.fetchSwissParticipantRows(client, parsedTournamentId);
      const playedPairs = await cupSwiss.fetchPlayedPairs(client, parsedTournamentId);
      ({ pairings, bye } = cupSwiss.pairSwissRoundNext(standings, playedPairs));
    }

    const createdMatches = [];
    for (const [playerAId, playerBId] of pairings) {
      const matchId = await cupSwiss.insertSwissMatch(
        client,
        parsedTournamentId,
        playerAId,
        playerBId,
        phase
      );
      createdMatches.push(matchId);
    }

    if (bye) {
      const byeId = await cupSwiss.insertSwissBye(client, parsedTournamentId, bye, phase);
      createdMatches.push(byeId);
      await client.query(
        `
        UPDATE participants
        SET pontos = pontos + 3, vitorias = vitorias + 1, saldo = saldo + 3
        WHERE tournaments_id = $1 AND players_id = $2
        `,
        [parsedTournamentId, bye]
      );
    }

    await cupSwiss.rebuildSwissStats(client, parsedTournamentId);

    await client.query('COMMIT');

    return res.status(200).json({
      message: `Rodada suíça ${roundNumber} gerada com sucesso!`,
      round: roundNumber,
      totalRounds,
      qtdConfrontos: pairings.length,
      qtdByes: bye ? 1 : 0,
      matchIds: createdMatches
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return res.status(500).json({ error: 'Erro ao gerar rodada suíça.' });
  } finally {
    client.release();
  }
});

app.get('/getCupStatus', auth, async (req, res) => {
  const id = parsePositiveInt(req.query.tournamentId);
  if (!id) return res.status(400).json({ error: 'tournamentId inválido.' });

  try {
    const tournamentRes = await pool.query(
      'SELECT id, name, qtdGrupos, qtdClassificados, formatoMataMata, formatoCopa, qtdRodadasSuico, dateend FROM tournaments WHERE id = $1',
      [id]
    );
    if (tournamentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Torneio não encontrado.' });
    }
    const tournament = tournamentRes.rows[0];
    const formatoCopa = readFormatoCopa(tournament);
    const knockoutOnly = formatoCopa === 'knockout';
    const swissMode = formatoCopa === 'swiss';
    const qtdRodadasSuico =
      tournament.qtdrodadassuico ?? tournament.qtdRodadasSuico ?? null;

    const participantsCountRes = await pool.query(
      'SELECT COUNT(*)::int AS n FROM participants WHERE tournaments_id = $1',
      [id]
    );
    const qtdParticipantes = participantsCountRes.rows[0].n;

    const groupStatsRes = await pool.query(
      `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE winner_id IS NOT NULL)::int AS completed
      FROM tournament_matches
      WHERE tournament_id = $1 AND phase = 'groups'
      `,
      [id]
    );
    const groupStats = groupStatsRes.rows[0];

    const knockoutRes = await pool.query(
      `
      SELECT phase,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE winner_id IS NOT NULL)::int AS completed
      FROM tournament_matches
      WHERE tournament_id = $1 AND phase <> 'groups'
      GROUP BY phase
      `,
      [id]
    );

    const knockoutRounds = knockoutRes.rows
      .filter((r) => cupKnockout.isKnockoutPhase(r.phase))
      .map((r) => ({
        phase: r.phase,
        total: r.total,
        completed: r.completed,
        pending: r.total - r.completed,
        sortKey: cupKnockout.phaseSortKey(r.phase)
      }))
      .sort((a, b) => a.sortKey - b.sortKey);

    const qtdClassificados =
      tournament.qtdclassificados ?? tournament.qtdClassificados ?? null;
    const swissState = swissMode ? await cupSwiss.getSwissState(pool, id) : null;
    const minRodadasSuico = swissMode
      ? cupSwiss.minimumSwissRounds(qtdParticipantes, qtdClassificados)
      : 0;
    const rodadasSuicoAutomaticas = swissMode
      ? cupSwiss.recommendedSwissRounds(qtdParticipantes, qtdClassificados)
      : 0;
    const swissRoundsTotal = swissMode
      ? cupSwiss.resolveSwissRounds(qtdParticipantes, qtdRodadasSuico, qtdClassificados)
      : 0;
    const swissComplete = swissMode
      && swissState.hasSwiss
      && swissState.currentRound >= swissRoundsTotal
      && swissState.latestComplete;

    const hasKnockout = knockoutRounds.length > 0;
    const groupsComplete = groupStats.total > 0 && groupStats.completed === groupStats.total;
    const latestKnockout = knockoutRounds[knockoutRounds.length - 1] || null;
    const latestKnockoutComplete = latestKnockout
      ? latestKnockout.completed === latestKnockout.total
      : false;
    const hasFinalWinner = await pool.query(
      `
      SELECT COUNT(*)::int AS n
      FROM tournament_matches
      WHERE tournament_id = $1 AND phase = 'final' AND winner_id IS NOT NULL
      `,
      [id]
    );

    const hasFinalRes = await pool.query(
      `
      SELECT COUNT(*)::int AS n
      FROM tournament_matches
      WHERE tournament_id = $1 AND phase = 'final'
      `,
      [id]
    );
    const hasThirdPlaceRes = await pool.query(
      `
      SELECT COUNT(*)::int AS n
      FROM tournament_matches
      WHERE tournament_id = $1 AND phase = '3p'
      `,
      [id]
    );
    const sfStatsRes = await pool.query(
      `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE winner_id IS NOT NULL)::int AS completed
      FROM tournament_matches
      WHERE tournament_id = $1 AND phase = 'sf'
      `,
      [id]
    );
    const sfStats = sfStatsRes.rows[0];
    const sfComplete = sfStats.total > 0 && sfStats.completed === sfStats.total;
    const hasFinal = hasFinalRes.rows[0].n > 0;
    const hasThirdPlace = hasThirdPlaceRes.rows[0].n > 0;

    return res.status(200).json({
      tournamentId: id,
      tournamentName: tournament.name,
      formatoCopa,
      qtdParticipantes,
      qtdGrupos: tournament.qtdgrupos ?? tournament.qtdGrupos,
      qtdClassificados,
      formatoMataMata: tournament.formatomatamata ?? tournament.formatoMataMata,
      qtdRodadasSuico,
      minRodadasSuico: swissMode ? minRodadasSuico : null,
      rodadasSuicoAutomaticas: swissMode ? rodadasSuicoAutomaticas : null,
      dateEnd: tournament.dateend ?? tournament.dateEnd,
      groups: {
        total: groupStats.total,
        completed: groupStats.completed,
        pending: groupStats.total - groupStats.completed,
        complete: groupsComplete
      },
      swiss: swissMode ? {
        rounds: swissState.rounds,
        totalRounds: swissRoundsTotal,
        minRodadasSuico,
        rodadasSuicoAutomaticas,
        currentRound: swissState.currentRound,
        complete: swissComplete,
        canGenerateNextRound:
          !hasKnockout
          && (!swissState.hasSwiss || (swissState.latestComplete && swissState.currentRound < swissRoundsTotal))
      } : null,
      knockout: {
        hasKnockout,
        rounds: knockoutRounds,
        latestPhase: latestKnockout?.phase ?? null,
        latestComplete: latestKnockoutComplete,
        cupFinished: hasFinalWinner.rows[0].n > 0
      },
      canGenerateKnockout: knockoutOnly
        ? !hasKnockout && qtdParticipantes >= 2
        : swissMode
          ? swissComplete && !hasKnockout
          : groupsComplete && !hasKnockout,
      canAdvanceKnockout:
        hasKnockout &&
        latestKnockoutComplete &&
        latestKnockout?.phase !== 'final' &&
        hasFinalWinner.rows[0].n === 0,
      canGenerateThirdPlace: sfComplete && hasFinal && !hasThirdPlace
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar status da copa.' });
  }
});

app.get('/getGroupStandings', auth, async (req, res) => {
  const id = parsePositiveInt(req.query.tournamentId);
  if (!id) return res.status(400).json({ error: 'tournamentId inválido.' });

  const client = await pool.connect();
  try {
    const tournamentRes = await client.query(
      'SELECT qtdClassificados, formatoCopa FROM tournaments WHERE id = $1',
      [id]
    );
    if (tournamentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Torneio não encontrado.' });
    }

    const qtdClassificados =
      tournamentRes.rows[0].qtdclassificados ?? tournamentRes.rows[0].qtdClassificados ?? 2;
    const formatoCopa = readFormatoCopa(tournamentRes.rows[0]);

    if (formatoCopa === 'swiss') {
      const { standings } = await cupSwiss.fetchSwissStandings(client, id, qtdClassificados);
      return res.status(200).json(standings);
    }

    const { standings } = await cupKnockout.fetchGroupStandings(client, id, qtdClassificados);
    return res.status(200).json(standings);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar classificação dos grupos.' });
  } finally {
    client.release();
  }
});

app.get('/getTournamentMatches', auth, async (req, res) => {
  const id = parsePositiveInt(req.query.tournamentId);
  if (!id) return res.status(400).json({ error: 'tournamentId inválido.' });

  try {
    const result = await pool.query(
      `
      SELECT
        tm.id,
        tm.phase,
        tm.grupo,
        tm.best_of,
        tm.score_a,
        tm.score_b,
        tm.winner_id,
        tm.ended_at,
        tm.player_a_id,
        tm.player_b_id,
        pa.name AS player_a_name,
        pb.name AS player_b_name,
        pw.name AS winner_name
      FROM tournament_matches tm
      JOIN players pa ON pa.id = tm.player_a_id
      JOIN players pb ON pb.id = tm.player_b_id
      LEFT JOIN players pw ON pw.id = tm.winner_id
      WHERE tm.tournament_id = $1
      ORDER BY
        CASE tm.phase
          WHEN 'groups' THEN 0
          WHEN 'r128' THEN 1
          WHEN 'r64' THEN 2
          WHEN 'r32' THEN 3
          WHEN 'r16' THEN 4
          WHEN 'qf' THEN 5
          WHEN 'sf' THEN 6
          WHEN '3p' THEN 7
          WHEN 'final' THEN 8
          ELSE 9
        END,
        tm.grupo NULLS LAST,
        tm.id
      `,
      [id]
    );

    return res.status(200).json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao listar confrontos.' });
  }
});

app.post('/generateDirectKnockout', auth, async (req, res) => {
  const tournamentId = parsePositiveInt(req.body.tournamentId);
  if (!tournamentId) return res.status(400).json({ error: 'tournamentId inválido.' });

  const parsedFormatoMataMata =
    req.body.formatoMataMata !== undefined
      ? parseFormatoMataMata(req.body.formatoMataMata)
      : null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tournamentRes = await client.query(
      'SELECT formatoMataMata FROM tournaments WHERE id = $1 FOR UPDATE',
      [tournamentId]
    );
    if (tournamentRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Torneio não encontrado.' });
    }

    const formatoMataMata =
      parsedFormatoMataMata ??
      tournamentRes.rows[0].formatomatamata ??
      tournamentRes.rows[0].formatoMataMata ??
      1;

    if (formatoMataMata !== 1 && formatoMataMata !== 3) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'formatoMataMata inválido.' });
    }

    const result = await runDirectKnockoutGeneration(client, tournamentId, formatoMataMata);

    await client.query('COMMIT');

    return res.status(200).json({
      message: 'Chave eliminatória gerada com sucesso!',
      formatoCopa: 'knockout',
      ...result
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    const message = err.message || 'Erro ao gerar mata-mata direto.';
    return res.status(err.message?.includes('Mínimo') ? 400 : 500).json({ error: message });
  } finally {
    client.release();
  }
});

app.post('/generateKnockout', auth, async (req, res) => {
  const tournamentId = parsePositiveInt(req.body.tournamentId);
  if (!tournamentId) return res.status(400).json({ error: 'tournamentId inválido.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tournamentRes = await client.query(
      'SELECT qtdClassificados, formatoMataMata, formatoCopa, qtdRodadasSuico FROM tournaments WHERE id = $1 FOR UPDATE',
      [tournamentId]
    );
    if (tournamentRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Torneio não encontrado.' });
    }

    const qtdClassificados =
      tournamentRes.rows[0].qtdclassificados ?? tournamentRes.rows[0].qtdClassificados;
    const formatoMataMata =
      tournamentRes.rows[0].formatomatamata ?? tournamentRes.rows[0].formatoMataMata;
    const formatoCopa = readFormatoCopa(tournamentRes.rows[0]);

    if (formatoCopa === 'knockout') {
      const result = await runDirectKnockoutGeneration(client, tournamentId, formatoMataMata);
      await client.query('COMMIT');
      return res.status(200).json({
        message: 'Chave eliminatória gerada com sucesso!',
        formatoCopa: 'knockout',
        ...result
      });
    }

    if (formatoCopa === 'swiss') {
      const qtdRodadasSuico =
        tournamentRes.rows[0].qtdrodadassuico ?? tournamentRes.rows[0].qtdRodadasSuico;
      const participantsCountRes = await client.query(
        'SELECT COUNT(*)::int AS n FROM participants WHERE tournaments_id = $1',
        [tournamentId]
      );
      const qtdParticipantes = participantsCountRes.rows[0].n;
      const totalRounds = cupSwiss.resolveSwissRounds(
        qtdParticipantes,
        qtdRodadasSuico,
        qtdClassificados
      );
      const swissState = await cupSwiss.getSwissState(client, tournamentId);

      if (!swissState.hasSwiss) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Gere pelo menos uma rodada suíça antes do mata-mata.' });
      }
      if (swissState.currentRound < totalRounds || !swissState.latestComplete) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'A fase suíça ainda não foi concluída.' });
      }

      const pendingSwiss = await client.query(
        `
        SELECT COUNT(*)::int AS n
        FROM tournament_matches
        WHERE tournament_id = $1 AND phase LIKE 'swiss_%' AND winner_id IS NULL
        `,
        [tournamentId]
      );
      if (pendingSwiss.rows[0].n > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Ainda há confrontos pendentes na fase suíça.' });
      }

      const existingKo = await client.query(
        `
        SELECT COUNT(*)::int AS n
        FROM tournament_matches
        WHERE tournament_id = $1
          AND phase NOT LIKE 'swiss_%'
          AND phase <> 'groups'
        `,
        [tournamentId]
      );
      if (existingKo.rows[0].n > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'O mata-mata já foi gerado para este torneio.' });
      }

      await cupSwiss.rebuildSwissStats(client, tournamentId);
      const { qualified } = await cupSwiss.fetchSwissStandings(client, tournamentId, qtdClassificados);
      const rankedIds = qualified.map((row) => row.players_id);

      if (rankedIds.length < 2) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'São necessários pelo menos 2 classificados para o mata-mata.' });
      }

      const bracketRound = cupKnockout.buildSeededKnockoutRound(rankedIds);
      const { pairings, byes, totalSlots, playerCount } = bracketRound;

      if (pairings.length === 0 && byes.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Não foi possível montar confrontos do mata-mata.' });
      }

      const phase = cupKnockout.knockoutPhaseForBracketSize(totalSlots);
      if (!phase) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Quantidade de classificados não suportada para chave.' });
      }

      const created = await cupKnockout.insertKnockoutRound(
        client,
        tournamentId,
        pairings,
        formatoMataMata,
        phase
      );
      const byeMatchIds = await cupKnockout.insertKnockoutByes(
        client,
        tournamentId,
        byes,
        phase
      );

      await client.query('COMMIT');

      return res.status(200).json({
        message: 'Mata-mata gerado com sucesso!',
        formatoCopa: 'swiss',
        phase,
        qtdClassificados: playerCount,
        qtdConfrontos: created.length,
        qtdByes: byeMatchIds.length,
        matchIds: [...created, ...byeMatchIds]
      });
    }

    const pendingGroups = await client.query(
      `
      SELECT COUNT(*)::int AS n
      FROM tournament_matches
      WHERE tournament_id = $1 AND phase = 'groups' AND winner_id IS NULL
      `,
      [tournamentId]
    );
    if (pendingGroups.rows[0].n > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Ainda há confrontos pendentes na fase de grupos.' });
    }

    const existingKo = await client.query(
      `
      SELECT COUNT(*)::int AS n
      FROM tournament_matches
      WHERE tournament_id = $1
        AND phase NOT LIKE 'swiss_%'
        AND phase <> 'groups'
      `,
      [tournamentId]
    );
    if (existingKo.rows[0].n > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'O mata-mata já foi gerado para este torneio.' });
    }

    const { qualifiedByGroup, groupLabels, standings } = await cupKnockout.fetchGroupStandings(
      client,
      tournamentId,
      qtdClassificados
    );

    for (const row of standings) {
      await client.query(
        'UPDATE participants SET posicao = $1 WHERE id = $2',
        [row.posicao, row.participant_id]
      );
    }

    if (qtdClassificados !== 2) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Geração atual do mata-mata suporta exatamente 2 classificados por grupo.'
      });
    }

    const bracketRound = cupKnockout.buildKnockoutRound(
      qualifiedByGroup,
      groupLabels,
      qtdClassificados
    );
    const { pairings, byes, totalSlots, playerCount } = bracketRound;

    if (pairings.length === 0 && byes.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Não foi possível montar confrontos do mata-mata.' });
    }

    const phase = cupKnockout.knockoutPhaseForBracketSize(totalSlots);
    if (!phase) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Quantidade de classificados não suportada para chave.' });
    }

    const created = await cupKnockout.insertKnockoutRound(
      client,
      tournamentId,
      pairings,
      formatoMataMata,
      phase
    );
    const byeMatchIds = await cupKnockout.insertKnockoutByes(
      client,
      tournamentId,
      byes,
      phase
    );

    await client.query('COMMIT');

    return res.status(200).json({
      message: 'Mata-mata gerado com sucesso!',
      phase,
      qtdClassificados: playerCount,
      qtdConfrontos: created.length,
      qtdByes: byeMatchIds.length,
      matchIds: [...created, ...byeMatchIds]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return res.status(500).json({ error: 'Erro ao gerar mata-mata.' });
  } finally {
    client.release();
  }
});

app.post('/advanceKnockout', auth, async (req, res) => {
  const tournamentId = parsePositiveInt(req.body.tournamentId);
  if (!tournamentId) return res.status(400).json({ error: 'tournamentId inválido.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tournamentRes = await client.query(
      'SELECT formatoMataMata FROM tournaments WHERE id = $1 FOR UPDATE',
      [tournamentId]
    );
    if (tournamentRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Torneio não encontrado.' });
    }
    const formatoMataMata =
      tournamentRes.rows[0].formatomatamata ?? tournamentRes.rows[0].formatoMataMata;

    const roundsRes = await client.query(
      `
      SELECT phase,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE winner_id IS NOT NULL)::int AS completed
      FROM tournament_matches
      WHERE tournament_id = $1
        AND phase NOT LIKE 'swiss_%'
        AND phase <> 'groups'
      GROUP BY phase
      `,
      [tournamentId]
    );

    if (roundsRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Mata-mata ainda não foi gerado.' });
    }

    const rounds = roundsRes.rows
      .filter((r) => cupKnockout.isKnockoutPhase(r.phase))
      .map((r) => ({ ...r, sortKey: cupKnockout.phaseSortKey(r.phase) }))
      .sort((a, b) => a.sortKey - b.sortKey);

    const latest = rounds[rounds.length - 1];
    if (latest.completed !== latest.total) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'A rodada atual do mata-mata ainda não terminou.' });
    }
    if (latest.phase === 'final') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'A final já foi definida.' });
    }

    const nextPhase = cupKnockout.nextKnockoutPhase(latest.phase);
    if (!nextPhase) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Não há próxima rodada para gerar.' });
    }

    const winnersRes = await client.query(
      `
      SELECT player_a_id, player_b_id, winner_id
      FROM tournament_matches
      WHERE tournament_id = $1 AND phase = $2 AND winner_id IS NOT NULL
      ORDER BY id
      `,
      [tournamentId, latest.phase]
    );

    const winners = winnersRes.rows.map((r) => r.winner_id);
    if (winners.length < 2 || winners.length % 2 !== 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Número inválido de vencedores na rodada anterior.' });
    }

    const pairings = [];
    for (let i = 0; i < winners.length; i += 2) {
      pairings.push([winners[i], winners[i + 1]]);
    }

    const created = await cupKnockout.insertKnockoutRound(
      client,
      tournamentId,
      pairings,
      formatoMataMata,
      nextPhase
    );

    let thirdPlaceMatchIds = [];
    if (latest.phase === 'sf') {
      const thirdPlacePairings = cupKnockout.buildThirdPlacePairing(winnersRes.rows);
      if (thirdPlacePairings.length > 0) {
        thirdPlaceMatchIds = await cupKnockout.insertKnockoutRound(
          client,
          tournamentId,
          thirdPlacePairings,
          formatoMataMata,
          '3p'
        );
      }
    }

    await client.query('COMMIT');

    const extra =
      thirdPlaceMatchIds.length > 0 ? ' Disputa de 3º lugar também gerada.' : '';

    return res.status(200).json({
      message: `Rodada ${nextPhase} gerada com sucesso!${extra}`,
      phase: nextPhase,
      qtdConfrontos: created.length,
      qtdThirdPlace: thirdPlaceMatchIds.length,
      matchIds: [...created, ...thirdPlaceMatchIds]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return res.status(500).json({ error: 'Erro ao avançar mata-mata.' });
  } finally {
    client.release();
  }
});

app.post('/generateThirdPlace', auth, async (req, res) => {
  const tournamentId = parsePositiveInt(req.body.tournamentId);
  if (!tournamentId) return res.status(400).json({ error: 'tournamentId inválido.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tournamentRes = await client.query(
      'SELECT formatoMataMata FROM tournaments WHERE id = $1 FOR UPDATE',
      [tournamentId]
    );
    if (tournamentRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Torneio não encontrado.' });
    }
    const formatoMataMata =
      tournamentRes.rows[0].formatomatamata ?? tournamentRes.rows[0].formatoMataMata;

    const existing3p = await client.query(
      `SELECT COUNT(*)::int AS n FROM tournament_matches
       WHERE tournament_id = $1 AND phase = '3p'`,
      [tournamentId]
    );
    if (existing3p.rows[0].n > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'A disputa de 3º lugar já existe.' });
    }

    const hasFinal = await client.query(
      `SELECT COUNT(*)::int AS n FROM tournament_matches
       WHERE tournament_id = $1 AND phase = 'final'`,
      [tournamentId]
    );
    if (hasFinal.rows[0].n === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'A final ainda não foi gerada.' });
    }

    const sfRes = await client.query(
      `
      SELECT player_a_id, player_b_id, winner_id
      FROM tournament_matches
      WHERE tournament_id = $1 AND phase = 'sf' AND winner_id IS NOT NULL
      ORDER BY id
      `,
      [tournamentId]
    );
    if (sfRes.rows.length < 2) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Semifinais incompletas ou inexistentes.' });
    }

    const thirdPlacePairings = cupKnockout.buildThirdPlacePairing(sfRes.rows);
    if (thirdPlacePairings.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Não foi possível montar a disputa de 3º lugar.' });
    }

    const created = await cupKnockout.insertKnockoutRound(
      client,
      tournamentId,
      thirdPlacePairings,
      formatoMataMata,
      '3p'
    );

    await client.query('COMMIT');

    return res.status(200).json({
      message: 'Disputa de 3º lugar gerada com sucesso!',
      phase: '3p',
      qtdConfrontos: created.length,
      matchIds: created
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return res.status(500).json({ error: 'Erro ao gerar disputa de 3º lugar.' });
  } finally {
    client.release();
  }
});

app.put('/updateTournamentMatch/:matchId', auth, async (req, res) => {
  const matchId = parsePositiveInt(req.params.matchId);
  if (!matchId) return res.status(400).json({ error: 'matchId inválido.' });

  const { winnerPlayerId, scoreA, scoreB, clearResult } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const matchRes = await client.query(
      'SELECT * FROM tournament_matches WHERE id = $1 FOR UPDATE',
      [matchId]
    );
    if (matchRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Confronto não encontrado.' });
    }

    const match = matchRes.rows[0];
    const tournamentId = match.tournament_id;

    if (clearResult) {
      await client.query(
        `
        UPDATE tournament_matches
        SET winner_id = NULL, score_a = 0, score_b = 0, ended_at = NULL
        WHERE id = $1
        `,
        [matchId]
      );
      await client.query(
        'UPDATE tournament_games SET winner_id = NULL WHERE match_id = $1',
        [matchId]
      );
    } else {
      const parsedScoreA = scoreA !== undefined ? parseInt(scoreA, 10) : match.score_a;
      const parsedScoreB = scoreB !== undefined ? parseInt(scoreB, 10) : match.score_b;

      if (!Number.isFinite(parsedScoreA) || !Number.isFinite(parsedScoreB)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'scoreA e scoreB devem ser números válidos.' });
      }

      const winnerId = parsePositiveInt(winnerPlayerId);
      if (!winnerId) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'winnerPlayerId inválido.' });
      }
      if (winnerId !== match.player_a_id && winnerId !== match.player_b_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Vencedor deve ser um dos jogadores do confronto.' });
      }

      const loserId = winnerId === match.player_a_id ? match.player_b_id : match.player_a_id;
      const winnerScore = winnerId === match.player_a_id ? parsedScoreA : parsedScoreB;
      const loserScore = winnerId === match.player_a_id ? parsedScoreB : parsedScoreA;

      if (loserScore !== 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'O perdedor deve ter placar 0.' });
      }
      if (winnerScore < 0 || (winnerScore > 6 && winnerScore !== 10)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Placar do vencedor: 0–6 (vivos) ou 10 (W.O.).' });
      }

      await client.query(
        `
        UPDATE tournament_matches
        SET winner_id = $1, score_a = $2, score_b = $3, ended_at = NOW()
        WHERE id = $4
        `,
        [winnerId, parsedScoreA, parsedScoreB, matchId]
      );

      await client.query(
        `
        UPDATE tournament_games
        SET winner_id = $1
        WHERE match_id = $2 AND game_number = 1
        `,
        [winnerId, matchId]
      );
    }

    if (match.phase === 'groups') {
      await cupKnockout.rebuildParticipantStats(client, tournamentId);
      const tournamentRes = await client.query(
        'SELECT qtdClassificados FROM tournaments WHERE id = $1',
        [tournamentId]
      );
      const qtdClassificados =
        tournamentRes.rows[0]?.qtdclassificados ??
        tournamentRes.rows[0]?.qtdClassificados ??
        2;
      const { standings } = await cupKnockout.fetchGroupStandings(
        client,
        tournamentId,
        qtdClassificados
      );
      for (const row of standings) {
        await client.query(
          'UPDATE participants SET posicao = $1 WHERE id = $2',
          [row.posicao, row.participant_id]
        );
      }
    }

    await client.query('COMMIT');

    const updated = await pool.query(
      `
      SELECT
        tm.*,
        pa.name AS player_a_name,
        pb.name AS player_b_name,
        pw.name AS winner_name
      FROM tournament_matches tm
      JOIN players pa ON pa.id = tm.player_a_id
      JOIN players pb ON pb.id = tm.player_b_id
      LEFT JOIN players pw ON pw.id = tm.winner_id
      WHERE tm.id = $1
      `,
      [matchId]
    );

    return res.status(200).json({
      message: clearResult ? 'Resultado removido.' : 'Confronto atualizado.',
      match: updated.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return res.status(500).json({ error: 'Erro ao atualizar confronto.' });
  } finally {
    client.release();
  }
});

app.post('/login', async (req, res) => {
  const { user, password } = req.body;

  if (!user || !password) {
    return res.status(400).json({ error: 'Usuário e senha obrigatórios.' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM usuarios WHERE "user" = $1 LIMIT 1',
      [user]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
    }

    const usuario = result.rows[0];

    if (password !== usuario.password) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
    }

    const token = jwt.sign(
      {
        id: usuario.id,
        user: usuario.user,
        admin: usuario.admin
      },
      process.env.JWT_SECRET,
      { expiresIn: '36h' }
    );

    await pool.query(
      `
      INSERT INTO tokens (usuarios_id, token)
      VALUES ($1, $2)
      `,
      [usuario.id, token]
    );

    await pool.query(
      'UPDATE usuarios SET last_login = NOW() WHERE id = $1',
      [usuario.id]
    );

    return res.status(200).json({
      success: true,
      token
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno no login.' });
  }
});

app.get('/getTrainers', auth, async (req, res) => {
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
        tournamentGen: trainer.tournament_gen,
        teamImage: trainer.team_image,
        pokemonList: pokemonList.filter(Boolean)
      };
    });

    return res.status(200).json(trainers);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao consultar jogadores.' });
  }
});


app.delete('/deleteTrainers/:trainerId', auth, async (req, res) => {
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

app.post('/submitPrizes', auth, async (req, res) => {
  const { id, nome, codigo, playerId, pokemonList } = req.body;

  if (!nome || !codigo || !Array.isArray(pokemonList) || pokemonList.length === 0)
    return res.status(400).json({ error: 'Campos obrigatórios faltando ou lista de Pokémon vazia.' });

  if (!playerId)
    return res.status(400).json({ error: 'playerId é obrigatório.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: playerExists } = await client.query(
      'SELECT id FROM players WHERE id=$1',
      [playerId]
    );
    if (playerExists.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Jogador com ID ${playerId} não encontrado.` });
    }

    const pokeIds = pokemonList.map(p => p.id);
    const pokeQuery = `
      SELECT id, af FROM pokemons WHERE id = ANY($1)
    `;
    const { rows: existingPokemons } = await client.query(pokeQuery, [pokeIds]);

    const foundIds = existingPokemons.map(p => p.id);
    const missing = pokeIds.filter(id => !foundIds.includes(id));
    if (missing.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Pokémons não encontrados: ${missing.join(', ')}` });
    }

    let prizeId = id;

    if (id) {
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

      await client.query('DELETE FROM prizes_list WHERE prizes_id=$1', [id]);
    } else {
      const insertQuery = `
        INSERT INTO prizes_config (nome, codigo, player_id)
        VALUES ($1, $2, $3)
        RETURNING id
      `;
      const result = await client.query(insertQuery, [nome, codigo, playerId]);
      prizeId = result.rows[0].id;
    }

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

app.get('/getPrizes', auth, async (req, res) => {
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

app.get('/players/:name/prize-pokemons', async (req, res) => {
  const rawName = req.params.name;
  const playerName = typeof rawName === 'string' ? rawName.trim() : '';

  if (!playerName) {
    return res.status(400).json({ error: 'Nome do jogador é obrigatório.' });
  }

  try {
    const playerResult = await pool.query(
      'SELECT id, name FROM players WHERE LOWER(name) = LOWER($1) LIMIT 1',
      [playerName]
    );

    if (playerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Jogador não encontrado' });
    }

    const player = playerResult.rows[0];
    const transactionsResult = await pool.query(
      `
      SELECT
        si.id AS item_id,
        si.pokemon_name,
        si.generation,
        st.purchased_at,
        si.options_poke,
        st.delivered
      FROM shop_transactions st
      JOIN shop_items si ON st.item_id = si.id
      WHERE st.player_id = $1
      ORDER BY st.purchased_at DESC
      `,
      [player.id]
    );

    return res.status(200).json({
      player_id: player.id,
      player_name: player.name,
      prize_pokemons: transactionsResult.rows.map(t => ({
        item_id: t.item_id,
        pokemon_name: t.pokemon_name,
        generation: t.generation,
        options_poke: t.options_poke,
        purchased_at: t.purchased_at ? new Date(t.purchased_at).toISOString() : null,
        delivered: t.delivered
      }))
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar pokémons de prêmio do jogador.' });
  }
});

app.get('/pokemons', async (req, res) => {
  try {
    const gen = req.query.gen ? parseInt(req.query.gen, 10) : null;

    if (gen !== null && isNaN(gen)) {
      return res.status(400).json({ error: 'Parâmetro gen inválido.' });
    }

    let query = 'SELECT id, name, type, gen, af FROM pokemons';
    const values = [];

    if (gen !== null) {
      query += ' WHERE gen = $1';
      values.push(gen);
    }

    query += ' ORDER BY id';

    const result = await pool.query(query, values);

    const pokemons = result.rows.map(p => ({
      ...p,
      type: Array.isArray(p.type) ? p.type : JSON.parse(p.type || '[]')
    }));

    return res.status(200).json(pokemons);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar Pokémon.' });
  }
});




app.use((err, _req, res, next) => {
  if (err && err.name === 'MulterError') {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'Imagem muito grande. Máximo 5 MB.'
      : 'Erro no upload da imagem.';
    return res.status(400).json({ error: message });
  }
  if (err) {
    return res.status(400).json({ error: err.message || 'Erro na requisição.' });
  }
  return next();
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Servidor rodando na porta ${port}`));
