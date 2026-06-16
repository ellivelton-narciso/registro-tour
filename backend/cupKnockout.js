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

function buildKnockoutPairings(qualifiedByGroup, groupLabels, qtdClassificados) {
  const pairings = [];

  if (qtdClassificados === 1) {
    const firsts = groupLabels
      .map((g) => qualifiedByGroup[g]?.[0])
      .filter(Boolean);
    for (let i = 0; i < firsts.length; i += 2) {
      if (firsts[i + 1]) {
        pairings.push([firsts[i].players_id, firsts[i + 1].players_id]);
      }
    }
    return pairings;
  }

  if (qtdClassificados === 2) {
  // 1º grupo N x 2º grupo N+1 (circular: D→A)
    const n = groupLabels.length;
    for (let i = 0; i < n; i++) {
      const g1 = groupLabels[i];
      const g2 = groupLabels[(i + 1) % n];

      const q1 = qualifiedByGroup[g1] || [];
      const q2 = qualifiedByGroup[g2] || [];

      if (q1[0] && q2[1]) pairings.push([q1[0].players_id, q2[1].players_id]);
    }
    return pairings;
  }

  const all = [];
  for (const g of groupLabels) {
    for (const q of qualifiedByGroup[g] || []) {
      all.push(q);
    }
  }
  all.sort((a, b) => a.posicao - b.posicao || String(a.grupo).localeCompare(String(b.grupo)));

  for (let i = 0; i < all.length; i += 2) {
    if (all[i + 1]) {
      pairings.push([all[i].players_id, all[i + 1].players_id]);
    }
  }

  return pairings;
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

module.exports = {
  saldoDeltaForWinnerAlive,
  ALPHABET,
  KNOCKOUT_PHASE_ORDER,
  isPowerOfTwo,
  knockoutPhaseForPlayers,
  nextKnockoutPhase,
  phaseSortKey,
  buildKnockoutPairings,
  fetchGroupStandings,
  rebuildParticipantStats,
  insertKnockoutRound
};
