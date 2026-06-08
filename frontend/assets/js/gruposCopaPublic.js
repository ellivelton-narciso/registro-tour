document.addEventListener('DOMContentLoaded', () => {
  const urlBE = localStorage.getItem('urlBE');
  const REFRESH_MS = 60_000;

  const endedMessage = document.getElementById('endedMessage');
  const noGroupsMessage = document.getElementById('noGroupsMessage');
  const standingsSection = document.getElementById('standingsSection');
  const standingsContainer = document.getElementById('standingsByGroup');
  const tournamentSubtitle = document.getElementById('tournamentSubtitle');
  const lastUpdated = document.getElementById('lastUpdated');
  const btnRefresh = document.getElementById('btnRefresh');

  function hideAllStates() {
    endedMessage.classList.add('d-none');
    noGroupsMessage.classList.add('d-none');
    standingsSection.classList.add('d-none');
  }

  function showEnded() {
    hideAllStates();
    endedMessage.classList.remove('d-none');
    tournamentSubtitle.textContent = '';
  }

  function showNoGroups(data) {
    hideAllStates();
    noGroupsMessage.classList.remove('d-none');
    tournamentSubtitle.textContent = data.titulo || data.tournamentName || '';
  }

  function showStandings(data) {
    hideAllStates();
    standingsSection.classList.remove('d-none');
    tournamentSubtitle.textContent = data.titulo || data.tournamentName || '';

    CupGroupsUi.renderStandingsByGroup(
      standingsContainer,
      data.standings,
      data.qtdClassificados ?? 2
    );

    lastUpdated.textContent = `Atualizado às ${new Date().toLocaleTimeString('pt-BR')}`;
  }

  async function loadStandings() {
    const res = await fetch(`${urlBE}/public/cupStandings`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Erro ao carregar classificação.');
    }

    if (!data.active) {
      showEnded();
      return;
    }

    if (!data.hasGroups) {
      showNoGroups(data);
      return;
    }

    showStandings(data);
  }

  async function loadNavTitle() {
    try {
      const res = await fetch(`${urlBE}/getConfig`);
      const config = await res.json();
      if (config.titulo) {
        document.getElementById('navBrand').textContent = config.titulo;
        document.title = `${config.titulo} — Grupos`;
      }
    } catch (err) {
      console.warn('Não foi possível carregar título do torneio:', err);
    }
  }

  btnRefresh.addEventListener('click', () => {
    loadStandings().catch(showErr);
  });

  loadNavTitle();
  loadStandings().catch(showErr);
  setInterval(() => loadStandings().catch(console.error), REFRESH_MS);

  function showErr(err) {
    hideAllStates();
    tournamentSubtitle.textContent = '';
    standingsContainer.innerHTML = '';
    endedMessage.classList.remove('d-none');
    endedMessage.textContent = err.message || 'Não foi possível carregar a classificação.';
    endedMessage.classList.remove('alert-secondary');
    endedMessage.classList.add('alert-danger');
    console.error(err);
  }
});
