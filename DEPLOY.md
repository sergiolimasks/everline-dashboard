# Everline Dashboard — Deploy & Operação

Guia completo pra subir alterações em produção. **Sempre testa local primeiro, depois deploya.**

## 🗺️ Arquitetura

```
Browser (cliente)
      │
      ├── https://agenciaeverline.com.br  → Hostinger (IP em .env.deploy.local)
      │                                     Apache serve dist/ estático
      │                                     .htaccess SPA routing + force HTTPS
      │
      └── https://api.agenciaeverline.com.br → VPS (IP em .env.deploy.local)
                                              Traefik v2.11.3 (network_swarm_public)
                                              └─ container everline-api_api
                                                 Node 20 + tsx src/index.ts
                                                 Porta 3001 (interna)
                                                 ↓
                                           PostgreSQL 16 local da VPS
                                           schema: auth_everline (+ uelicon_database, bd_ads_clientes já existentes)
```

**Por que não mexe no Traefik:** o stack Everline usa labels Docker (`traefik.enable=true`, `traefik.http.routers.everline-api.rule=...`). O Traefik tem `providers.docker.swarmMode=true`, então descobre serviços novos automaticamente. **Nunca editar arquivo de config do Traefik** — só adicionar labels em novos containers.

## 🏠 Ambiente local

**Path do projeto:** `/Users/srglimasks/Documents/backup-cc/Everline/`

**Frontend (Vite):**
```bash
cd /Users/srglimasks/Documents/backup-cc/Everline
npm install        # primeira vez
npm run dev        # http://localhost:8080
```

**Backend (Node/Express via tsx watch):**
```bash
cd /Users/srglimasks/Documents/backup-cc/Everline/api
npm install        # primeira vez
npm run dev        # http://localhost:3001
```

**Banco local:** `everline` no PostgreSQL do Homebrew, user `srglimasks` sem senha. Contém o schema `auth_everline` + cópias de `uelicon_database` e `bd_ads_clientes` puxadas da VPS em 2026-04-10.

**Env vars (arquivos locais, NUNCA commitar):**
- `Everline/.env` — `VITE_API_URL=http://localhost:3001`
- `Everline/api/.env` — `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN=http://localhost:8080`, `PORT=3001`
- `Everline/.env.deploy.local` — credenciais pra scripts de deploy (VPS/Hostinger/PG). **Gitignored.** Ver `.env.deploy.example` como template. Source antes dos comandos de deploy:
  ```bash
  set -a; . .env.deploy.local; set +a
  ```

## 🚢 Como subir alterações

### 1. Desenvolver + testar local

```bash
# frontend (terminal 1)
cd /Users/srglimasks/Documents/backup-cc/Everline && npm run dev

# backend (terminal 2)
cd /Users/srglimasks/Documents/backup-cc/Everline/api && npm run dev
```

Faz as mudanças, testa em `http://localhost:8080`. Garante que:
- `npx tsc --noEmit` passa nos dois (frontend e api)
- Não quebrou nada do que já funcionava

### 2. Deploy do backend (VPS)

Quando você mudou código em `api/`, scripts em `api/db/migrations/`, ou qualquer coisa da API:

```bash
cd /Users/srglimasks/Documents/backup-cc/Everline/api

# 1. Upload do código (tar-over-ssh, rsync não existe na VPS)
tar czf - --exclude node_modules --exclude 'db/dumps' --exclude .env . | \
  sshpass -p "$VPS_SSH_PASS" ssh -p 22 root@"$VPS_HOST" \
  "cd /root/everline-api && rm -rf src db Dockerfile docker-compose.yml *.json *.ts *.js 2>/dev/null; tar xzf - && find . -name '._*' -delete"

# 2. Build da imagem Docker (demora ~15s com cache)
sshpass -p "$VPS_SSH_PASS" ssh root@"$VPS_HOST" \
  "cd /root/everline-api && docker build -t everline-api:latest ."

# 3. Force rolling update do serviço Swarm (zero downtime)
sshpass -p "$VPS_SSH_PASS" ssh root@"$VPS_HOST" \
  "docker service update --force --image everline-api:latest everline-api_api"

# 4. Verificar health
curl https://api.agenciaeverline.com.br/health
# esperado: {"ok":true,"db":"up"}
```

