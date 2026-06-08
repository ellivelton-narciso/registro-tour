document.addEventListener('DOMContentLoaded', async () => {
  const urlBE = localStorage.getItem('urlBE');
  const token = sessionStorage.getItem('token');

  const PHASE_LABELS = {
    groups: 'Grupos',
    r16: 'Oitavas',
    qf: 'Quartas',
    sf: 'Semifinal',
    final: 'Final'
  };

  let currentTournamentId = null;
  let allMatches = [];
  let qtdClassificados = 2;

  function authHeaders() {
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  async function getTournamentId() {
    const res = await fetch(`${urlBE}/getConfig`);
    const cfg = await res.json();
    if (!cfg?.id) throw new Error('Não foi possível obter o tournamentId.');
    return cfg.id;
  }

  async function loadStatus() {
    const res = await fetch(`${urlBE}/getCupStatus?tournamentId=${currentTournamentId}`, {
      headers: authHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao carregar status.');

    document.getElementById('tournamentName').textContent =
      `${data.tournamentName || 'Torneio'} (ID ${data.tournamentId})`;

    const g = data.groups;
    document.getElementById('groupsStatus').textContent =
      `Grupos: ${g.completed}/${g.total} concluídos` +
      (g.complete ? ' ✓' : ` (${g.pending} pendentes)`);

    let koText = 'Mata-mata: não gerado';
    if (data.knockout.hasKnockout) {
      const parts = data.knockout.rounds.map(
        (r) => `${PHASE_LABELS[r.phase] || r.phase} ${r.completed}/${r.total}`
      );
      koText = `Mata-mata: ${parts.join(' · ')}`;
      if (data.knockout.cupFinished) koText += ' — campeão definido';
    }
    document.getElementById('knockoutStatus').textContent = koText;

    document.getElementById('btnGenerateKnockout').disabled = !data.canGenerateKnockout;
    document.getElementById('btnAdvanceKnockout').disabled = !data.canAdvanceKnockout;

    qtdClassificados = data.qtdClassificados ?? 2;

    return data;
  }

  async function loadStandings() {
    const res = await fetch(`${urlBE}/getGroupStandings?tournamentId=${currentTournamentId}`, {
      headers: authHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao carregar classificação.');

    const container = document.getElementById('standingsByGroup');
    if (!Array.isArray(data)) {
      CupGroupsUi.renderGroupedTables(container, [], { emptyMessage: 'Sem dados de grupos.', renderTable: () => document.createElement('div') });
      return;
    }
    const groups = CupGroupsUi.groupByGrupo(data, (row) => row.grupo);

    CupGroupsUi.renderGroupedTables(container, groups, {
      emptyMessage: 'Sem dados de grupos.',
      renderTable(rows) {
        const wrap = document.createElement('div');
        wrap.className = 'table-responsive';
        const table = document.createElement('table');
        table.className = 'table table-sm table-striped table-hover align-middle mb-0';
        table.innerHTML = `
          <thead class="table-light">
            <tr>
              <th>#</th>
              <th>Jogador</th>
              <th>Pts</th>
              <th>Saldo</th>
              <th>V</th>
              <th>D</th>
            </tr>
          </thead>
          <tbody></tbody>
        `;
        const tbody = table.querySelector('tbody');
        for (const row of rows) {
          const tr = document.createElement('tr');
          if ((row.posicao ?? 99) <= qtdClassificados) {
            tr.className = 'fw-semibold table-success';
          }
          tr.innerHTML = `
            <td>${row.posicao ?? '-'}</td>
            <td>${row.name}</td>
            <td>${row.pontos ?? 0}</td>
            <td>${row.saldo ?? 0}</td>
            <td>${row.vitorias ?? 0}</td>
            <td>${row.derrotas ?? 0}</td>
          `;
          tbody.appendChild(tr);
        }
        wrap.appendChild(table);
        return wrap;
      }
    });
  }

  function getFilteredMatches() {
    const phase = document.getElementById('filterPhase').value;
    const status = document.getElementById('filterStatus').value;
    const player = document.getElementById('filterPlayer').value.trim().toLowerCase();

    return allMatches.filter((m) => {
      if (phase && m.phase !== phase) return false;

      if (status === 'pending' && m.winner_id) return false;
      if (status === 'done' && !m.winner_id) return false;

      if (player) {
        const a = (m.player_a_name || '').toLowerCase();
        const b = (m.player_b_name || '').toLowerCase();
        if (!a.includes(player) && !b.includes(player)) return false;
      }

      return true;
    });
  }

  function clearFilters() {
    document.getElementById('filterPlayer').value = '';
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterPhase').value = '';
    renderMatches();
  }

  async function loadMatches() {
    const res = await fetch(`${urlBE}/getTournamentMatches?tournamentId=${currentTournamentId}`, {
      headers: authHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao carregar confrontos.');

    allMatches = Array.isArray(data) ? data : [];
    renderMatches();
  }

  function renderMatches() {
    const rows = getFilteredMatches();
    const tbody = document.getElementById('matchesBody');
    tbody.innerHTML = '';

    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-muted">Nenhum confronto encontrado com os filtros atuais.</td></tr>';
      document.getElementById('matchesHint').textContent =
        allMatches.length ? `${allMatches.length} confronto(s) no total · nenhum no filtro` : '';
      return;
    }

    for (const m of rows) {
      const tr = document.createElement('tr');
      tr.dataset.matchId = m.id;

      const phaseLabel = PHASE_LABELS[m.phase] || m.phase;
      const grupo = m.grupo ? String(m.grupo).trim() : '—';
      tr.className = m.winner_id ? 'table-success' : 'table-warning';

      tr.innerHTML = `
        <td>${phaseLabel}</td>
        <td>${grupo}</td>
        <td>${m.player_a_name}</td>
        <td><input type="number" class="form-control form-control-sm score-a" min="0" max="10" value="${m.score_a ?? 0}"></td>
        <td>${m.player_b_name}</td>
        <td><input type="number" class="form-control form-control-sm score-b" min="0" max="10" value="${m.score_b ?? 0}"></td>
        <td>
          <select class="form-select form-select-sm winner-select">
            <option value="">Pendente</option>
            <option value="${m.player_a_id}" ${m.winner_id === m.player_a_id ? 'selected' : ''}>${m.player_a_name}</option>
            <option value="${m.player_b_id}" ${m.winner_id === m.player_b_id ? 'selected' : ''}>${m.player_b_name}</option>
          </select>
        </td>
        <td>
          <div class="d-flex gap-1">
            <button class="btn btn-sm btn-success btn-save" type="button">Salvar</button>
            <button class="btn btn-sm btn-outline-danger btn-clear" type="button" title="Limpar resultado">✕</button>
          </div>
        </td>
      `;

      tr.querySelector('.btn-save').addEventListener('click', () => saveMatch(tr, m));
      tr.querySelector('.btn-clear').addEventListener('click', () => clearMatch(m.id));

      tbody.appendChild(tr);
    }

    const pending = rows.filter((m) => !m.winner_id).length;
    const totalPending = allMatches.filter((m) => !m.winner_id).length;
    document.getElementById('matchesHint').textContent =
      `Exibindo ${rows.length} de ${allMatches.length} confronto(s) · ` +
      `${pending} pendente(s) no filtro · ${totalPending} pendente(s) no total`;
  }

  async function saveMatch(tr, match) {
    const winnerPlayerId = tr.querySelector('.winner-select').value;
    const scoreA = parseInt(tr.querySelector('.score-a').value, 10);
    const scoreB = parseInt(tr.querySelector('.score-b').value, 10);

    if (!winnerPlayerId) {
      Swal.fire({ icon: 'warning', title: 'Selecione o vencedor' });
      return;
    }

    const res = await fetch(`${urlBE}/updateTournamentMatch/${match.id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ winnerPlayerId: parseInt(winnerPlayerId, 10), scoreA, scoreB })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao salvar.');

    Swal.fire({ icon: 'success', title: 'Salvo', text: data.message, timer: 1500, showConfirmButton: false });
    await refreshAll();
  }

  async function clearMatch(matchId) {
    const confirmRes = await Swal.fire({
      icon: 'warning',
      title: 'Limpar resultado?',
      text: 'O confronto voltará a ficar pendente.',
      showCancelButton: true,
      confirmButtonText: 'Sim',
      cancelButtonText: 'Cancelar'
    });
    if (!confirmRes.isConfirmed) return;

    const res = await fetch(`${urlBE}/updateTournamentMatch/${matchId}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ clearResult: true })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao limpar.');

    await refreshAll();
  }

  async function generateKnockout() {
    const confirmRes = await Swal.fire({
      icon: 'question',
      title: 'Gerar mata-mata?',
      text: 'Classificados saem da tabela de grupos e a primeira rodada será criada.',
      showCancelButton: true,
      confirmButtonText: 'Gerar',
      cancelButtonText: 'Cancelar'
    });
    if (!confirmRes.isConfirmed) return;

    const res = await fetch(`${urlBE}/generateKnockout`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ tournamentId: currentTournamentId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao gerar mata-mata.');

    Swal.fire({ icon: 'success', title: 'Mata-mata gerado', text: data.message });
    await refreshAll();
  }

  async function advanceKnockout() {
    const confirmRes = await Swal.fire({
      icon: 'question',
      title: 'Avançar rodada?',
      showCancelButton: true,
      confirmButtonText: 'Avançar',
      cancelButtonText: 'Cancelar'
    });
    if (!confirmRes.isConfirmed) return;

    const res = await fetch(`${urlBE}/advanceKnockout`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ tournamentId: currentTournamentId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao avançar rodada.');

    Swal.fire({ icon: 'success', title: 'Rodada criada', text: data.message });
    await refreshAll();
  }

  async function refreshAll() {
    await loadStatus();
    await loadStandings();
    await loadMatches();
  }

  try {
    currentTournamentId = await getTournamentId();
    await refreshAll();

    document.getElementById('btnRefresh').addEventListener('click', () => refreshAll().catch(showErr));
    document.getElementById('filterPhase').addEventListener('change', renderMatches);
    document.getElementById('filterStatus').addEventListener('change', renderMatches);
    document.getElementById('filterPlayer').addEventListener('input', renderMatches);
    document.getElementById('btnClearFilters').addEventListener('click', clearFilters);
    document.getElementById('btnGenerateKnockout').addEventListener('click', () => generateKnockout().catch(showErr));
    document.getElementById('btnAdvanceKnockout').addEventListener('click', () => advanceKnockout().catch(showErr));
  } catch (err) {
    showErr(err);
  }

  function showErr(err) {
    Swal.fire({ icon: 'error', title: 'Erro', text: err.message || String(err) });
    console.error(err);
  }
});
