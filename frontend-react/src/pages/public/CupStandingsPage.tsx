import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL, apiFetch } from '../../api/client';
import type { PublicCupStandings, TournamentConfig } from '../../api/types';
import { CupStandingsByGroup } from '../../components/cup/CupStandingsByGroup';
import { KnockoutBracket } from '../../components/cup/KnockoutBracket';

const REFRESH_MS = 60_000;

function waitingMessage(formatoCopa?: string) {
  if (formatoCopa === 'knockout') {
    return 'A chave do mata-mata deste torneio ainda não foi publicada.';
  }
  if (formatoCopa === 'swiss') {
    return 'A fase suíça deste torneio ainda não foi publicada.';
  }
  return 'Os grupos deste torneio ainda não foram publicados.';
}

function phaseTitle(formatoCopa?: string) {
  if (formatoCopa === 'swiss') return 'Fase suíça';
  return 'Fase de grupos';
}

export function CupStandingsPage() {
  const [navTitle, setNavTitle] = useState('Subway Tour');
  const [subtitle, setSubtitle] = useState('Carregando...');
  const [state, setState] = useState<'loading' | 'ended' | 'waiting' | 'standings' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [data, setData] = useState<PublicCupStandings | null>(null);
  const [lastUpdated, setLastUpdated] = useState('');

  const loadStandings = useCallback(async () => {
    const res = await apiFetch<PublicCupStandings>('/public/cupStandings');
    if (!res.active) {
      setState('ended');
      setSubtitle('');
      setData(null);
      return;
    }

    const subtitleText = res.titulo2 || res.titulo || res.tournamentName || '';
    const hasContent =
      res.hasPublishedContent ??
      Boolean(res.hasGroups || res.knockout?.hasKnockout);

    if (!hasContent) {
      setData(res);
      setState('waiting');
      setSubtitle(subtitleText);
      return;
    }

    setData(res);
    setState('standings');
    setSubtitle(subtitleText);
    setLastUpdated(`Atualizado às ${new Date().toLocaleTimeString('pt-BR')}`);
  }, []);

  useEffect(() => {
    document.title = 'Copa — Grupos e Mata-mata';
    apiFetch<TournamentConfig>('/getConfig')
      .then((cfg) => {
        if (cfg.titulo) {
          setNavTitle(cfg.titulo);
          document.title = `${cfg.titulo} — Grupos`;
        }
      })
      .catch(console.warn);

    loadStandings().catch((err) => {
      setState('error');
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao carregar');
    });

    const id = setInterval(() => loadStandings().catch(console.error), REFRESH_MS);
    return () => clearInterval(id);
  }, [loadStandings]);

  return (
    <div className="page-shell">
      <nav className="navbar navbar-expand-lg navbar-light navbar-surface shadow-sm">
        <div className="container">
          <Link className="navbar-brand fw-semibold" to="/">{navTitle}</Link>
          <div className="navbar-nav ms-auto">
            <Link className="nav-link active" to="/grupos-copa">Classificação</Link>
          </div>
        </div>
      </nav>

      <div className="container mt-4 mb-5">
        <div className="text-center mb-4">
          <h1 className="h2 mb-1">Copa Subway</h1>
          <p className="text-muted mb-0">{subtitle}</p>
        </div>

        {state === 'ended' && (
          <div className="alert alert-secondary text-center">O torneio atual já foi encerrado.</div>
        )}

        {state === 'waiting' && (
          <div className="alert alert-info text-center">{waitingMessage(data?.formatoCopa)}</div>
        )}

        {state === 'error' && (
          <div className="alert alert-danger text-center">{errorMsg}</div>
        )}

        {state === 'standings' && data && (
          <>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <p className="small text-muted mb-0">
                {data.hasGroups
                  ? <>Linhas em <strong>negrito</strong> = zona de classificação.</>
                  : data.formatoCopa === 'knockout'
                    ? 'Formato: só mata-mata (sem fase de grupos).'
                    : null}
              </p>
              <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => loadStandings()}>
                Atualizar
              </button>
            </div>

            {data.championsMode && (data.participants?.length ?? 0) > 0 && (
              <section className="mb-5">
                <h2 className="h5 mb-3">Times (Champions)</h2>
                <div className="table-responsive">
                  <table className="table table-sm table-striped align-middle">
                    <thead className="table-light">
                      <tr>
                        <th>Jogador</th>
                        <th>Print do time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.participants!.map((p) => (
                        <tr key={p.participant_id}>
                          <td>{p.name}</td>
                          <td>
                            {p.teamImage ? (
                              <a
                                href={`${API_URL}/team-images/${p.teamImage}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Ver print do time
                              </a>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {data.hasGroups && (
              <section className="mb-5">
                <h2 className="h5 mb-3">{phaseTitle(data.formatoCopa)}</h2>
                <CupStandingsByGroup
                  standings={data.standings}
                  qtdClassificados={data.qtdClassificados ?? 2}
                />
              </section>
            )}

            {data.knockout?.hasKnockout && (
              <section className="mt-2">
                <h2 className="h5 mb-2">Chave do mata-mata</h2>
                <p className="small text-muted mb-3">
                  {data.knockout.cupFinished
                    ? 'Campeão definido.'
                    : 'Confrontos da esquerda para a direita; vencedores avançam na ordem da chave.'}
                </p>
                <div className="cup-bracket-wrap">
                  <KnockoutBracket matches={data.knockout.matches} />
                </div>
              </section>
            )}

            <p className="text-muted small text-center mt-3 mb-0">{lastUpdated}</p>
          </>
        )}
      </div>
    </div>
  );
}