**Se adicionou migrations**, elas rodam **automaticamente** no boot (`runMigrations()` em `src/index.ts`). Idempotentes — seguras pra rerun.

**Se precisar reiniciar o container sem rebuild:**
```bash
sshpass -p "$VPS_SSH_PASS" ssh root@"$VPS_HOST" "docker service update --force everline-api_api"
```

**Logs em tempo real:**
```bash
sshpass -p "$VPS_SSH_PASS" ssh root@"$VPS_HOST" "docker service logs -f everline-api_api"
```

### 3. Deploy do frontend (Hostinger)

Quando mudou código em `src/`, `public/`, `index.html`, ou `.env.production`:

```bash
cd /Users/srglimasks/Documents/backup-cc/Everline

# 1. Garantir env de produção
cat > .env.production <<EOF
VITE_API_URL=https://api.agenciaeverline.com.br
EOF

# 2. Build
npm run build   # gera dist/

# 3. Criar .htaccess (já deveria existir, mas recriar é seguro)
cat > dist/.htaccess <<'HT'
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]

RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

<FilesMatch "\.(js|css|jpg|jpeg|png|gif|svg|woff2?|ttf)$">
  Header set Cache-Control "public, max-age=31536000, immutable"
</FilesMatch>
<FilesMatch "\.(html)$">
  Header set Cache-Control "no-cache, no-store, must-revalidate"
</FilesMatch>
HT

# 4. Upload via SSH tar (troca o conteúdo inteiro)
cd dist && tar czf - . | \
  sshpass -p "$HOSTINGER_SSH_PASS" ssh -o StrictHostKeyChecking=no -p 65002 u435641156@"$HOSTINGER_HOST" \
  "cd ~/domains/agenciaeverline.com.br/public_html && rm -rf ./* .htaccess 2>/dev/null; tar xzf - && find . -name '._*' -delete"
cd ..

# 5. Testar
curl -I https://agenciaeverline.com.br
# esperado: HTTP/2 200
```

## 🔐 Credenciais & acessos

> **Credenciais reais não ficam neste arquivo.** Todos os segredos (senhas SSH,
> senha do Postgres, JWT prod, login admin) estão em `.env.deploy.local`
> (gitignored) e na memória Claude do Sérgio em
> `~/.claude/.../memory/reference_everline_prod.md`. Este doc lista só o que
> é público/estrutural.

### Produção
| Item | Valor |
|---|---|
| Frontend URL | https://agenciaeverline.com.br |
| API URL | https://api.agenciaeverline.com.br |
| Admin login | `sergiolima@agenciaevergrowth.com.br` — senha em `.env.deploy.local` |
| JWT_SECRET prod | em `.env.deploy.local` (`JWT_SECRET`) |

### VPS (backend)
| Item | Valor |
|---|---|
| IP | em `.env.deploy.local` (`VPS_HOST`) |
| SSH | `ssh root@$VPS_HOST` — senha em `.env.deploy.local` (`VPS_SSH_PASS`) |
| Código deployado | `/root/everline-api/` |
| Stack Docker | `everline-api` (serviço `everline-api_api`) |
| Network | `network_swarm_public` (mesmo do Traefik) |
| PostgreSQL | `127.0.0.1:5432`, user `postgres`, senha em `.env.deploy.local` (`PG_PASS`), db `postgres` |
| Conexão DB do container | `host.docker.internal:5432` via extra_hosts |

