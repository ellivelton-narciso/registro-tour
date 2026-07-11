import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../api/client';
import type { TournamentConfig } from '../../api/types';

export function ClosedPage() {
  useEffect(() => {
    document.title = 'Inscrições Encerradas';
    apiFetch<TournamentConfig>('/getConfig')
      .then((data) => {
        if (data.encerrado === 0 || data.encerrado === false) {
          window.location.href = '/';
        }
      })
      .catch(console.error);
  }, []);

  return (
    <div
      className="d-flex justify-content-center align-items-center"
      style={{ minHeight: '100vh', textAlign: 'center', backgroundColor: '#f8f9fa' }}
    >
      <div className="bg-white p-4 rounded shadow-sm" style={{ maxWidth: 480 }}>
        <h1 className="text-danger fs-2">Inscrições Encerradas</h1>
        <p className="mt-2">As inscrições para o torneio foram encerradas. Obrigado pelo seu interesse!</p>
        <p className="mt-3">
          <Link to="/grupos-copa">Ver classificação dos grupos</Link>
        </p>
      </div>
    </div>
  );
}
