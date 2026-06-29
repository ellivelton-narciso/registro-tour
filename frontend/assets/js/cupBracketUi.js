(function (global) {
  const PHASE_LABELS = {
    r128: 'Round 128',
    r64: 'Round 64',
    r32: 'Round 32',
    r16: 'Oitavas',
    qf: 'Quartas',
    sf: 'Semifinal',
    '3p': '3º lugar',
    final: 'Final'
  };

  const PHASE_ORDER = ['r128', 'r64', 'r32', 'r16', 'qf', 'sf', '3p', 'final'];

  function groupKnockoutMatches(matches) {
    const byPhase = {};
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

  function formatScore(match, side) {
    const score = side === 'a' ? match.score_a : match.score_b;
    const isSeries = (match.best_of || 1) > 1;
    if (isSeries) {
      if ((match.score_a || 0) > 0 || (match.score_b || 0) > 0 || match.winner_id) {
        return score ?? 0;
      }
      return '—';
    }
    if (match.winner_id) return score ?? 0;
    return '—';
  }

  function createPlayerRow(name, playerId, match, side) {
    const row = document.createElement('div');
    const isWinner = match.winner_id && match.winner_id === playerId;
    const isLoser = match.winner_id && match.winner_id !== playerId;
    row.className = 'cup-bracket-player';
    if (isWinner) row.classList.add('is-winner');
    if (isLoser) row.classList.add('is-loser');
    if (!match.winner_id) row.classList.add('is-pending');

    row.innerHTML = `
      <span class="cup-bracket-name">${name || '—'}</span>
      <span class="cup-bracket-score">${formatScore(match, side)}</span>
    `;
    return row;
  }

  function createMatchCard(match) {
    const card = document.createElement('div');
    const status = match.winner_id ? 'done' : 'pending';
    card.className = `cup-bracket-match cup-bracket-match--${status}`;
    card.title = `Confronto #${match.id}`;

    card.appendChild(createPlayerRow(match.player_a_name, match.player_a_id, match, 'a'));
    card.appendChild(createPlayerRow(match.player_b_name, match.player_b_id, match, 'b'));

    if (match.winner_name) {
      const badge = document.createElement('div');
      badge.className = 'cup-bracket-winner-badge';
      badge.textContent =
        match.phase === 'final'
          ? `🏆 ${match.winner_name}`
          : match.phase === '3p'
            ? `🥉 ${match.winner_name}`
            : match.winner_name;
      card.appendChild(badge);
    }

    return card;
  }

  function slotMarginTop(roundIdx, matchIdx, unitRem) {
    if (matchIdx === 0) {
      return (Math.pow(2, roundIdx) - 1) * unitRem * 0.5;
    }
    return Math.pow(2, roundIdx) * unitRem;
  }

  function renderBracket(container, matches, options) {
    const { emptyHidden = true } = options || {};
    const byPhase = groupKnockoutMatches(matches);
    const phases = PHASE_ORDER.filter((phase) => byPhase[phase]?.length);

    if (!phases.length) {
      container.innerHTML = '';
      if (emptyHidden) container.classList.add('d-none');
      return false;
    }

    container.classList.remove('d-none');
    const unitRem = 3.25;
    const firstCount = byPhase[phases[0]].length;
    const slotsHeight = firstCount * unitRem * Math.pow(2, 1);

    const bracket = document.createElement('div');
    bracket.className = 'cup-bracket';

    for (let roundIdx = 0; roundIdx < phases.length; roundIdx += 1) {
      const phase = phases[roundIdx];
      const roundMatches = byPhase[phase];

      const col = document.createElement('div');
      col.className = 'cup-bracket-round';

      const title = document.createElement('div');
      title.className = 'cup-bracket-round-title';
      title.textContent = PHASE_LABELS[phase] || phase;
      col.appendChild(title);

      const slots = document.createElement('div');
      slots.className = 'cup-bracket-slots';
      slots.style.minHeight = `${slotsHeight}px`;

      roundMatches.forEach((match, matchIdx) => {
        const slot = document.createElement('div');
        slot.className = 'cup-bracket-slot';
        slot.style.marginTop = `${slotMarginTop(roundIdx, matchIdx, unitRem)}rem`;
        slot.appendChild(createMatchCard(match));
        slots.appendChild(slot);
      });

      col.appendChild(slots);

      if (roundIdx < phases.length - 1) {
        const arrow = document.createElement('div');
        arrow.className = 'cup-bracket-arrow';
        arrow.setAttribute('aria-hidden', 'true');
        arrow.textContent = '›';
        bracket.appendChild(col);
        bracket.appendChild(arrow);
      } else {
        bracket.appendChild(col);
      }
    }

    container.innerHTML = '';
    container.appendChild(bracket);
    return true;
  }

  global.CupBracketUi = {
    PHASE_LABELS,
    PHASE_ORDER,
    groupKnockoutMatches,
    renderBracket
  };
})(window);
