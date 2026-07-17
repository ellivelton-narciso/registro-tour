import { useCallback, useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { apiFetch } from '../../api/client';
import type { CupSetup, TournamentConfig, TournamentParticipant } from '../../api/types';
import { AdminNav } from '../../components/AdminNav';
import { groupByGrupo, themeForGrupo } from '../../utils/cupGroups';
import { minimumSwissRounds, SWISS_MAX_ROUNDS } from '../../utils/swissRounds';

type FormatoCopa = 'groups' | 'swiss' | 'knockout';

export function SorteioGruposPage() {
  const [tournamentId, setTournamentId] = useState<number | null>(null);
  const [participants, setParticipants] = useState<TournamentParticipant[]>([]);
  const [hint, setHint] = useState('');
  const [form, setForm] = useState({
    qtdParticipantes: 0,
    formatoCopa: 'groups' as FormatoCopa,
    qtdGrupos: 2,
    qtdClassificados: 2,
    qtdClassificadosSwiss: 8,
    qtdRodadasSuico: '',
    formatoMataMata: '1',
  });
  const [swissHint, setSwissHint] = useState('');

  const syncSwissHint = useCallback(
    (minFromServer?: number, autoFromServer?: number) => {
      if (form.formatoCopa !== 'swiss') return;
      const min = minFromServer ?? minimumSwissRounds(form.qtdParticipantes, form.qtdClassificadosSwiss);
      const auto = autoFromServer ?? min;
      setSwissHint(
        form.qtdParticipantes >= 2 && form.qtdClassificadosSwiss >= 2
          ? `Mínimo: ${min} rodada(s) para ${form.qtdParticipantes} inscrito(s) e top ${form.qtdClassificadosSwiss} — último classificado com mais vitórias que o 1º eliminado. Deixe vazio para usar ${auto}. Empate no mesmo recorde entre classificados: saldo e vitórias.`
          : 'Informe classificados e aguarde inscritos para calcular o mínimo.'
      );
    },
    [form.formatoCopa, form.qtdParticipantes, form.qtdClassificadosSwiss]
  );

  const loadSetup = useCallback(async (tid: number): Promise<FormatoCopa> => {
    const data = await apiFetch<CupSetup>(`/getCupSetup?tournamentId=${tid}`, { auth: true });
    const formato = (data.formatoCopa ?? 'groups') as FormatoCopa;
    setForm((f) => ({
      ...f,
      qtdParticipantes: data.qtdParticipantes ?? 0,
      qtdGrupos: data.qtdGrupos ?? 2,
      qtdClassificados: data.qtdClassificados ?? 2,
      qtdClassificadosSwiss: data.qtdClassificados ?? 8,
      qtdRodadasSuico: data.qtdRodadasSuico ? String(data.qtdRodadasSuico) : '',
      formatoCopa: formato,
      formatoMataMata: String(data.formatoMataMata ?? 1),
    }));
    syncSwissHint(data.minRodadasSuico, data.rodadasSuicoAutomaticas);
    return formato;
  }, [syncSwissHint]);

  const loadParticipants = useCallback(async (tid: number, formato: FormatoCopa) => {
    const data = await apiFetch<TournamentParticipant[]>(`/getTournamentParticipants?tournamentId=${tid}`, { auth: true });
    setParticipants(data);
    // Fonte de verdade da lista — mantém o input alinhado mesmo se getCupSetup falhar no casing.
    setForm((f) => ({ ...f, qtdParticipantes: data.length }));
    if (!data.length) {
      setHint('Nenhum participante encontrado para este torneio.');
      return;
    }
    if (formato === 'knockout') {
      setHint(`Total: ${data.length} inscrito(s) · chave eliminatória`);
    } else if (formato === 'swiss') {
      setHint(`Total: ${data.length} inscrito(s) · fase suíça`);
    } else {
      const grouped = groupByGrupo(data, (p) => p.grupo);
      const withGroup = grouped.filter((g) => g.grupo !== '_sem_grupo').length;
      setHint(`Total: ${data.length} participante(s)${withGroup ? ` · ${withGroup} grupo(s)` : ' · sorteio ainda não realizado'}`);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    document.title = 'Sorteio da Copa';
    apiFetch<TournamentConfig>('/getConfig', { auth: true })
      .then(async (cfg) => {
        if (cancelled) return;
        setTournamentId(cfg.id);
        const formato = await loadSetup(cfg.id);
        if (!cancelled) await loadParticipants(cfg.id, formato);
      })
      .catch((err) => {
        if (!cancelled) Swal.fire({ icon: 'error', title: 'Erro', text: err.message });
      });

    return () => {
      cancelled = true;
    };
    // Montagem única — loadSetup/loadParticipants estáveis o suficiente no 1º render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    syncSwissHint();
  }, [form.formatoCopa, form.qtdParticipantes, form.qtdClassificadosSwiss, syncSwissHint]);

  const setupHint =
    form.formatoCopa === 'knockout'
      ? 'Copa eliminatória: todos os inscritos entram na chave (com byes até potência de 2). Mínimo 2 inscritos.'
      : form.formatoCopa === 'swiss'
        ? 'Fase suíça: gere uma rodada por vez após concluir os confrontos. O top N classifica para o mata-mata. MD1/MD3 vale só no mata-mata.'
        : 'Fase de grupos: round-robin ida e volta (1 jogo por confronto). O formato MD1/MD3 acima vale para o mata-mata.';

  async function saveCupSetup() {
    if (!tournamentId) return;
    const payload: Record<string, unknown> = {
      tournamentId,
      formatoCopa: form.formatoCopa,
      formatoMataMata: form.formatoMataMata,
    };
    if (form.formatoCopa === 'swiss') {
      payload.qtdClassificados = form.qtdClassificadosSwiss;
      if (form.qtdRodadasSuico.trim()) {
        const min = minimumSwissRounds(form.qtdParticipantes, form.qtdClassificadosSwiss);
        if (Number(form.qtdRodadasSuico) < min) {
          throw new Error(`Rodadas suíças deve ser no mínimo ${min}.`);
        }
        payload.qtdRodadasSuico = form.qtdRodadasSuico;
      }
    } else if (form.formatoCopa === 'groups') {
      payload.qtdGrupos = form.qtdGrupos;
      payload.qtdClassificados = form.qtdClassificados;
    }
    await apiFetch('/updateCupSetup', { method: 'POST', auth: true, body: JSON.stringify(payload) });
    Swal.fire({ icon: 'success', title: 'Configuração salva' });
    await loadSetup(tournamentId);
  }

  async function generateCupGroups() {
    if (!tournamentId) return;
    const ok = await Swal.fire({ icon: 'warning', title: 'Gerar sorteio novamente?', showCancelButton: true, confirmButtonText: 'Sim, sortear' });
    if (!ok.isConfirmed) return;
    await apiFetch('/generateCupGroups', {
      method: 'POST',
      auth: true,
      body: JSON.stringify({
        tournamentId,
        qtdGrupos: form.qtdGrupos,
        qtdClassificados: form.qtdClassificados,
        formatoMataMata: form.formatoMataMata,
      }),
    });
    Swal.fire({ icon: 'success', title: 'Sorteio concluído' });
    await loadSetup(tournamentId);
    await loadParticipants(tournamentId, form.formatoCopa);
  }

  async function generateSwissRound(reset: boolean) {
    if (!tournamentId || form.qtdParticipantes < 2) {
      Swal.fire({ icon: 'warning', title: 'Inscritos insuficientes', text: 'São necessários pelo menos 2 inscritos.' });
      return;
    }
    const ok = await Swal.fire({
      icon: 'warning',
      title: reset ? 'Reiniciar fase suíça?' : 'Gerar próxima rodada suíça?',
      showCancelButton: true,
      confirmButtonText: reset ? 'Sim, reiniciar' : 'Sim, gerar',
    });
    if (!ok.isConfirmed) return;
    const data = await apiFetch<{ message?: string; round?: number; totalRounds?: number }>('/generateSwissRound', {
      method: 'POST',
      auth: true,
      body: JSON.stringify({ tournamentId, reset }),
    });
    Swal.fire({ icon: 'success', title: 'Rodada suíça gerada', text: data.message });
    await loadSetup(tournamentId);
    await loadParticipants(tournamentId, form.formatoCopa);
  }

  async function generateDirectKnockout() {
    if (!tournamentId || form.qtdParticipantes < 2) {
      Swal.fire({ icon: 'warning', title: 'Inscritos insuficientes' });
      return;
    }
    const ok = await Swal.fire({ icon: 'warning', title: 'Gerar chave eliminatória?', showCancelButton: true, confirmButtonText: 'Sim, sortear' });
    if (!ok.isConfirmed) return;
    await apiFetch('/generateDirectKnockout', {
      method: 'POST',
      auth: true,
      body: JSON.stringify({ tournamentId, formatoMataMata: form.formatoMataMata }),
    });
    Swal.fire({ icon: 'success', title: 'Chave gerada' });
    await loadSetup(tournamentId);
    await loadParticipants(tournamentId, form.formatoCopa);
  }

  function renderParticipants() {
    if (!participants.length) {
      return <p className="text-muted mb-0">Nenhum participante encontrado.</p>;
    }
    if (form.formatoCopa === 'groups') {
      const groups = groupByGrupo(participants, (p) => p.grupo);
      return (
        <div className="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-3">
          {groups.map(({ grupo, rows }) => {
            const theme = themeForGrupo(grupo === '_sem_grupo' ? null : grupo);
            const label = grupo === '_sem_grupo' ? 'Sem grupo' : `Grupo ${grupo}`;
            return (
              <div className="col" key={grupo}>
                <div className={`card border-${theme.color} shadow-sm`}>
                  <div className={`card-header bg-${theme.color} ${theme.text} py-2`}>{label}</div>
                  <div className="card-body p-2">
                    <table className="table table-sm mb-0">
                      <tbody>
                        {rows.map((p) => (
                          <tr key={p.participant_id}>
                            <td>{p.name}</td>
                            <td className="text-muted small">{p.email || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      );
    }
    return (
      <table className="table table-sm table-striped">
        <thead><tr><th>#</th><th>Nome</th><th>Contato</th></tr></thead>
        <tbody>
          {participants.map((p, i) => (
            <tr key={p.participant_id}><td>{i + 1}</td><td>{p.name}</td><td>{p.email}</td></tr>
          ))}
        </tbody>
      </table>
    );
  }

  const minRodadas = minimumSwissRounds(form.qtdParticipantes, form.qtdClassificadosSwiss);

  return (
    <>
      <AdminNav />
      <div className="container mt-4 mb-5">
        <h2 className="text-center mb-4">Sorteio da Copa</h2>
        <div className="row g-3">
          <div className="col-md-4">
            <div className="card">
              <div className="card-body">
                <div className="mb-3">
                  <label className="form-label">Participantes cadastrados</label>
                  <input className="form-control" disabled value={form.qtdParticipantes} />
                </div>
                <div className="mb-3">
                  <label className="form-label">Formato da copa</label>
                  <select
                    className="form-select"
                    value={form.formatoCopa}
                    onChange={(e) => {
                      const v = e.target.value as FormatoCopa;
                      setForm((f) => ({ ...f, formatoCopa: v }));
                      if (tournamentId) loadParticipants(tournamentId, v);
                    }}
                  >
                    <option value="groups">Grupos + mata-mata</option>
                    <option value="swiss">Suíço + mata-mata</option>
                    <option value="knockout">Só mata-mata (eliminatória)</option>
                  </select>
                </div>

                {form.formatoCopa === 'groups' && (
                  <>
                    <div className="mb-3">
                      <label className="form-label">Quantidade de Grupos</label>
                      <input type="number" className="form-control" min={1} max={26} value={form.qtdGrupos} onChange={(e) => setForm((f) => ({ ...f, qtdGrupos: Number(e.target.value) }))} />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Classificados por Grupo</label>
                      <input type="number" className="form-control" min={1} value={form.qtdClassificados} onChange={(e) => setForm((f) => ({ ...f, qtdClassificados: Number(e.target.value) }))} />
                    </div>
                  </>
                )}

                {form.formatoCopa === 'swiss' && (
                  <>
                    <div className="mb-3">
                      <label className="form-label">Classificados para o mata-mata</label>
                      <input type="number" className="form-control" min={2} max={128} value={form.qtdClassificadosSwiss} onChange={(e) => setForm((f) => ({ ...f, qtdClassificadosSwiss: Number(e.target.value) }))} />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Rodadas suíças</label>
                      <input
                        type="number"
                        className="form-control"
                        min={minRodadas}
                        max={SWISS_MAX_ROUNDS}
                        placeholder="Automático"
                        value={form.qtdRodadasSuico}
                        onChange={(e) => setForm((f) => ({ ...f, qtdRodadasSuico: e.target.value }))}
                      />
                      <div className="form-text">{swissHint}</div>
                    </div>
                  </>
                )}

                <div className="mb-3">
                  <label className="form-label">Formato do Mata-Mata</label>
                  <select className="form-select" value={form.formatoMataMata} onChange={(e) => setForm((f) => ({ ...f, formatoMataMata: e.target.value }))}>
                    <option value="1">MD1 (melhor de 1)</option>
                    <option value="3">MD3 (melhor de 3)</option>
                  </select>
                </div>

                <div className="d-grid gap-2 mt-4">
                  <button type="button" className="btn btn-success" onClick={() => saveCupSetup().catch((e) => Swal.fire({ icon: 'error', title: 'Erro', text: e.message }))}>
                    Salvar Configuração
                  </button>
                  {form.formatoCopa === 'groups' && (
                    <button type="button" className="btn btn-warning" onClick={() => generateCupGroups().catch((e) => Swal.fire({ icon: 'error', title: 'Erro', text: e.message }))}>
                      Sortear Grupos e Gerar Fase de Grupos
                    </button>
                  )}
                  {form.formatoCopa === 'swiss' && (
                    <button
                      type="button"
                      className="btn btn-warning"
                      onClick={() => generateSwissRound(false).catch((e) => Swal.fire({ icon: 'error', title: 'Erro', text: e.message }))}
                      onContextMenu={(e) => { e.preventDefault(); generateSwissRound(true).catch((err) => Swal.fire({ icon: 'error', title: 'Erro', text: err.message })); }}
                    >
                      Gerar Rodada Suíça
                    </button>
                  )}
                  {form.formatoCopa === 'knockout' && (
                    <button type="button" className="btn btn-warning" onClick={() => generateDirectKnockout().catch((e) => Swal.fire({ icon: 'error', title: 'Erro', text: e.message }))}>
                      Sortear Chave e Gerar Mata-Mata
                    </button>
                  )}
                </div>
                <hr />
                <div className="small text-muted">{setupHint}</div>
              </div>
            </div>
          </div>
          <div className="col-md-8">
            <div className="card">
              <div className="card-body">
                <div className="d-flex justify-content-between mb-3">
                  <h4 className="m-0">Inscritos</h4>
                  <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => tournamentId && loadParticipants(tournamentId, form.formatoCopa)}>Atualizar</button>
                </div>
                {renderParticipants()}
                <div className="text-muted small mt-2">{hint}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
