# nginx — gateway (Subway VPS)

Compose na **raiz** `registro-tour/`: `frontend` (React) + `ev-counter` + `nginx` + `certbot`.

> **Backend Express removido.** Torneios/inscrição/admin: [[projects/Subway-Hub-API-Rank]] `/web`, via gateway `/backend/` (injeta `HUB_KEY_REGISTRO`).

| Domínio (`.env`) | Destino |
|------------------|---------|
| `DOMAIN_FRONTEND` | `FRONTEND_UPSTREAM` + `/backend/` → Hub `/web/` |
| `DOMAIN_API` | proxy legado → Hub `/web/` (sem Express local) |
| `DOMAIN_EV_COUNTER` | `ev-counter:3000` |

## Variáveis do gateway Hub

```bash
HUB_WEB_UPSTREAM=https://apiv2.subway.vako.pt
HUB_WEB_HOST=apiv2.subway.vako.pt
HUB_KEY_REGISTRO=<mesma key do Hub>
VITE_API_URL=/backend
```

## Layout na VPS

```
~/registro-tour/          ← compose + nginx (este projeto)
~/Subway-Ev-Counter/      ← código ev_counter (build context)
```

## Subida

```bash
cd ~/registro-tour
# .env com DOMAIN_* + HUB_* + VITE_API_URL=/backend
docker compose up -d --build
```

## Hub API (outra VPS)

O Hub **não** corre nesta máquina. O nginx desta VPS faz proxy HTTPS para `HUB_WEB_UPSTREAM`.
