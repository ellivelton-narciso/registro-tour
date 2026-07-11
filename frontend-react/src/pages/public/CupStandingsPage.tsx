import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../api/client';
import type { PublicCupStandings, TournamentConfig } from '../../api/types';
import { CupStandingsByGroup } from '../../components/cup/CupStandingsByGroup';
import { KnockoutBracket } from '../../components/cup/KnockoutBracket';

const REFRESH_MS = 60_000;

export function CupStandingsPage() {
  const [navTitle, setNavTitle] = useState('Subway Tour');
  const [subtitle, setSubtitle] = useState('Carregando...');
  const [state, setState] = useState<'loading' | 'ended' | 'noGroups' | 'standings' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [data, setData] = useState<PublicCupStandings | null>(null);
  const [lastUpdated, setLastUpdated] = useState('');

  const loadStandings = useCallback(async () => {
    const res = await apiFetch<PublicCupStandings>('/public/cupStandings');
    if (!res.active) {
      setState('ended');
      setSubtitle('');
      return;
    }
    if (!res.hasGroups) {
      setState('noGroups');
      setSubtitle(res.titulo || res.tournamentName || '');
      return;
    }
    setData(res);
    setState('standings');
    setSubtitle(res.titulo || res.tournamentName || '');
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

        {state === 'noGroups' && (
          <div className="alert alert-info text-center">Os grupos deste torneio ainda não foram publicados.</div>
        )}

        {state === 'error' && (
          <div className="alert alert-danger text-center">{errorMsg}</div>
        )}

        {state === 'standings' && data && (
          <>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <p className="small text-muted mb-0">
                Linhas em <strong>negrito</strong> = zona de classificação.
              </p>
              <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => loadStandings()}>
                Atualizar
              </button>
            </div>
            <h2 className="h5 mb-3">Fase de grupos</h2>
            <CupStandingsByGroup
              standings={data.standings}
              qtdClassificados={data.qtdClassificados ?? 2}
            />

            {data.knockout?.hasKnockout && (
              <div className="mt-5">
                <h2 className="h5 mb-2">Chave do mata-mata</h2>
                <p className="small text-muted mb-3">
                  {data.knockout.cupFinished
                    ? 'Campeão definido.'
                    : 'Confrontos da esquerda para a direita; vencedores avançam na ordem da chave.'}
                </p>
                <div className="cup-bracket-wrap">
                  <KnockoutBracket matches={data.knockout.matches} />
                </div>
              </div>
            )}

            <p className="text-muted small text-center mt-3 mb-0">{lastUpdated}</p>
          </>
        )}
      </div>
    </div>
  );
}
