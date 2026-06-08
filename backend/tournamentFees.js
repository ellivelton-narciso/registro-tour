const WO_WINNER_SCORE = 10;
const MIN_WO_FOR_DOUBLE_FEE = 2;

async function getPreviousTournamentId(client, currentTournamentId) {
  const res = await client.query(
    `
    SELECT prev.id
    FROM tournaments current
    JOIN tournaments prev
      ON prev.dateStart < current.dateStart
      OR (prev.dateStart = current.dateStart AND prev.id < current.id)
    WHERE current.id = $1
    ORDER BY prev.dateStart DESC, prev.id DESC
    LIMIT 1
    `,
    [currentTournamentId]
  );

  return res.rows[0]?.id ?? null;
}

async function countWalkoverLosses(client, tournamentId, playerId) {
  const res = await client.query(
    `
    SELECT COUNT(*)::int AS n
    FROM tournament_matches
    WHERE tournament_id = $1
      AND winner_id IS NOT NULL
      AND (
        (player_a_id = $2 AND winner_id = player_b_id AND score_b = $3)
        OR (player_b_id = $2 AND winner_id = player_a_id AND score_a = $3)
      )
    `,
    [tournamentId, playerId, WO_WINNER_SCORE]
  );

  return res.rows[0]?.n ?? 0;
}

async function resolveRegistrationFee(client, tournamentId, playerId, baseFee) {
  const parsedBase = Number(baseFee) || 0;
  const previousTournamentId = await getPreviousTournamentId(client, tournamentId);

  if (!previousTournamentId) {
    return {
      fee: parsedBase,
      doubled: false,
      woCount: 0,
      previousTournamentId: null
    };
  }

  const woCount = await countWalkoverLosses(client, previousTournamentId, playerId);
  const doubled = woCount >= MIN_WO_FOR_DOUBLE_FEE;

  return {
    fee: doubled ? parsedBase * 2 : parsedBase,
    doubled,
    woCount,
    previousTournamentId
  };
}

module.exports = {
  WO_WINNER_SCORE,
  MIN_WO_FOR_DOUBLE_FEE,
  getPreviousTournamentId,
  countWalkoverLosses,
  resolveRegistrationFee
};
