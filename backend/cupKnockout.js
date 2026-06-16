const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const WO_SALDO_DELTA = 3;

function saldoDeltaForWinnerAlive(winnerAlive) {
  const score = Number(winnerAlive);
  if (!Number.isFinite(score)) return 0;
  return score > 6 ? WO_SALDO_DELTA : score;
}

const KNOCKOUT_PHASE_ORDER = {
  r16: 1,
  qf: 2,
  sf: 3,
  final: 4
};

function isPowerOfTwo(n) {
  return n > 0 && (n & (n - 1)) === 0;
}

function nextPowerOfTwo(n) {
  if (n <= 1) return 1;
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

function knockoutPhaseForPlayers(count) {
  if (count === 2) return 'final';
  if (count === 4) return 'sf';
  if (count === 8) return 'qf';
  if (count === 16) return 'r16';
  return null;
}

function nextKnockoutPhase(phase) {
  const map = { r16: 'qf', qf: 'sf', sf: 'final' };
  return map[phase] || null;
}

function phaseSortKey(phase) {
  if (phase === 'groups') return 0;
  return KNOCKOUT_PHASE_ORDER[phase] ?? 99;
}

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildKnockoutRound(qualifiedByGroup, groupLabels, qtdClassificados) {
  if (qtdClassificados !== 2) {
    return { pairings: [], byes: [], totalSlots: 0, playerCount: 0 };
  }

  const groupEntries = [];
  for (const group of groupLabels) {
    const qualified = qualifiedByGroup[group] || [];
    if (!qualified[0] || !qualified[1]) continue;
    groupEntries.push({
      group,
      leftPlayerId: qualified[0].players_id,
      rightPlayerId: qualified[1].players_id
    });
  }

  const playerCount = groupEntries.length * 2;
  if (playerCount < 2) {
    return { pairings: [], byes: [], totalSlots: 0, playerCount };
  }

  const totalSlots = nextPowerOfTwo(playerCount);
  const halfSlots = totalSlots / 2;

  const leftSide = shuffle(groupEntries.map((e) => e.leftPlayerId));
  const rightSide = shuffle(groupEntries.map((e) => e.rightPlayerId));

  while (leftSide.length < halfSlots) leftSide.push(null);
  while (rightSide.length < halfSlots) rightSide.push(null);

  const bracket = [...leftSide, ...rightSide];
  const pairings = [];
  const byes = [];

  for (let i = 0; i < bracket.length; i += 2) {
    const a = bracket[i];
    const b = bracket[i + 1];
    if (a && b) {
      pairings.push([a, b]);
    } else if (a || b) {
      byes.push(a || b);
    }
  }

  return { pairings, byes, totalSlots, playerCount };
}

function buildKnockoutPairings(qualifiedByGroup, groupLabels, qtdClassificados) {
  return buildKnockoutRound(qualifiedByGroup, groupLabels, qtdClassificados).pairings;
}

async function fetchGroupStandings(client, tournamentId, qtdClassificados) {
  const { rows } = await client.query(
    `
    SELECT
      pa.id AS participant_id,
      pa.players_id,
      pa.grupo,
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
      AND pa.grupo IS NOT NULL
    ORDER BY pa.grupo, pa.pontos DESC, pa.saldo DESC, pa.vitorias DESC, p.name
    `,
    [tournamentId]
  );

  const byGroup = {};
  for (const row of rows) {
    const g = String(row.grupo).trim();
    if (!byGroup[g]) byGroup[g] = [];
    byGroup[g].push(row);
  }

  const groupLabels = Object.keys(byGroup).sort();
  const qualifiedByGroup = {};
  const standings = [];

  for (const g of groupLabels) {
    const members = byGroup[g];
    members.forEach((m, idx) => {
      m.posicao = idx + 1;
      standings.push(m);
    });
    qualifiedByGroup[g] = members.slice(0, qtdClassificados);
  }

  return { standings, qualifiedByGroup, groupLabels };
}

async function rebuildParticipantStats(client, tournamentId) {
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
      AND phase = 'groups'
      AND winner_id IS NOT NULL
    ORDER BY id
    `,
    [tournamentId]
  );

  for (const m of rows) {
    const winnerId = m.winner_id;
    const loserId = winnerId === m.player_a_id ? m.player_b_id : m.player_a_id;
    const winnerAlive = winnerId === m.player_a_id ? m.score_a : m.score_b;
    const saldoDelta = saldoDeltaForWinnerAlive(winnerAlive);

    await client.query(
      `
      UPDATE participants
      SET
        pontos = pontos + 3,
        vitorias = vitorias + 1,
        saldo = saldo + $1
      WHERE tournaments_id = $2 AND players_id = $3
      `,
      [saldoDelta, tournamentId, winnerId]
    );

    await client.query(
      `
      UPDATE participants
      SET
        derrotas = derrotas + 1,
        saldo = saldo - $1
      WHERE tournaments_id = $2 AND players_id = $3
      `,
      [saldoDelta, tournamentId, loserId]
    );
  }
}

async function insertKnockoutRound(client, tournamentId, pairings, bestOf, phase) {
  const created = [];

  for (const [playerAId, playerBId] of pairings) {
    const insertRes = await client.query(
      `
      INSERT INTO tournament_matches (
        tournament_id, player_a_id, player_b_id, winner_id,
        phase, best_of, score_a, score_b, grupo
      )
      VALUES ($1, $2, $3, NULL, $4, $5, 0, 0, NULL)
      RETURNING id
      `,
      [tournamentId, playerAId, playerBId, phase, bestOf]
    );

    const matchId = insertRes.rows[0].id;
    created.push(matchId);

    await client.query(
      `
      INSERT INTO tournament_games (match_id, game_number)
      SELECT $1, gs FROM generate_series(1, $2) AS gs
      `,
      [matchId, bestOf]
    );
  }

  return created;
}

async function insertKnockoutByes(client, tournamentId, byes, phase) {
  const created = [];

  for (const playerId of byes) {
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
    created.push(insertRes.rows[0].id);
  }

  return created;
}

module.exports = {
  saldoDeltaForWinnerAlive,
  ALPHABET,
  KNOCKOUT_PHASE_ORDER,
  isPowerOfTwo,
  nextPowerOfTwo,
  knockoutPhaseForPlayers,
  nextKnockoutPhase,
  phaseSortKey,
  buildKnockoutRound,
  buildKnockoutPairings,
  fetchGroupStandings,
  rebuildParticipantStats,
  insertKnockoutRound,
  insertKnockoutByes
};
