# nginx — gateway (Subway VPS)

Compose na **raiz** `registro-tour/`: `api` + `frontend` (React) + `ev-counter` (Next.js) + `nginx` + `certbot`.

> **VPS:** `vps-aba40034` — **separada** do Hub API (`pokedex` / `apiv2`). Aqui o nginx Docker ocupa **80/443** (substitui Apache após migração).

| Domínio (`.env`) | Destino | Apache antigo (sites-available) |
|------------------|---------|----------------------------------|
| `DOMAIN_FRONTEND` | `FRONTEND_UPSTREAM` (default `frontend:80`) | `ds-front*.conf` — antes `/var/www/ds` |
| `DOMAIN_API` | `api:3000` (Express) | `api-registro.conf` |
| `DOMAIN_EV_COUNTER` | `ev-counter:3000` (Next.js) | `ev-counter*.conf` |

Ignorar nesta stack: `underground-*`, `torneio-capo*`, `public-placar*`, `api-oldgen-registro`, `api-underground-registro` (apps off ou fora do escopo Subway).

## Layout na VPS

```
~/registro-tour/          ← compose + nginx (este projeto)
~/Subway-Ev-Counter/      ← código ev_counter (build context)
~/ds -> /var/www/ds       ← legado estático (substituído pelo container frontend)
~/config.js               ← legado do front antigo (React usa VITE_API_URL no build)
```

No `.env` (já é o default do compose; só alterar se a pasta tiver outro nome):

```bash
EV_COUNTER_BUILD_CONTEXT=../Subway-Ev-Counter
EV_COUNTER_ENV_FILE=../Subway-Ev-Counter/.env
```

## Primeira subida (VPS)

1. DNS: registos A para `DOMAIN_FRONTEND`, `DOMAIN_API` e `DOMAIN_EV_COUNTER` (copiar `ServerName` do Apache).
2. `backend/.env` com PostgreSQL e `JWT_SECRET`.
3. `Subway-Ev-Counter/.env` com `DATABASE_URL`.
4. Copiar `.env.example` → `.env` na raiz e ajustar domínios + `VITE_API_URL`.
5. Subir apps (sem HTTPS ainda — nginx entra em modo bootstrap HTTP):

```bash
cd ~/registro-tour
docker compose up -d --build api frontend ev-counter
```

6. **Parar Apache** (porta 80 livre para nginx + certbot):

```bash
sudo systemctl stop apache2
docker compose up -d --build nginx
docker compose logs nginx
# deve mostrar: "modo HTTP-only (bootstrap)"
```

7. Emitir certificado Let's Encrypt (HTTP-01 via webroot):

```bash
docker compose run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d registro-ds.vako.pt \
  -d SEU_DOMINIO_API \
  -d SEU_DOMINIO_EV_COUNTER \
  --email SEU_EMAIL@exemplo.com \
  --agree-tos \
  --no-eff-email
```

(Ajuste os `-d` aos domínios reais do `.env` — `SSL_CERT_DIR` deve ser o **primeiro** `-d`.)

8. Reiniciar nginx (deteta certificado e passa a HTTPS):

```bash
docker compose up -d --build nginx
docker compose logs nginx
# deve mostrar: "certificado encontrado — modo HTTPS"
```

9. Stack completa:

```bash
docker compose up -d
```

9. Validar os três hosts no browser. Só então desativar Apache de forma permanente:

```bash
sudo a2dissite ds-front ds-front-le-ssl api-registro ev-counter ev-counter-le-ssl
# manter desabilitados os sites já off (underground, torneio-capo, public-placar)
sudo systemctl disable apache2   # opcional, após período de observação
```

## Certificados já existentes no Apache

Se o Apache já emitiu certs em `/etc/letsencrypt/live/registro-ds.vako.pt/` (ou o teu `SSL_CERT_DIR`), podes reutilizá-los **sem novo certbot** montando o host no compose (temporário ou permanente):

```yaml
# em docker-compose.yml, serviços nginx e certbot — trocar o volume nomeado por:
- /etc/letsencrypt:/etc/letsencrypt
```

Depois `docker compose up -d --build nginx` — o entrypoint deteta o cert e sobe em HTTPS.

## Renovação

O serviço `certbot` renova automaticamente a cada 12h (`certbot renew --quiet`).

## Migração Apache → Docker (resumo)

| Antes (Apache) | Depois (Docker) |
|----------------|-----------------|
| `ProxyPass` → porta local da API | `api:3000` na rede compose |
| `DocumentRoot /var/www/ds` | `frontend` (React build) |
| `ProxyPass` → ev counter :3001 | `ev-counter:3000` |
| `mod_ssl` + certbot Apache | `nginx` + `certbot` no compose |

## Armadilhas

- Se `DOMAIN_API` no `.env` não coincidir com o host real, o nginx envia o tráfego para o **primeiro** bloco HTTPS (frontend) em vez da API.
- `NGINX_ENVSUBST_FILTER` usa regex com `|` — não usar lista separada por espaços.
- Monorepo local (`~/Documentos/Code/Subway/`): override `EV_COUNTER_BUILD_CONTEXT=../ev_counter` no `.env`.

## Hub API (outra VPS)

O [[projects/Subway-Hub-API-Rank]] **não** corre nesta máquina. Não há conflito de 80/443 com o gateway do Hub.
