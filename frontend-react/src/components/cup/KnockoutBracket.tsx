import type { TournamentMatch } from '../../api/types';

const PHASE_LABELS: Record<string, string> = {
  r128: 'Round 128',
  r64: 'Round 64',
  r32: 'Round 32',
  r16: 'Oitavas',
  qf: 'Quartas',
  sf: 'Semifinal',
  '3p': '3º lugar',
  final: 'Final',
};

const PHASE_ORDER = ['r128', 'r64', 'r32', 'r16', 'qf', 'sf', '3p', 'final'];

function groupKnockoutMatches(matches: TournamentMatch[]) {
  const byPhase: Record<string, TournamentMatch[]> = {};
  for (const match of matches || []) {
    if (!match || match.phase === 'groups') continue;
    if (!byPhase[match.phase]) byPhase[match.phase] = [];
    byPhase[match.phase].push(match);
  }
  for (const phase of Object.keys(byPhase)) {
    byPhase[phase].sort((a, b) => a.id - b.id);
  }
  return byPhase;
}

function formatScore(match: TournamentMatch, side: 'a' | 'b') {
  const score = side === 'a' ? match.score_a : match.score_b;
  const isSeries = (match.best_of || 1) > 1;
  if (isSeries) {
    if ((match.score_a || 0) > 0 || (match.score_b || 0) > 0 || match.winner_id) return score ?? 0;
    return '—';
  }
  if (match.winner_id) return score ?? 0;
  return '—';
}

/** Altura mínima por linha da 1ª fase (card + badge + folga). */
const ROW_MIN_REM = 5.25;

function matchGridRow(matchIdx: number, matchCount: number, firstCount: number) {
  const start = Math.floor((matchIdx * firstCount) / matchCount) + 1;
  const end = Math.floor(((matchIdx + 1) * firstCount) / matchCount) + 1;
  return `${start} / ${end}`;
}

function MatchCard({ match }: { match: TournamentMatch }) {
  const status = match.winner_id ? 'done' : 'pending';
  const rows = [
    { name: match.player_a_name, id: match.player_a_id, side: 'a' as const },
    { name: match.player_b_name, id: match.player_b_id, side: 'b' as const },
  ];

  return (
    <div className={`cup-bracket-match cup-bracket-match--${status}`} title={`Confronto #${match.id}`}>
      {rows.map((row) => {
        const isWinner = match.winner_id && match.winner_id === row.id;
        const isLoser = match.winner_id && match.winner_id !== row.id;
        return (
          <div
            key={row.id}
            className={`cup-bracket-player${isWinner ? ' is-winner' : ''}${isLoser ? ' is-loser' : ''}${!match.winner_id ? ' is-pending' : ''}`}
          >
            <span className="cup-bracket-name">{row.name || '—'}</span>
            <span className="cup-bracket-score">{formatScore(match, row.side)}</span>
          </div>
        );
      })}
      {match.winner_name && (
        <div className="cup-bracket-winner-badge">
          {match.phase === 'final'
            ? `🏆 ${match.winner_name}`
            : match.phase === '3p'
              ? `🥉 ${match.winner_name}`
              : match.winner_name}
        </div>
      )}
    </div>
  );
}

interface Props {
  matches: TournamentMatch[];
}

export function KnockoutBracket({ matches }: Props) {
  const byPhase = groupKnockoutMatches(matches);
  const phases = PHASE_ORDER.filter((phase) => byPhase[phase]?.length);

  if (!phases.length) return null;

  const firstCount = byPhase[phases[0]].length;
  const slotsMinHeight = `${firstCount * ROW_MIN_REM}rem`;

  return (
    <div className="cup-bracket">
      {phases.map((phase, roundIdx) => {
        const roundMatches = byPhase[phase];
        const matchCount = roundMatches.length;

        return (
          <div key={phase} className="d-flex align-items-stretch">
            <div className="cup-bracket-round">
              <div className="cup-bracket-round-title">{PHASE_LABELS[phase] || phase}</div>
              <div
                className="cup-bracket-slots"
                style={{
                  gridTemplateRows: `repeat(${firstCount}, minmax(${ROW_MIN_REM}rem, 1fr))`,
                  minHeight: slotsMinHeight,
                }}
              >
                {roundMatches.map((match, matchIdx) => (
                  <div
                    key={match.id}
                    className="cup-bracket-slot"
                    style={{ gridRow: matchGridRow(matchIdx, matchCount, firstCount) }}
                  >
                    <MatchCard match={match} />
                  </div>
                ))}
              </div>
            </div>
            {roundIdx < phases.length - 1 && (
              <div className="cup-bracket-arrow" aria-hidden="true">
                ›
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
