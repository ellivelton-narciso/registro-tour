import type { StandingRow } from '../../api/types';
import { groupByGrupo, themeForGrupo } from '../../utils/cupGroups';

interface Props {
  standings: StandingRow[];
  qtdClassificados: number;
  emptyMessage?: string;
}

function StandingsTable({ rows, qtdClassificados }: { rows: StandingRow[]; qtdClassificados: number }) {
  return (
    <div className="table-responsive">
      <table className="table table-sm table-striped table-hover align-middle mb-0">
        <thead className="table-light">
          <tr>
            <th>#</th>
            <th>Jogador</th>
            <th>Pts</th>
            <th>Saldo</th>
            <th>V</th>
            <th>D</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.participant_id ?? row.player_id ?? row.name}`}
              className={(row.posicao ?? 99) <= qtdClassificados ? 'fw-semibold table-success' : undefined}
            >
              <td>{row.posicao ?? '-'}</td>
              <td>{row.name}</td>
              <td>{row.pontos ?? 0}</td>
              <td>{row.saldo ?? 0}</td>
              <td>{row.vitorias ?? 0}</td>
              <td>{row.derrotas ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CupStandingsByGroup({ standings, qtdClassificados, emptyMessage = 'Sem dados de grupos.' }: Props) {
  if (!standings.length) {
    return <p className="text-muted mb-0">{emptyMessage}</p>;
  }

  const groups = groupByGrupo(standings, (row: StandingRow) => row.grupo);

  return (
    <div className="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-3">
      {groups.map(({ grupo, rows }) => {
        const theme = themeForGrupo(grupo === '_sem_grupo' ? null : grupo);
        const label = grupo === '_sem_grupo' ? 'Sem grupo' : `Grupo ${grupo}`;
        return (
          <div className="col" key={grupo}>
            <div className={`card h-100 border-${theme.color} shadow-sm`}>
              <div
                className={`card-header bg-${theme.color} ${theme.text} d-flex justify-content-between align-items-center py-2`}
              >
                <span className="fw-semibold">{label}</span>
                <span className="badge rounded-pill text-bg-light text-dark">{rows.length}</span>
              </div>
              <div className="card-body p-2">
                <StandingsTable rows={rows} qtdClassificados={qtdClassificados} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
