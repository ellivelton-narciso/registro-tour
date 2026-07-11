export const SWISS_MIN_ROUNDS = 3;
export const SWISS_MAX_ROUNDS = 15;

export function simulateSwissWinTotals(playerCount: number, rounds: number): number[] {
  let buckets = new Map<number, number>([[0, playerCount]]);

  for (let r = 0; r < rounds; r++) {
    const next = new Map<number, number>();
    for (const [wins, count] of buckets) {
      if (!count) continue;
      const bye = count % 2;
      const playing = count - bye;
      const half = playing / 2;
      next.set(wins + 1, (next.get(wins + 1) || 0) + half + bye);
      next.set(wins, (next.get(wins) || 0) + half);
    }
    buckets = next;
  }

  const sorted: number[] = [];
  for (let wins = rounds; wins >= 0; wins--) {
    const count = buckets.get(wins) || 0;
    for (let i = 0; i < count; i++) sorted.push(wins);
  }
  return sorted;
}

export function hasClearQualifyingCut(
  playerCount: number,
  qtdClassificados: number,
  rounds: number
): boolean {
  if (qtdClassificados >= playerCount) return true;
  const sorted = simulateSwissWinTotals(playerCount, rounds);
  if (sorted.length !== playerCount) return false;
  return sorted[qtdClassificados - 1] > sorted[qtdClassificados];
}

export function minimumSwissRounds(playerCount: number, qtdClassificados: number): number {
  if (playerCount < 2) return 0;
  const n = playerCount;
  const k = Math.max(2, Math.min(Number(qtdClassificados) || n, n));
  const poolFloor = Math.ceil(Math.log2(n));

  if (k >= n) {
    return Math.max(SWISS_MIN_ROUNDS, Math.min(poolFloor, SWISS_MAX_ROUNDS));
  }

  const start = Math.max(SWISS_MIN_ROUNDS, poolFloor);
  for (let rounds = start; rounds <= SWISS_MAX_ROUNDS; rounds++) {
    if (hasClearQualifyingCut(n, k, rounds)) return rounds;
  }
  return SWISS_MAX_ROUNDS;
}
