import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { apiFetch } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';

export function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    document.title = 'Login Admin';
  }, []);

  if (isAuthenticated) return <Navigate to="/admin" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await apiFetch<{ success?: boolean; token?: string; error?: string }>('/login', {
        method: 'POST',
        body: JSON.stringify({ user: username, password }),
      });
      if (res.success && res.token) {
        login(res.token);
        return;
      }
      Swal.fire({ icon: 'error', title: 'Login falhou', text: res.error || 'Erro desconhecido' });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Erro',
        text: err instanceof Error ? err.message : 'Erro ao tentar fazer login.',
      });
    }
  }

  return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh', backgroundColor: '#f7f7f7' }}>
      <div className="card" style={{ width: '20rem' }}>
        <div className="card-body">
          <h5 className="card-title text-center">Login Admin</h5>
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="username" className="form-label">Usuário</label>
              <input
                type="text"
                className="form-control"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="mb-3">
              <label htmlFor="password" className="form-label">Senha</label>
              <input
                type="password"
                className="form-control"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary w-100">Entrar</button>
          </form>
        </div>
      </div>
    </div>
  );
}
