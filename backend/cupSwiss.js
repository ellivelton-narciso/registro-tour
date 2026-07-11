const { shuffle, saldoDeltaForWinnerAlive } = require('./cupKnockout');

function swissPhaseName(round) {
  return `swiss_${round}`;
}

function isSwissPhase(phase) {
  return typeof phase === 'string' && phase.startsWith('swiss_');
}

function swissRoundFromPhase(phase) {
  if (!isSwissPhase(phase)) return 0;
  const n = parseInt(phase.replace('swiss_', ''), 10);
  return Number.isFinite(n) ? n : 0;
}

function recommendedSwissRounds(playerCount) {
  if (playerCount < 2) return 0;
  const calculated = Math.ceil(Math.log2(playerCount));
  return Math.max(3, Math.min(calculated, 7));
}

function resolveSwissRounds(playerCount, configured) {
  const parsed = Number(configured);
  if (Number.isFinite(parsed) && parsed > 0) return Math.min(parsed, 12);
  return recommendedSwissRounds(playerCount);
}

function compareStandings(a, b) {
  if (b.pontos !== a.pontos) return b.pontos - a.pontos;
  if (b.saldo !== a.saldo) return b.saldo - a.saldo;
  if (b.vitorias !== a.vitorias) return b.vitorias - a.vitorias;
  return String(a.name).localeCompare(String(b.name), 'pt-BR');
}

function pairKey(a, b) {
  const x = Math.min(a, b);
  const y = Math.max(a, b);
  return `${x}-${y}`;
}

function pairSwissRound1(playerIds) {
  const shuffled = shuffle(playerIds);
  const pairings = [];
  let bye = null;

  for (let i = 0; i < shuffled.length; i += 2) {
    if (i + 1 < shuffled.length) {
      pairings.push([shuffled[i], shuffled[i + 1]]);
    } else {
      bye = shuffled[i];
    }
  }

  return { pairings, bye };
}

function pairSwissRoundNext(standings, playedPairs) {
  const sorted = [...standings].sort(compareStandings);
  const paired = new Set();
  const pairings = [];

  for (let i = 0; i < sorted.length; i++) {
    const player = sorted[i];
    if (paired.has(player.players_id)) continue;

    let opponent = null;
    for (let j = i + 1; j < sorted.length; j++) {
      const candidate = sorted[j];
      if (paired.has(candidate.players_id)) continue;
      const key = pairKey(player.players_id, candidate.players_id);
      if (!playedPairs.has(key)) {
        opponent = candidate;
        break;
      }
    }

    if (!opponent) {
      for (let j = i + 1; j < sorted.length; j++) {
        const candidate = sorted[j];
        if (paired.has(candidate.players_id)) continue;
        opponent = candidate;
        break;
      }
    }

    if (opponent) {
      pairings.push([player.players_id, opponent.players_id]);
      paired.add(player.players_id);
      paired.add(opponent.players_id);
    }
  }

  const unpaired = sorted.filter((row) => !paired.has(row.players_id));
  const bye = unpaired.length === 1 ? unpaired[0].players_id : null;

  return { pairings, bye };
}

async function fetchPlayedPairs(client, tournamentId) {
  const { rows } = await client.query(
    `
    SELECT player_a_id, player_b_id
    FROM tournament_matches
    WHERE tournament_id = $1
      AND phase LIKE 'swiss_%'
      AND player_a_id IS NOT NULL
      AND player_b_id IS NOT NULL
      AND player_a_id <> player_b_id
    `,
    [tournamentId]
  );

  const played = new Set();
  for (const row of rows) {
    played.add(pairKey(row.player_a_id, row.player_b_id));
  }
  return played;
}

async function fetchSwissParticipantRows(client, tournamentId) {
  const { rows } = await client.query(
    `
    SELECT
      pa.id AS participant_id,
      pa.players_id,
      pa.pontos,
      pa.vitorias,
      pa.derrotas,
      pa.empates,
      pa.saldo,
      pa.posicao,
      p.name
    FROM participants pa
    JOIN players p ON p.id = pa.players_id
    WHERE pa.tournaments_id = $1
    ORDER BY pa.pontos DESC, pa.saldo DESC, pa.vitorias DESC, p.name
    `,
    [tournamentId]
  );
  return rows;
}

async function fetchSwissStandings(client, tournamentId, qtdClassificados) {
  const rows = await fetchSwissParticipantRows(client, tournamentId);
  const standings = rows.map((row, idx) => ({
    ...row,
    posicao: idx + 1,
    grupo: 'Suíço'
  }));
  const qualified = standings.slice(0, qtdClassificados);
  return { standings, qualified };
}

