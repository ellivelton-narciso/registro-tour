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

  function getFormatoCopa() {
    return document.getElementById('formatoCopa').value;
  }

  function isKnockoutOnly() {
    return getFormatoCopa() === 'knockout';
  }

  function isSwissMode() {
    return getFormatoCopa() === 'swiss';
  }

  function syncFormatoCopaUi() {
    const knockout = isKnockoutOnly();
    const swiss = isSwissMode();

    document.getElementById('groupsSetup').classList.toggle('d-none', knockout || swiss);
    document.getElementById('swissSetup').classList.toggle('d-none', !swiss);
    document.getElementById('generateCupGroups').classList.toggle('d-none', knockout || swiss);
    document.getElementById('generateSwissRound').classList.toggle('d-none', !swiss);
    document.getElementById('generateDirectKnockout').classList.toggle('d-none', !knockout);

    if (knockout) {
      document.getElementById('setupHint').textContent =
        'Copa eliminatória: todos os inscritos entram na chave (com byes até potência de 2). Mínimo 2 inscritos. Ao sortear novamente, a chave inteira é recriada.';
    } else if (swiss) {
      document.getElementById('setupHint').textContent =
        'Fase suíça: gere uma rodada por vez após concluir os confrontos. O top N classifica para o mata-mata (oitavas, quartas, etc.). MD1/MD3 vale só no mata-mata.';
    } else {
      document.getElementById('setupHint').textContent =
        'Fase de grupos: round-robin ida e volta (1 jogo por confronto). O formato MD1/MD3 acima vale para o mata-mata. Ao sortear novamente, o backend recria a fase de grupos.';
    }
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
    document.getElementById('qtdClassificadosSwiss').value = data.qtdClassificados ?? 8;
    document.getElementById('qtdRodadasSuico').value = data.qtdRodadasSuico ?? data.qtdrodadassuico ?? '';

    const formatoCopa = data.formatoCopa ?? data.formatocopa ?? 'groups';
    document.getElementById('formatoCopa').value = formatoCopa;

    const sel = document.getElementById('formatoMataMata');
    if (sel && (data.formatoMataMata === 1 || data.formatoMataMata === 3)) {
      sel.value = String(data.formatoMataMata);
    }

    syncFormatoCopaUi();
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

  function renderParticipantsFlat(participants) {
    const container = document.getElementById('participantsByGroup');
    container.innerHTML = '';
    if (!participants.length) {
      container.innerHTML = '<p class="text-muted mb-0">Nenhum participante encontrado para este torneio.</p>';
      return;
    }

    const wrap = document.createElement('div');
    wrap.className = 'table-responsive';
    wrap.innerHTML = `
      <table class="table table-sm table-striped table-hover align-middle mb-0">
        <thead class="table-light">
          <tr><th>#</th><th>Nome</th><th>Contato</th></tr>
        </thead>
        <tbody>
          ${participants.map((p, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td>${p.name}</td>
              <td class="text-muted small">${p.email || '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    container.appendChild(wrap);
  }

  async function loadParticipants() {
    const res = await fetch(`${urlBE}/getTournamentParticipants?tournamentId=${currentTournamentId}`, {
      headers: authHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao carregar participantes.');

    if (!Array.isArray(data) || data.length === 0) {
      renderParticipantsFlat([]);
      setHint('Nenhum participante encontrado para este torneio.');
      return;
    }

    if (isKnockoutOnly() || isSwissMode()) {
      renderParticipantsFlat(data);
      setHint(
        isSwissMode()
          ? `Total: ${data.length} inscrito(s) · fase suíça`
          : `Total: ${data.length} inscrito(s) · chave eliminatória`
      );
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
      formatoCopa: getFormatoCopa(),
      formatoMataMata: document.getElementById('formatoMataMata').value
    };

    if (isSwissMode()) {
      payload.qtdClassificados = document.getElementById('qtdClassificadosSwiss').value;
      const rodadas = document.getElementById('qtdRodadasSuico').value.trim();
      if (rodadas) payload.qtdRodadasSuico = rodadas;
    } else if (!isKnockoutOnly()) {
      payload.qtdGrupos = document.getElementById('qtdGrupos').value;
      payload.qtdClassificados = document.getElementById('qtdClassificados').value;
    }

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

  async function generateSwissRound(reset = false) {
    const qtd = parseInt(document.getElementById('qtdParticipantes').value, 10) || 0;
    if (qtd < 2) {
      Swal.fire({ icon: 'warning', title: 'Inscritos insuficientes', text: 'São necessários pelo menos 2 inscritos.' });
      return;
    }

    const confirmRes = await Swal.fire({
      icon: 'warning',
      title: reset ? 'Reiniciar fase suíça?' : 'Gerar próxima rodada suíça?',
      text: reset
        ? 'Todos os confrontos suíços serão apagados e a rodada 1 será recriada.'
        : 'Novos emparelhamentos serão criados para a próxima rodada.',
      showCancelButton: true,
      confirmButtonText: reset ? 'Sim, reiniciar' : 'Sim, gerar',
      cancelButtonText: 'Cancelar'
    });
    if (!confirmRes.isConfirmed) return;

    const res = await fetch(`${urlBE}/generateSwissRound`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        tournamentId: currentTournamentId,
        reset
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao gerar rodada suíça.');

    Swal.fire({
      icon: 'success',
      title: 'Rodada suíça gerada',
      text: data.message || `Rodada ${data.round}/${data.totalRounds} criada.`
    });

    await loadCupSetup();
    await loadParticipants();
  }

  async function generateDirectKnockout() {
    const qtd = parseInt(document.getElementById('qtdParticipantes').value, 10) || 0;
    if (qtd < 2) {
      Swal.fire({ icon: 'warning', title: 'Inscritos insuficientes', text: 'São necessários pelo menos 2 inscritos.' });
      return;
    }

    const confirmRes = await Swal.fire({
      icon: 'warning',
      title: 'Gerar chave eliminatória?',
      text: 'Todos os inscritos entram no mata-mata. Confrontos anteriores deste torneio serão substituídos.',
      showCancelButton: true,
      confirmButtonText: 'Sim, sortear',
      cancelButtonText: 'Cancelar'
    });
    if (!confirmRes.isConfirmed) return;

    const res = await fetch(`${urlBE}/generateDirectKnockout`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        tournamentId: currentTournamentId,
        formatoMataMata: document.getElementById('formatoMataMata').value
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao gerar mata-mata.');

    Swal.fire({
      icon: 'success',
      title: 'Chave gerada',
      text: data.message || `Rodada ${data.phase} criada com ${data.qtdConfrontos} confronto(s) e ${data.qtdByes || 0} bye(s).`
    });

    await loadCupSetup();
    await loadParticipants();
  }

  try {
    currentTournamentId = await getTournamentIdFromConfig();
    await loadCupSetup();
    await loadParticipants();

    document.getElementById('formatoCopa').addEventListener('change', async () => {
      syncFormatoCopaUi();
      await loadParticipants();
    });

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

    document.getElementById('generateSwissRound').addEventListener('click', async () => {
      try {
        await generateSwissRound(false);
      } catch (e) {
        Swal.fire({ icon: 'error', title: 'Erro', text: e.message || String(e) });
      }
    });

    document.getElementById('generateSwissRound').addEventListener('contextmenu', async (event) => {
      event.preventDefault();
      try {
        await generateSwissRound(true);
      } catch (e) {
        Swal.fire({ icon: 'error', title: 'Erro', text: e.message || String(e) });
      }
    });

    document.getElementById('generateDirectKnockout').addEventListener('click', async () => {
      try {
        await generateDirectKnockout();
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