### Hostinger (frontend)
| Item | Valor |
|---|---|
| IP / SSH host | em `.env.deploy.local` (`HOSTINGER_HOST`) porta `65002` |
| SSH user/senha | `u435641156` / em `.env.deploy.local` (`HOSTINGER_SSH_PASS`) |
| Public dir | `/home/u435641156/domains/agenciaeverline.com.br/public_html/` |
| FTP host | mesmo IP da coluna acima, porta `21` |
| FTP user | `u435641156.agenciaeverline.com.br` / mesma senha do SSH |

### DNS (Hostinger ou Cloudflare — confirmar quem gerencia)
| Record | Tipo | Valor |
|---|---|---|
| `agenciaeverline.com.br` | A | `$HOSTINGER_HOST` |
| `www.agenciaeverline.com.br` | A | `$HOSTINGER_HOST` |
| `api.agenciaeverline.com.br` | A | `$VPS_HOST` |

## 📁 Estrutura do repositório

```
Everline/
├── src/                          ← Frontend React (Vite + TS + shadcn/ui)
│   ├── lib/
│   │   ├── api.ts                ← Cliente HTTP (cookies httpOnly + 401 handler)
│   │   └── dashboard-api.ts      ← Tipos + chamadas ao /dashboard-data
│   ├── contexts/AuthContext.tsx
│   ├── components/
│   │   ├── dashboard/KPICards.tsx  ← Cards de métricas
│   │   ├── admin/                   ← Tabs de admin (criar user, atribuir acesso)
│   │   ├── ErrorBoundary.tsx
│   │   └── ProtectedRoute.tsx
│   └── pages/
│       ├── Home.tsx, Login.tsx
│       ├── Panel.tsx              ← Página de seleção de cliente (admin + gestor + clientView)
│       ├── Index.tsx              ← Dashboard principal (projectKey configurável)
│       ├── SistemaLeads.tsx, Distribuicao.tsx
│
├── api/                          ← Backend Node/Express
│   ├── src/
│   │   ├── index.ts              ← helmet + cookie-parser + cors + auto-migrate + graceful shutdown
│   │   ├── db.ts                 ← pg Pool (statement_timeout, type parsers p/ BIGINT/NUMERIC)
│   │   ├── auth.ts               ← JWT c/ token_version + cookies httpOnly + requireAuth/requireAdmin
│   │   ├── migrate.ts            ← Runner idempotente das migrations
│   │   ├── seed.ts               ← Cria/atualiza admin sergiolima
│   │   └── routes/
│   │       ├── auth.ts           ← /auth/login (rate limit) /me /logout
│   │       ├── admin.ts          ← CRUD users/roles/access/clients/offers (zod validation)
│   │       ├── dashboard.ts      ← GET /dashboard-data?endpoint=... (summary/traffic/sales/campaigns/ads/attribution)
│   │       ├── dashboard-config.ts  ← PROJECTS, filter builders
│   │       └── dashboard-helpers.ts ← queryAttribution, canonicalPhone, queryLeadToSaleAvgDays, etc
│   ├── db/
│   │   ├── migrations/           ← Numeradas 001_*.sql, rodam no boot
│   │   │   ├── 001_init.sql                             (schema auth_everline)
│   │   │   ├── 002_token_version_and_unique_role.sql
│   │   │   ├── 003_uelicon_real_dashboards.sql          (seed 4 dashboards do Uelicon)
│   │   │   ├── 004_fix_broken_pixel_views_apr_02_08.sql (fix dados históricos)
│   │   │   ├── 005_fix_broken_pixel_views_mar_19.sql
│   │   │   ├── 006_tmb_telefone_backfill.sql            (backfill phone TMB)
│   │   │   ├── 007_last_login_at.sql
│   │   │   └── 008_user_campaign_access_client_id.sql
│   │   └── dumps/                ← gitignored; pg_dump local pra clone da VPS
│   ├── Dockerfile                ← Alpine Node 20 + npm install + CMD npm start
│   ├── docker-compose.yml        ← Stack Swarm c/ labels Traefik + network external
│   ├── package.json              ← scripts: dev, start, migrate, seed, typecheck, lint
│   └── .env                      (gitignored — criar a partir de .env.example)
│
├── db/                           ← Dumps históricos (migration 006 espera CSV aqui)
├── dist/                         ← Build do frontend (gitignored)
├── index.html
├── package.json                  ← Deps do frontend (React, shadcn, recharts, etc)
├── vite.config.ts                ← Code splitting por vendor (charts/radix/react/query/date)
├── .env.production               ← VITE_API_URL pra build de produção
└── DEPLOY.md                     ← este arquivo
```