async function rebuildSwissStats(client, tournamentId) {
  await client.query(
    `
    UPDATE participants
    SET pontos = 0, vitorias = 0, derrotas = 0, empates = 0, saldo = 0, posicao = NULL
    WHERE tournaments_id = $1
    `,
    [tournamentId]
  );

  const { rows } = await client.query(
    `
    SELECT player_a_id, player_b_id, winner_id, score_a, score_b
    FROM tournament_matches
    WHERE tournament_id = $1
      AND phase LIKE 'swiss_%'
      AND winner_id IS NOT NULL
    ORDER BY id
    `,
    [tournamentId]
  );

  for (const m of rows) {
    const isBye = m.player_a_id === m.player_b_id;
    if (isBye) {
      const saldoDelta = 3;
      await client.query(
        `
        UPDATE participants
        SET pontos = pontos + 3, vitorias = vitorias + 1, saldo = saldo + $1
        WHERE tournaments_id = $2 AND players_id = $3
        `,
        [saldoDelta, tournamentId, m.winner_id]
      );
      continue;
    }

    const winnerId = m.winner_id;
    const loserId = winnerId === m.player_a_id ? m.player_b_id : m.player_a_id;
    const winnerAlive = winnerId === m.player_a_id ? m.score_a : m.score_b;
    const saldoDelta = saldoDeltaForWinnerAlive(winnerAlive);

    await client.query(
      `
      UPDATE participants
      SET pontos = pontos + 3, vitorias = vitorias + 1, saldo = saldo + $1
      WHERE tournaments_id = $2 AND players_id = $3
      `,
      [saldoDelta, tournamentId, winnerId]
    );

    await client.query(
      `
      UPDATE participants
      SET derrotas = derrotas + 1, saldo = saldo - $1
      WHERE tournaments_id = $2 AND players_id = $3
      `,
      [saldoDelta, tournamentId, loserId]
    );
  }

  const standings = await fetchSwissParticipantRows(client, tournamentId);
  standings.sort(compareStandings);
  for (let i = 0; i < standings.length; i++) {
    await client.query(
      'UPDATE participants SET posicao = $1 WHERE id = $2',
      [i + 1, standings[i].participant_id]
    );
  }
}

async function getSwissState(client, tournamentId) {
  const roundsRes = await client.query(
    `
    SELECT phase,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE winner_id IS NOT NULL)::int AS completed
    FROM tournament_matches
    WHERE tournament_id = $1 AND phase LIKE 'swiss_%'
    GROUP BY phase
    ORDER BY phase
    `,
    [tournamentId]
  );

  const rounds = roundsRes.rows.map((row) => ({
    phase: row.phase,
    round: swissRoundFromPhase(row.phase),
    total: row.total,
    completed: row.completed,
    pending: row.total - row.completed,
    complete: row.total > 0 && row.completed === row.total
  }));

  const currentRound = rounds.length ? rounds[rounds.length - 1].round : 0;
  const latest = rounds[rounds.length - 1] || null;
  const hasSwiss = rounds.length > 0;
  const latestComplete = latest ? latest.complete : false;

  return {
    rounds,
    currentRound,
    hasSwiss,
    latestComplete,
    nextRound: hasSwiss ? (latestComplete ? currentRound + 1 : currentRound) : 1
  };
}

async function insertSwissMatch(client, tournamentId, playerAId, playerBId, phase) {
  const insertRes = await client.query(
    `
    INSERT INTO tournament_matches (
      tournament_id, player_a_id, player_b_id, winner_id,
      phase, best_of, score_a, score_b, grupo
    )
    VALUES ($1, $2, $3, NULL, $4, 1, 0, 0, NULL)
    RETURNING id
    `,
    [tournamentId, playerAId, playerBId, phase]
  );
  const matchId = insertRes.rows[0].id;
  await client.query(
    'INSERT INTO tournament_games (match_id, game_number) VALUES ($1, 1)',
    [matchId]
  );
  return matchId;
}

async function insertSwissBye(client, tournamentId, playerId, phase) {
  const insertRes = await client.query(
    `
    INSERT INTO tournament_matches (
      tournament_id, player_a_id, player_b_id, winner_id,
      phase, best_of, score_a, score_b, grupo, ended_at
    )
    VALUES ($1, $2, $2, $2, $3, 1, 1, 0, NULL, CURRENT_TIMESTAMP)
    RETURNING id
    `,
    [tournamentId, playerId, phase]
  );
  const matchId = insertRes.rows[0].id;
  await client.query(
    'INSERT INTO tournament_games (match_id, game_number) VALUES ($1, 1)',
    [matchId]
  );
  return matchId;
}

module.exports = {
  swissPhaseName,
  isSwissPhase,
  swissRoundFromPhase,
  recommendedSwissRounds,
  resolveSwissRounds,
  pairSwissRound1,
  pairSwissRoundNext,
  fetchPlayedPairs,
  fetchSwissStandings,
  rebuildSwissStats,
  getSwissState,
  insertSwissMatch,
  insertSwissBye
};
