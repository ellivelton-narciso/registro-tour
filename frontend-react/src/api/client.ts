export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type ApiOptions = RequestInit & { auth?: boolean };

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.auth) {
    const token = sessionStorage.getItem('token');
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && options.auth) {
    sessionStorage.removeItem('token');
    window.location.href = '/admin/login';
    throw new ApiError('Não autorizado', 401);
  }

  if (!res.ok) {
    throw new ApiError(data.error || data.message || 'Erro na requisição', res.status);
  }

  return data as T;
}