## 🛠️ Comandos úteis

### Backend
```bash
# Rodar migrations manualmente (VPS)
sshpass -p "$VPS_SSH_PASS" ssh root@"$VPS_HOST" \
  "docker exec -it \$(docker ps -q -f name=everline-api_api) npm run migrate"

# Re-seedar admin (útil se resetar senha)
sshpass -p "$VPS_SSH_PASS" ssh root@"$VPS_HOST" \
  "docker exec -it \$(docker ps -q -f name=everline-api_api) npm run seed"

# Query direto no PG da VPS (precisa de psql instalado local — Homebrew tem)
PGPASSWORD="$PG_PASS" psql -h "$VPS_HOST" -U postgres -d postgres \
  -c "SELECT email, role FROM auth_everline.users u LEFT JOIN auth_everline.user_roles r ON r.user_id = u.id;"

# Ver logs em tempo real
sshpass -p "$VPS_SSH_PASS" ssh root@"$VPS_HOST" \
  "docker service logs -f everline-api_api --tail 100"

# Restart sem rebuild
sshpass -p "$VPS_SSH_PASS" ssh root@"$VPS_HOST" \
  "docker service update --force everline-api_api"
```

### Frontend
```bash
# Build de produção (usa .env.production)
cd /Users/srglimasks/Documents/backup-cc/Everline && npm run build

# Listar arquivos na Hostinger
sshpass -p "$HOSTINGER_SSH_PASS" ssh -p 65002 u435641156@"$HOSTINGER_HOST" \
  "ls -la ~/domains/agenciaeverline.com.br/public_html/"

# Limpar public_html
sshpass -p "$HOSTINGER_SSH_PASS" ssh -p 65002 u435641156@"$HOSTINGER_HOST" \
  "cd ~/domains/agenciaeverline.com.br/public_html && rm -rf ./* .htaccess"
```

## 🧪 Checklist pré-deploy

Antes de qualquer deploy, rodar local:

```bash
cd /Users/srglimasks/Documents/backup-cc/Everline
npx tsc --noEmit                          # frontend typecheck
cd api && npx tsc --noEmit && cd ..        # api typecheck
npm run build                              # build do frontend
```

Se tudo passa sem erros, deploy é seguro.

## 🚨 Rollback

### Backend
Docker Swarm mantém versões anteriores por padrão:
```bash
sshpass -p "$VPS_SSH_PASS" ssh root@"$VPS_HOST" \
  "docker service rollback everline-api_api"
```

### Frontend
A menos que tenha backup manual, você precisa rebuildar da versão anterior do código (checkout git + npm run build + upload). Por isso: **commita antes de cada deploy importante**.

### Migrations
Ver `backup table` registrada por cada migration (ex: `views_pagina_fix_log`, `controle_tmb_cleanup_log`, `controle_green_cleanup_log`). Reverter = `INSERT INTO ... SELECT row_snapshot`. Migration nunca dropa dados sem backup.

## 🔒 Regras críticas

- **Nunca mexer no Traefik**: só adicionar labels em containers novos
- **Nunca commitar .env**: usa .env.example como template
- **Testar local antes de subir**: typecheck + dev server
- **Backup do `auth_everline` semanal**: `PGPASSWORD="$PG_PASS" pg_dump -h "$VPS_HOST" -U postgres -n auth_everline postgres > backup.sql`
- **Migrations sempre idempotentes**: rodar 2x deve ser no-op, não erro
