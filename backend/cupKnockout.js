const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const WO_SALDO_DELTA = 3;

function saldoDeltaForWinnerAlive(winnerAlive) {
  const score = Number(winnerAlive);
  if (!Number.isFinite(score)) return 0;
  return score > 6 ? WO_SALDO_DELTA : score;
}

const KNOCKOUT_PHASE_ORDER = {
  r128: 1,
  r64: 2,
  r32: 3,
  r16: 4,
  qf: 5,
  sf: 6,
  '3p': 7,
  final: 8
};

const KNOCKOUT_PHASE_LABELS = {
  r128: 'Round 128',
  r64: 'Round 64',
  r32: 'Round 32',
  r16: 'Oitavas',
  qf: 'Quartas',
  sf: 'Semifinal',
  '3p': '3º lugar',
  final: 'Final'
};

const KNOCKOUT_ROUND_CHAIN = ['r128', 'r64', 'r32', 'r16', 'qf', 'sf', 'final'];

function isPowerOfTwo(n) {
  return n > 0 && (n & (n - 1)) === 0;
}

function nextPowerOfTwo(n) {
  if (n <= 1) return 1;
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

function knockoutPhaseForBracketSize(totalSlots) {
  if (!Number.isFinite(totalSlots) || totalSlots < 2) return null;
  const depth = Math.round(Math.log2(totalSlots));
  const phases = ['final', 'sf', 'qf', 'r16', 'r32', 'r64', 'r128'];
  const index = depth - 1;
  return phases[index] || null;
}

function knockoutPhaseForPlayers(count) {
  return knockoutPhaseForBracketSize(nextPowerOfTwo(count));
}

function nextKnockoutPhase(phase) {
  const idx = KNOCKOUT_ROUND_CHAIN.indexOf(phase);
  if (idx === -1 || idx >= KNOCKOUT_ROUND_CHAIN.length - 1) return null;
  return KNOCKOUT_ROUND_CHAIN[idx + 1];
}

function isByeMatch(match) {
  return (
    match.player_a_id != null &&
    match.player_b_id != null &&
    match.player_a_id === match.player_b_id
  );
}

function buildThirdPlacePairing(semifinalMatches) {
  const realMatches = semifinalMatches.filter((match) => !isByeMatch(match));
  const losers = realMatches.map((match) =>
    match.winner_id === match.player_a_id ? match.player_b_id : match.player_a_id
  );
  if (losers.length !== 2) return [];
  return [[losers[0], losers[1]]];
}

function buildAdvanceKnockoutRound(winnerIds) {
  const winners = [...winnerIds];
  if (winners.length < 2) {
    return { pairings: [], byes: [], playerCount: winners.length };
  }

  const pairings = [];
  const byes = [];
  for (let i = 0; i < winners.length; i += 2) {
    if (i + 1 < winners.length) {
      pairings.push([winners[i], winners[i + 1]]);
    } else {
      byes.push(winners[i]);
    }
  }

  return { pairings, byes, playerCount: winners.length };
}

function phaseSortKey(phase) {
  if (phase === 'groups') return 0;
  if (typeof phase === 'string' && phase.startsWith('swiss_')) {
    const round = parseInt(phase.replace('swiss_', ''), 10);
    return Number.isFinite(round) ? round * 0.01 : 0.5;
  }
  return KNOCKOUT_PHASE_ORDER[phase] ?? 99;
}

function isKnockoutPhase(phase) {
  return phase !== 'groups' && !(typeof phase === 'string' && phase.startsWith('swiss_'));
}

function generateSeedOrder(totalSlots) {
  if (totalSlots <= 1) return [1];
  if (totalSlots === 2) return [1, 2];
  const half = generateSeedOrder(totalSlots / 2);
  const result = [];
  for (const seed of half) {
    result.push(seed);
    result.push(totalSlots + 1 - seed);
  }
  return result;
}

function buildSeededKnockoutRound(rankedPlayerIds) {
  const playerCount = rankedPlayerIds.length;
  if (playerCount < 2) {
    return { pairings: [], byes: [], totalSlots: 0, playerCount };
  }

  const totalSlots = nextPowerOfTwo(playerCount);
  const seedOrder = generateSeedOrder(totalSlots);
  const bracket = seedOrder.map((seed) => rankedPlayerIds[seed - 1] ?? null);

  const pairings = [];
  const byes = [];
  for (let i = 0; i < bracket.length; i += 2) {
    const a = bracket[i];
    const b = bracket[i + 1];
    if (a && b) pairings.push([a, b]);
    else if (a || b) byes.push(a || b);
  }

  return { pairings, byes, totalSlots, playerCount };
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

function buildDirectKnockoutRound(playerIds) {
  return buildSeededKnockoutRound(shuffle(playerIds));
}

async function fetchAllParticipantPlayerIds(client, tournamentId) {
  const { rows } = await client.query(
    `
    SELECT players_id
    FROM participants
    WHERE tournaments_id = $1
    ORDER BY id
    `,
    [tournamentId]
  );
  return rows.map((row) => row.players_id);
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
  KNOCKOUT_PHASE_LABELS,
  KNOCKOUT_ROUND_CHAIN,
  isPowerOfTwo,
  nextPowerOfTwo,
  knockoutPhaseForBracketSize,
  knockoutPhaseForPlayers,
  nextKnockoutPhase,
  phaseSortKey,
  buildKnockoutRound,
  buildKnockoutPairings,
  buildDirectKnockoutRound,
  fetchAllParticipantPlayerIds,
  fetchGroupStandings,
  rebuildParticipantStats,
  insertKnockoutRound,
  insertKnockoutByes,
  buildThirdPlacePairing,
  buildAdvanceKnockoutRound,
  isByeMatch,
  isKnockoutPhase,
  buildSeededKnockoutRound
};
