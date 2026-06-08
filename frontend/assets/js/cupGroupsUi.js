(function (global) {
  const THEMES = [
    { color: 'primary', text: 'text-white' },
    { color: 'danger', text: 'text-white' },
    { color: 'success', text: 'text-white' },
    { color: 'info', text: 'text-white' },
    { color: 'secondary', text: 'text-white' },
    { color: 'dark', text: 'text-white' }
  ];

  function normalizeGrupo(grupo) {
    if (grupo === null || grupo === undefined || grupo === '') return null;
    return String(grupo).trim();
  }

  function themeForGrupo(grupo) {
    const g = normalizeGrupo(grupo) || 'A';
    const idx = Math.abs(g.charCodeAt(0) - 65) % THEMES.length;
    return THEMES[idx];
  }

  function groupByGrupo(items, getGrupo) {
    const map = new Map();
    for (const item of items) {
      const raw = getGrupo(item);
      const key = normalizeGrupo(raw) ?? '_sem_grupo';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    }

    return [...map.entries()]
      .sort(([a], [b]) => {
        if (a === '_sem_grupo') return 1;
        if (b === '_sem_grupo') return -1;
        return a.localeCompare(b);
      })
      .map(([grupo, rows]) => ({ grupo, rows }));
  }

  function createGroupCard(grupo, rows, renderTable) {
    const theme = themeForGrupo(grupo === '_sem_grupo' ? null : grupo);
    const label = grupo === '_sem_grupo' ? 'Sem grupo' : `Grupo ${grupo}`;

    const col = document.createElement('div');
    col.className = 'col';

    const card = document.createElement('div');
    card.className = `card h-100 border-${theme.color} shadow-sm`;

    const header = document.createElement('div');
    header.className =
      `card-header bg-${theme.color} ${theme.text} ` +
      'd-flex justify-content-between align-items-center py-2';
    header.innerHTML = `
      <span class="fw-semibold">${label}</span>
      <span class="badge rounded-pill text-bg-light text-dark">${rows.length}</span>
    `;

    const body = document.createElement('div');
    body.className = 'card-body p-2';
    body.appendChild(renderTable(rows, grupo, theme));

    card.appendChild(header);
    card.appendChild(body);
    col.appendChild(card);

    return col;
  }

  function renderGroupedTables(container, groups, options) {
    const {
      emptyMessage = 'Nenhum dado.',
      renderTable
    } = options;

    container.className = 'row row-cols-1 row-cols-md-2 row-cols-xl-3 g-3';
    container.innerHTML = '';

    if (!groups.length) {
      container.className = '';
      container.innerHTML = `<p class="text-muted mb-0">${emptyMessage}</p>`;
      return;
    }

    for (const { grupo, rows } of groups) {
      container.appendChild(createGroupCard(grupo, rows, renderTable));
    }
  }

  function renderStandingsTable(rows, qtdClassificados) {
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

  function renderStandingsByGroup(container, standings, qtdClassificados, options) {
    const { emptyMessage = 'Sem dados de grupos.' } = options || {};
    if (!Array.isArray(standings) || standings.length === 0) {
      renderGroupedTables(container, [], {
        emptyMessage,
        renderTable: () => document.createElement('div')
      });
      return;
    }

    const groups = groupByGrupo(standings, (row) => row.grupo);
    renderGroupedTables(container, groups, {
      emptyMessage,
      renderTable: (rows) => renderStandingsTable(rows, qtdClassificados)
    });
  }

  global.CupGroupsUi = {
    normalizeGrupo,
    themeForGrupo,
    groupByGrupo,
    renderGroupedTables,
    renderStandingsTable,
    renderStandingsByGroup
  };
})(window);
