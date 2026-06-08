document.addEventListener('DOMContentLoaded', async function () {
  const urlBE = localStorage.getItem('urlBE');
  const token = sessionStorage.getItem('token');

  function authHeaders() {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }

  function setHint(text) {
    const el = document.getElementById('participantsHint');
    if (el) el.textContent = text || '';
  }

  let currentTournamentId = null;

  function getTournamentIdFromConfig() {
    return fetch(`${urlBE}/getConfig`)
      .then(r => r.json())
      .then(cfg => {
        if (cfg && cfg.id) return cfg.id;
        throw new Error('Não foi possível obter o tournamentId.');
      });
  }

  async function loadCupSetup() {
    const res = await fetch(`${urlBE}/getCupSetup?tournamentId=${currentTournamentId}`, {
      headers: authHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao carregar setup da copa.');

    document.getElementById('qtdParticipantes').value = data.qtdParticipantes ?? 0;
    document.getElementById('qtdGrupos').value = data.qtdGrupos ?? 2;
    document.getElementById('qtdClassificados').value = data.qtdClassificados ?? 2;

    const sel = document.getElementById('formatoMataMata');
    if (sel && (data.formatoMataMata === 1 || data.formatoMataMata === 3)) {
      sel.value = String(data.formatoMataMata);
    }
  }

  function renderParticipantsByGroup(participants) {
    const container = document.getElementById('participantsByGroup');
    const groups = CupGroupsUi.groupByGrupo(participants, (p) => p.grupo);

    CupGroupsUi.renderGroupedTables(container, groups, {
      emptyMessage: 'Nenhum participante encontrado para este torneio.',
      renderTable(rows) {
        const wrap = document.createElement('div');
        wrap.className = 'table-responsive';
        const table = document.createElement('table');
        table.className = 'table table-sm table-striped table-hover align-middle mb-0';
        table.innerHTML = `
          <thead class="table-light">
            <tr>
              <th>Nome</th>
              <th>Contato</th>
            </tr>
          </thead>
          <tbody></tbody>
        `;
        const tbody = table.querySelector('tbody');
        for (const p of rows) {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${p.name}</td>
            <td class="text-muted small">${p.email || '—'}</td>
          `;
          tbody.appendChild(tr);
        }
        wrap.appendChild(table);
        return wrap;
      }
    });
  }

  async function loadParticipants() {
    const res = await fetch(`${urlBE}/getTournamentParticipants?tournamentId=${currentTournamentId}`, {
      headers: authHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao carregar participantes.');

    if (!Array.isArray(data) || data.length === 0) {
      renderParticipantsByGroup([]);
      setHint('Nenhum participante encontrado para este torneio.');
      return;
    }

    renderParticipantsByGroup(data);

    const grouped = CupGroupsUi.groupByGrupo(data, (p) => p.grupo);
    const withGroup = grouped.filter((g) => g.grupo !== '_sem_grupo').length;
    setHint(
      `Total: ${data.length} participante(s)` +
      (withGroup ? ` · ${withGroup} grupo(s)` : ' · sorteio ainda não realizado')
    );
  }

  async function saveCupSetup() {
    const payload = {
      tournamentId: currentTournamentId,
      qtdGrupos: document.getElementById('qtdGrupos').value,
      qtdClassificados: document.getElementById('qtdClassificados').value,
      formatoMataMata: document.getElementById('formatoMataMata').value
    };

    const res = await fetch(`${urlBE}/updateCupSetup`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao salvar configuração.');

    Swal.fire({
      icon: 'success',
      title: 'Configuração salva',
      text: data.message || 'Setup atualizado com sucesso!'
    });
    await loadCupSetup();
  }

  async function generateCupGroups() {
    const payload = {
      tournamentId: currentTournamentId,
      qtdGrupos: document.getElementById('qtdGrupos').value,
      qtdClassificados: document.getElementById('qtdClassificados').value,
      formatoMataMata: document.getElementById('formatoMataMata').value
    };

    const confirmRes = await Swal.fire({
      icon: 'warning',
      title: 'Gerar sorteio novamente?',
      text: 'Isso vai atualizar `participants.grupo` e recriar `tournament_matches` da fase de grupos.',
      showCancelButton: true,
      confirmButtonText: 'Sim, sortear',
      cancelButtonText: 'Cancelar'
    });

    if (!confirmRes.isConfirmed) return;

    const res = await fetch(`${urlBE}/generateCupGroups`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao gerar grupos.');

    Swal.fire({
      icon: 'success',
      title: 'Sorteio concluído',
      text: data.message || 'Grupos gerados com sucesso!'
    });

    await loadCupSetup();
    await loadParticipants();
  }

  try {
    currentTournamentId = await getTournamentIdFromConfig();
    await loadCupSetup();
    await loadParticipants();

    document.getElementById('saveCupSetup').addEventListener('click', async () => {
      try {
        await saveCupSetup();
      } catch (e) {
        Swal.fire({ icon: 'error', title: 'Erro', text: e.message || String(e) });
      }
    });

    document.getElementById('generateCupGroups').addEventListener('click', async () => {
      try {
        await generateCupGroups();
      } catch (e) {
        Swal.fire({ icon: 'error', title: 'Erro', text: e.message || String(e) });
      }
    });

    document.getElementById('refreshParticipants')?.addEventListener('click', async () => {
      try {
        await loadParticipants();
      } catch (e) {
        Swal.fire({ icon: 'error', title: 'Erro', text: e.message || String(e) });
      }
    });
  } catch (err) {
    Swal.fire({ icon: 'error', title: 'Erro de inicialização', text: err.message || String(err) });
    console.error(err);
  }
});

