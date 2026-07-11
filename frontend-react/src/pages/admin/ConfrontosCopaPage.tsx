import { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { apiFetch } from '../../api/client';
import type { CupStatus, StandingRow, TournamentConfig, TournamentMatch } from '../../api/types';
import { AdminNav } from '../../components/AdminNav';
import { CupStandingsByGroup } from '../../components/cup/CupStandingsByGroup';
import { KnockoutBracket } from '../../components/cup/KnockoutBracket';
import { phaseLabel } from '../../utils/cupGroups';

export function ConfrontosCopaPage() {
  const [tournamentId, setTournamentId] = useState<number | null>(null);
  const [status, setStatus] = useState<CupStatus | null>(null);
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [allMatches, setAllMatches] = useState<TournamentMatch[]>([]);
  const [qtdClassificados, setQtdClassificados] = useState(2);
  const [filters, setFilters] = useState({ phase: '', status: '', player: '' });
  const [editRows, setEditRows] = useState<Record<number, { scoreA: number; scoreB: number; winnerId: string }>>({});

  const refreshAll = useCallback(async (tid: number) => {
    const st = await apiFetch<CupStatus>(`/getCupStatus?tournamentId=${tid}`, { auth: true });
    setStatus(st);
    setQtdClassificados(st.qtdClassificados ?? 2);
    const stRows = await apiFetch<StandingRow[]>(`/getGroupStandings?tournamentId=${tid}`, { auth: true });
    setStandings(stRows);
    const matches = await apiFetch<TournamentMatch[]>(`/getTournamentMatches?tournamentId=${tid}`, { auth: true });
    setAllMatches(matches);
    const edits: Record<number, { scoreA: number; scoreB: number; winnerId: string }> = {};
    matches.forEach((m) => {
      edits[m.id] = {
        scoreA: m.score_a ?? 0,
        scoreB: m.score_b ?? 0,
        winnerId: m.winner_id ? String(m.winner_id) : '',
      };
    });
    setEditRows(edits);
  }, []);

  useEffect(() => {
    document.title = 'Confrontos da Copa';
    apiFetch<TournamentConfig>('/getConfig', { auth: true })
      .then((cfg) => {
        setTournamentId(cfg.id);
        return refreshAll(cfg.id);
      })
      .catch((err) => Swal.fire({ icon: 'error', title: 'Erro', text: err.message }));
  }, [refreshAll]);

  const filteredMatches = useMemo(() => {
    const player = filters.player.trim().toLowerCase();
    return allMatches.filter((m) => {
      if (filters.phase && m.phase !== filters.phase) return false;
      if (filters.status === 'pending' && m.winner_id) return false;
      if (filters.status === 'done' && !m.winner_id) return false;
      if (player) {
        const a = (m.player_a_name || '').toLowerCase();
        const b = (m.player_b_name || '').toLowerCase();
        if (!a.includes(player) && !b.includes(player)) return false;
      }
      return true;
    });
  }, [allMatches, filters]);

  const koMatches = allMatches.filter((m) => m.phase !== 'groups');
  const hasBracket = koMatches.some((m) => !m.phase.startsWith('swiss_'));

  function groupsStatusText() {
    if (!status) return '—';
    if (status.formatoCopa === 'knockout') return 'Formato: só mata-mata (sem grupos)';
    if (status.formatoCopa === 'swiss') {
      const sw = status.swiss;
      if (!sw?.rounds?.length) return 'Suíço: aguardando primeira rodada';
      const parts = sw.rounds.map((r) => `${phaseLabel(r.phase)} ${r.completed}/${r.total}`);
      return `Suíço: ${parts.join(' · ')}${sw.complete ? ' ✓' : ''}`;
    }
    const g = status.groups;
    return `Grupos: ${g.completed}/${g.total} concluídos${g.complete ? ' ✓' : ` (${g.pending} pendentes)`}`;
  }

  async function saveMatch(match: TournamentMatch) {
    const row = editRows[match.id];
    if (!row?.winnerId) {
      Swal.fire({ icon: 'warning', title: 'Selecione o vencedor' });
      return;
    }
    await apiFetch(`/updateTournamentMatch/${match.id}`, {
      method: 'PUT',
      auth: true,
      body: JSON.stringify({
        winnerPlayerId: parseInt(row.winnerId, 10),
        scoreA: row.scoreA,
        scoreB: row.scoreB,
      }),
    });
    Swal.fire({ icon: 'success', title: 'Salvo', timer: 1500, showConfirmButton: false });
    if (tournamentId) await refreshAll(tournamentId);
  }

  async function clearMatch(matchId: number) {
    const ok = await Swal.fire({ icon: 'warning', title: 'Limpar resultado?', showCancelButton: true });
    if (!ok.isConfirmed) return;
    await apiFetch(`/updateTournamentMatch/${matchId}`, {
      method: 'PUT',
      auth: true,
      body: JSON.stringify({ clearResult: true }),
    });
    if (tournamentId) await refreshAll(tournamentId);
  }

  async function postAction(path: string, title: string) {
    if (!tournamentId) return;
    const ok = await Swal.fire({ icon: 'question', title, showCancelButton: true });
    if (!ok.isConfirmed) return;
    const data = await apiFetch<{ message?: string }>(path, {
      method: 'POST',
      auth: true,
      body: JSON.stringify({ tournamentId }),
    });
    Swal.fire({ icon: 'success', title: 'OK', text: data.message });
    await refreshAll(tournamentId);
  }

  return (
    <>
      <AdminNav />
      <div className="container-fluid mt-4 mb-5 px-3 px-md-4">
        <h2 className="text-center mb-4">Confrontos da Copa</h2>
        <div className="row g-3 mb-4">
          <div className="col-lg-4">
            <div className="card h-100">
              <div className="card-body">
                <h5 className="card-title">Status</h5>
                <p className="mb-1"><strong>Torneio:</strong> {status ? `${status.tournamentName} (ID ${status.tournamentId})` : '—'}</p>
                <p className="mb-1">{groupsStatusText()}</p>
                <p className="mb-1">
                  Mata-mata:{' '}
                  {status?.knockout.hasKnockout
                    ? status.knockout.rounds.map((r) => `${phaseLabel(r.phase)} ${r.completed}/${r.total}`).join(' · ')
                    : 'não gerado'}
                </p>
                <div className="d-grid gap-2 mt-3">
                  <button type="button" className="btn btn-primary" disabled={!status?.canGenerateKnockout} onClick={() => postAction('/generateKnockout', 'Gerar mata-mata?')}>
                    Gerar mata-mata
                  </button>
                  <button type="button" className="btn btn-outline-primary" disabled={!status?.canAdvanceKnockout} onClick={() => postAction('/advanceKnockout', 'Avançar rodada?')}>
                    Avançar rodada do mata-mata
                  </button>
                  {status?.canGenerateThirdPlace && (
                    <button type="button" className="btn btn-outline-warning" onClick={() => postAction('/generateThirdPlace', 'Gerar disputa de 3º lugar?')}>
                      Gerar disputa de 3º lugar
                    </button>
                  )}
                  <button type="button" className="btn btn-outline-secondary" onClick={() => tournamentId && refreshAll(tournamentId)}>Atualizar</button>
                </div>
              </div>
            </div>
          </div>
          <div className="col-lg-8">
            <div className="card h-100">
              <div className="card-body">
                <h5 className="card-title">Classificação dos grupos</h5>
                <CupStandingsByGroup standings={standings} qtdClassificados={qtdClassificados} />
              </div>
            </div>
          </div>
        </div>

        {hasBracket && (
          <div className="card mb-4">
            <div className="card-body">
              <h5 className="card-title">Chave do mata-mata</h5>
              <div className="cup-bracket-wrap">
                <KnockoutBracket matches={koMatches.filter((m) => !m.phase.startsWith('swiss_'))} />
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-body">
            <h5 className="mb-2">Confrontos</h5>
            <div className="row g-2 mb-3">
              <div className="col-md-4">
                <input className="form-control form-control-sm" placeholder="Filtrar por jogador..." value={filters.player} onChange={(e) => setFilters((f) => ({ ...f, player: e.target.value }))} />
              </div>
              <div className="col-md-3">
                <select className="form-select form-select-sm" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
                  <option value="">Todos os status</option>
                  <option value="pending">Só pendentes</option>
                  <option value="done">Só concluídos</option>
                </select>
              </div>
              <div className="col-md-3">
                <select className="form-select form-select-sm" value={filters.phase} onChange={(e) => setFilters((f) => ({ ...f, phase: e.target.value }))}>
                  <option value="">Todas as fases</option>
                  <option value="groups">Fase de grupos</option>
                  <option value="r16">Oitavas</option>
                  <option value="qf">Quartas</option>
                  <option value="sf">Semifinal</option>
                  <option value="3p">3º lugar</option>
                  <option value="final">Final</option>
                </select>
              </div>
              <div className="col-md-2">
                <button type="button" className="btn btn-outline-secondary btn-sm w-100" onClick={() => setFilters({ phase: '', status: '', player: '' })}>Limpar</button>
              </div>
            </div>
            <div className="table-responsive">
              <table className="table table-bordered align-middle">
                <thead className="table-light">
                  <tr>
                    <th>Fase</th><th>Grupo</th><th>Jogador A</th><th>Placar A</th><th>Jogador B</th><th>Placar B</th><th>Vencedor</th><th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMatches.length === 0 ? (
                    <tr><td colSpan={8} className="text-muted">Nenhum confronto encontrado.</td></tr>
                  ) : (
                    filteredMatches.map((m) => (
                      <tr key={m.id} className={m.winner_id ? 'table-success' : 'table-warning'}>
                        <td>{phaseLabel(m.phase)}</td>
                        <td>{m.grupo || '—'}</td>
                        <td>{m.player_a_name}</td>
                        <td>
                          <input type="number" className="form-control form-control-sm" min={0} max={10} value={editRows[m.id]?.scoreA ?? 0}
                            onChange={(e) => setEditRows((r) => ({ ...r, [m.id]: { ...r[m.id], scoreA: Number(e.target.value) } }))} />
                        </td>
                        <td>{m.player_b_name}</td>
                        <td>
                          <input type="number" className="form-control form-control-sm" min={0} max={10} value={editRows[m.id]?.scoreB ?? 0}
                            onChange={(e) => setEditRows((r) => ({ ...r, [m.id]: { ...r[m.id], scoreB: Number(e.target.value) } }))} />
                        </td>
                        <td>
                          <select className="form-select form-select-sm" value={editRows[m.id]?.winnerId ?? ''}
                            onChange={(e) => setEditRows((r) => ({ ...r, [m.id]: { ...r[m.id], winnerId: e.target.value } }))}>
                            <option value="">Pendente</option>
                            <option value={m.player_a_id}>{m.player_a_name}</option>
                            <option value={m.player_b_id}>{m.player_b_name}</option>
                          </select>
                        </td>
                        <td>
                          <div className="d-flex gap-1">
                            <button type="button" className="btn btn-sm btn-success" onClick={() => saveMatch(m).catch((e) => Swal.fire({ icon: 'error', title: 'Erro', text: e.message }))}>Salvar</button>
                            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => clearMatch(m.id).catch((e) => Swal.fire({ icon: 'error', title: 'Erro', text: e.message }))}>✕</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
