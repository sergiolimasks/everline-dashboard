# Everline Dashboard

Dashboard interno da Agência Ever Line. Consolida métricas de tráfego, vendas,
campanhas e funis dos clientes em um painel único.

- **Produção**: https://agenciaeverline.com.br
- **API**: https://api.agenciaeverline.com.br (health: `/health`)

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Vite + React 18 + TypeScript + shadcn/ui + Tailwind + Recharts |
| Backend | Node 20 + Express + TypeScript (tsx) + JWT httpOnly cookies |
| Banco | PostgreSQL 16 (schema `auth_everline` + schemas de dashboards compartilhados) |
| Deploy frontend | Hostinger shared hosting (Apache + SPA routing via .htaccess) |
| Deploy backend | VPS Docker Swarm atrás do Traefik v2.11.3 |
| Auth | JWT com `token_version` + cookies httpOnly Secure |

## Estrutura

```
Everline/
├── src/                    ← Frontend React
│   ├── pages/              ← Home, Login, Panel, Index (dashboards), Distribuicao, SistemaLeads
│   ├── components/         ← KPICards, ErrorBoundary, admin tabs, ProtectedRoute
│   ├── contexts/           ← AuthContext
│   └── lib/                ← api client (cookie-based), dashboard-api
├── api/                    ← Backend Node/Express
│   ├── src/
│   │   ├── index.ts        ← server bootstrap (helmet + cors + auto-migrate + graceful shutdown)
│   │   ├── auth.ts         ← requireAuth / requireAdmin / JWT issue
│   │   ├── db.ts           ← pg Pool (statement_timeout, BIGINT/NUMERIC parsers)
│   │   ├── migrate.ts      ← idempotent migration runner
│   │   ├── seed.ts         ← bootstrap admin (via SEED_ADMIN_PASSWORD env)
│   │   └── routes/         ← auth, admin, dashboard (+ dashboard-helpers, dashboard-config)
│   ├── db/migrations/      ← *.sql numeradas, rodam no boot
│   ├── Dockerfile          ← Alpine Node 20
│   └── docker-compose.yml  ← Swarm stack com labels Traefik + env substitution
├── DEPLOY.md               ← Guia completo de deploy + rollback + troubleshooting
├── .env.example            ← Template frontend (VITE_API_URL)
└── .env.deploy.example     ← Template das credenciais de deploy (nunca commitado)
```

## Desenvolvimento local

Pré-requisitos: Node 20+, PostgreSQL local (Homebrew), npm.

```bash
# 1. Clone e instale
git clone https://github.com/sergiolimasks/everline-dashboard.git
cd everline-dashboard

# 2. Frontend env
cp .env.example .env
# .env já aponta pra http://localhost:3001 por default

# 3. Backend env
cp api/.env.example api/.env
# ajustar DATABASE_URL pro PG local e gerar JWT_SECRET:
# node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

# 4. Instalar deps
npm install
(cd api && npm install)

# 5. Subir
npm run dev          # frontend em http://localhost:8080
(cd api && npm run dev)  # API em http://localhost:3001
```

As migrations rodam automaticamente no boot da API (idempotentes). Pra criar
o admin inicial:

```bash
cd api
SEED_ADMIN_PASSWORD="sua-senha-aqui" npm run seed
```

## Documentação

| Doc | O que tem |
|---|---|
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Topologia, fluxo de auth, fluxo de dados, decisões de design, limitações conhecidas |
| [`docs/API.md`](./docs/API.md) | Referência completa das rotas (auth, admin, dashboard) com exemplos |
| [`docs/DATABASE.md`](./docs/DATABASE.md) | Schemas, tabelas, migrations, grants do user `everline_api`, queries de debug |
| [`docs/DASHBOARDS.md`](./docs/DASHBOARDS.md) | Os 4 projetos (checkup, formacao-consultor, sistema-leads, distribuicao), suas ofertas e como adicionar projetos/clientes novos |
| [`DEPLOY.md`](./DEPLOY.md) | Passo a passo de deploy (VPS + Hostinger), rollback, troubleshooting |

Credenciais sensíveis (senhas SSH, senha PG, JWT prod, login admin) ficam em
`.env.deploy.local` (gitignored). Use `.env.deploy.example` como template.

## Segurança

- Segredos **nunca** são commitados. `.env`, `.env.*`, `.env.deploy.local`
  e `api/db/dumps/` estão gitignored.
- O container de produção recebe secrets via env substitution
  (`${DATABASE_URL:?}`), lendo de `/root/everline-api/.env.production` com
  permissão `600`.
- A API usa um user PG dedicado (`everline_api`) com grants mínimos —
  `postgres` superuser não é usado em runtime.
- Histórico do repositório foi purgado de credenciais vazadas via
  `git-filter-repo` antes do primeiro push.

## Checks pré-deploy

```bash
npx tsc --noEmit                      # frontend typecheck
(cd api && npx tsc --noEmit)          # api typecheck
npm run build                         # build do frontend
```

## Licença

Privado. Uso interno da Agência Ever Line.
