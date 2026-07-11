import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { apiFetch } from '../../api/client';
import type { TournamentConfig } from '../../api/types';

export function ClosedPage() {
  const [open, setOpen] = useState<boolean | null>(null);

  useEffect(() => {
    document.title = 'Inscrições Encerradas';
    let cancelled = false;

    apiFetch<TournamentConfig>('/getConfig')
      .then((data) => {
        if (cancelled) return;
        setOpen(data.encerrado === 0 || data.encerrado === false);
      })
      .catch(() => {
        if (!cancelled) setOpen(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (open === true) return <Navigate to="/" replace />;

  return (
    <div className="page-shell d-flex justify-content-center align-items-center">
      <div className="surface-card text-center" style={{ maxWidth: 480 }}>
        <h1 className="text-danger fs-2">Inscrições Encerradas</h1>
        <p className="mt-2">As inscrições para o torneio foram encerradas. Obrigado pelo seu interesse!</p>
        <p className="mt-3">
          <Link to="/grupos-copa">Ver classificação dos grupos</Link>
        </p>
      </div>
    </div>
  );
}
