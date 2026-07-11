# registro-tour — frontend React

Frontend em **React + TypeScript + Vite**, espelhando o `frontend/` legado (HTML + jQuery).

## Setup

Requer **Node ^20.19.0 ou >=22.12.0** (Vite 8). Na VPS com nvm: `nvm install 22 && nvm alias default 22`.

```bash
cd frontend-react
cp .env.example .env
npm install
npm run dev
```

Configure `VITE_API_URL` no `.env` (ex.: `http://localhost:3000`).

## Rotas

| Rota | Página legada |
|------|----------------|
| `/` | `index.html` — inscrição |
| `/encerradas` | `encerradas.html` |
| `/grupos-copa` | `grupos-copa.html` |
| `/admin/login` | `admin/login.html` |
| `/admin` | `admin/index.html` |
| `/admin/participantes` | `admin/participantes.html` |
| `/admin/sorteio-grupos` | `admin/sorteio-grupos.html` |
| `/admin/confrontos-copa` | `admin/confrontos-copa.html` |
| `/admin/exclusivos` | `admin/exclusivos.html` |

## Build

```bash
npm run build
```

Artefatos em `dist/` — servir via nginx ou container Docker.

## Deploy (Docker + nginx + certbot)

Produção usa o compose na **raiz** do projeto (`../docker-compose.yml`), no mesmo padrão do [[projects/Subway-Hub-API-Rank]]:

```bash
cd ..   # registro-tour/
cp .env.example .env
# Ajustar DOMAIN_FRONTEND, DOMAIN_API, VITE_API_URL
cp backend/.env.example backend/.env   # se existir; DB + JWT

docker compose up -d --build
```

| Serviço | Função |
|---------|--------|
| `frontend` | Build deste projeto (`Dockerfile` multi-stage) → nginx estático SPA |
| `api` | Express :3000 |
| `nginx` | HTTPS 80/443, dois subdomínios |
| `certbot` | Renovação Let's Encrypt |

Ver `../nginx/README.md` para emissão inicial do certificado e conflito de portas com o Hub API na mesma VPS.

## Notas

- Auth: JWT em `sessionStorage.token` (igual ao legado).
- API: `VITE_API_URL` substitui `config.js` + `assets/js/.env`.
- O `frontend/` original permanece intacto para transição gradual.
