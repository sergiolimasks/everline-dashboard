# Arquitetura

Visão geral da stack Everline Dashboard: como as peças se conectam, por onde os
dados fluem, como autenticação funciona, e por que algumas decisões foram
tomadas.

## Topologia

```
                    ┌──────────────────────────┐
                    │   Usuário (Browser)       │
                    └────────────┬──────────────┘
                                 │ HTTPS
              ┌──────────────────┼──────────────────┐
              │                                     │
              ▼                                     ▼
   https://agenciaeverline.com.br        https://api.agenciaeverline.com.br
   (Hostinger shared hosting)            (VPS — Docker Swarm + Traefik)
              │                                     │
              │ Apache + .htaccess                  │ Traefik v2.11.3
              │ SPA routing + force HTTPS           │ (network_swarm_public)
              │                                     │
              ▼                                     ▼
      dist/ (Vite build)                  everline-api_api (Swarm service)
      └─ index.html                        └─ Node 20 Alpine
      └─ assets/*.js                           └─ tsx src/index.ts
      └─ assets/*.css                          └─ Express :3001
                                               │
                                               │ pg Pool
                                               ▼
                            ┌──────────────────────────────────────┐
                            │   PostgreSQL 16 (localhost:5432 VPS) │
                            │                                       │
                            │   Database: postgres                  │
                            │   ├─ schema auth_everline (RW)       │
                            │   ├─ schema bd_ads_clientes (RO)     │
                            │   ├─ schema uelicon_database (RO)    │
                            │   └─ schema public (schema_migrations)│
                            └──────────────────────────────────────┘
```

## Decisões arquiteturais

### Por que frontend e backend em hosts diferentes?

O frontend mora no Hostinger shared (é só estático — HTML/JS/CSS) porque é
barato e já estava contratado. O backend mora na VPS porque precisa de processo
Node + PostgreSQL + SSL managed, coisas que shared hosting não suporta bem.

**Consequência**: CORS tem que ser configurado explicitamente
(`CORS_ORIGIN=https://agenciaeverline.com.br`) e os cookies de sessão precisam
de `SameSite=Lax` + `Secure` pra atravessar subdomínios HTTPS. Isso está em
`api/src/auth.ts → cookieOptions`.

### Por que cookies httpOnly em vez de localStorage pro JWT?

- **XSS resistance**: um script injetado não lê cookies httpOnly
- **CSRF mitigation**: `SameSite=Lax` bloqueia requests cross-site exceto top-level navigation
- **Renovação transparente**: o backend pode rotar o cookie sem intervenção do frontend

O frontend usa `credentials: 'include'` em todos os fetches (ver
`src/lib/api.ts`) e o backend usa `cors({ credentials: true })`.

### Por que um user PG dedicado em vez de `postgres`?

O banco `postgres` é **compartilhado com CC360** (Checkup360), Revenda Leads e
outros schemas. Usar o superuser em runtime expõe tudo se a API for
comprometida.

O user `everline_api` (criado em 2026-04-10) é OWNER só do schema
`auth_everline` e tem `SELECT` read-only em `bd_ads_clientes` e
`uelicon_database` (os schemas que os dashboards leem). Ele **não** pode
modificar dados de outros projetos.

Grants detalhados: ver [`DATABASE.md`](./DATABASE.md#user-everline_api).

### Por que Traefik em vez de nginx direto?

A VPS já rodava Traefik v2.11.3 em Swarm Mode antes do Everline existir (CC360,
Flowise, etc). Traefik descobre serviços novos automaticamente via labels Docker
(`providers.docker.swarmMode=true`), então adicionar o Everline foi só subir
um stack novo com as labels certas. **Nunca editar o config file do Traefik**
— isso já derrubou a stack inteira antes.

Labels relevantes em `api/docker-compose.yml`:

```yaml
- "traefik.enable=true"
- "traefik.http.routers.everline-api.rule=Host(`api.agenciaeverline.com.br`)"
- "traefik.http.routers.everline-api.tls.certresolver=letsencryptresolver"
- "traefik.http.services.everline-api.loadbalancer.server.port=3001"
```

### Por que `trust proxy: 1`?

Requests chegam da internet → Traefik → container Express. O Express enxerga
todo request como vindo do IP do container Traefik se não configurado, o que
quebra rate limiting (todo mundo compartilha o mesmo IP).

`app.set('trust proxy', 1)` em `api/src/index.ts:20` diz pro Express confiar no
primeiro hop do `X-Forwarded-For`, que é o Traefik. Agora `req.ip` é o IP real
do cliente e o `express-rate-limit` funciona por IP de verdade.

**Histórico**: esse bug causou um incidente em que o rate limit de 10 logins/15min
virou 10 logins globais/15min, travando todos os usuários. Fix está no commit
`924073f Fix secret and redeploy` e contexto em `DEPLOY.md`.

## Fluxo de auth (login → dashboard)

```
1. Browser → POST /auth/login  { email, password }
              │
              ▼
   API: bcrypt.compare → sign JWT (sub, email, token_version)
              │
              ▼
2. API → Set-Cookie: everline_session=<jwt>; HttpOnly; Secure; SameSite=Lax
   API → 200 { user: { id, email, roles, ... } }
              │
              ▼
3. Browser stores cookie (httpOnly — JS can't read it)
              │
              ▼
4. Browser → GET /dashboard-data?endpoint=summary
              Cookie: everline_session=<jwt>
              │
              ▼
5. API middleware requireAuth:
   - lê cookie
   - jwt.verify (assinatura + expiry)
   - loadUser (DB lookup por sub)
   - compara token_version do payload com o do DB
     (se admin mudou senha, token_version++ invalida tokens antigos)
              │
              ▼
6. Rota executa com req.user populado
              │
              ▼
7. API → 200 { ...métricas... }
```

### Invalidação por mudança de senha

Quando um admin muda a senha de um usuário
(`PATCH /users/:id/password`), o endpoint faz:

```sql
UPDATE auth_everline.users
   SET password_hash = $1,
       token_version = token_version + 1,
       updated_at = now()
 WHERE id = $2
```

Qualquer JWT emitido antes tem `v: <old_version>` e o `requireAuth` rejeita com
`401 Sessão expirada`. Ver `api/src/auth.ts:77`.

### Roles

Quatro roles hierárquicos (definidos em `auth_everline.app_role` enum):

| Role | Quem pode ver | Quem pode escrever |
|---|---|---|
| `user` | Seus próprios dashboards (via `user_campaign_access`) | Nada |
| `gestor` | Todos os dashboards | Nada |
| `admin` | Todos os dashboards + painel admin | Users, access, clients, offers |
| `super_admin` | Idem admin | Idem admin (nível top) |

Check no backend: `requireAdmin` aceita `admin | super_admin | gestor`
(ver `api/src/auth.ts:89`). A diferenciação `admin` vs `super_admin` é
apenas semântica — não há privilégios técnicos distintos hoje.

Constraint no DB: `UNIQUE(user_id)` em `user_roles` — um user tem **no máximo
uma role**. Se não tiver nenhuma, o frontend trata como `user` implícito.

## Fluxo de dados (dashboard request)

Exemplo: usuário abre `/interno/uelicon/checkup-performance` com filtro de data
`2026-04-01 → 2026-04-10`, oferta `com_ob`.

```
Frontend (src/pages/Index.tsx + src/lib/dashboard-api.ts)
   │
   ▼
   GET /dashboard-data?endpoint=summary
     &date_from=2026-04-01&date_to=2026-04-10
     &offer=com_ob&project=checkup
   │
   ▼
Backend (api/src/routes/dashboard.ts)
   │
   ├─ requireAuth (valida cookie JWT)
   │
   ├─ getProjectConfig('checkup')       → carrega PROJECTS['checkup']
   ├─ getOfferFiltersForProject(config, 'com_ob')
   │                                    → retorna metaWhere, principalProduct, leadSources
   │
   ├─ SQL: traffic (bd_ads_clientes.meta_uelicon_venancio)
   ├─ SQL: vendas principais (uelicon_database.controle_green)
   ├─ SQL: bumps e TMB (se aplicável)
   ├─ SQL: leads (bd_ads_clientes.leads_uelicon_venancio_*)
   ├─ calcMetrics — CPL, CPA, ROAS, lead-to-sale time, etc
   │
   ▼
   { summary: { leads, vendas, gasto, receita, roas, ... } }
```

As queries SQL são construídas dinamicamente em `dashboard-helpers.ts` porque
as tabelas Meta/Green têm nomes de coluna inconsistentes (ex: `telefone`
vs `Telefone` vs `phone`) e o código detecta a coluna certa via
`information_schema.columns` antes de fazer a query principal.

## Build e deploy

Frontend:

```bash
npm run build    # Vite → dist/
# dist/ sobe via tar-over-ssh pra Hostinger
```

Vite config (`vite.config.ts`) faz code splitting manual por vendor
(`react`, `@radix-ui`, `recharts`, `date-fns`, `@tanstack/react-query`) pra
otimizar cache de chunk.

Backend:

```bash
# na VPS, dentro de /root/everline-api/:
docker build -t everline-api:latest .
docker service update --force --image everline-api:latest everline-api_api
```

Swarm rolling update = zero downtime. Novas migrations rodam automaticamente
no boot (`runMigrations()` em `index.ts:67`).

Comandos completos: ver [`../DEPLOY.md`](../DEPLOY.md).

## Observabilidade

- **Logs**: `docker service logs -f everline-api_api` (stdout JSON via morgan combined)
- **Health check**: `GET /health` retorna `{ok, db}` (pinga `SELECT 1` no PG)
- **Rate limit**: `express-rate-limit` aplica 30 failed logins / 15min / IP real
- **Erros 5xx**: handler global em `index.ts:55` — em dev expõe a stack, em prod só mensagem genérica

Não há tracing distribuído nem APM (Datadog/Sentry) — avaliar se crescer.

## Limitações conhecidas

- **Sem testes automatizados no backend**: cobertura hoje é manual (curl + UI).
  Adicionar Vitest + supertest é um débito técnico.
- **Migrations não têm rollback automatizado**: cada migration registra
  `backup table` (ex: `views_pagina_fix_log`) e reverter é `INSERT INTO ...
  SELECT row_snapshot` manual.
- **Frontend não tem error boundary granular**: só o `ErrorBoundary` raiz —
  um erro em `KPICards` derruba a página inteira.
- **Dashboards hardcoded pra Uelicon**: todo `PROJECTS` em `dashboard-config.ts`
  referencia tabelas `*_uelicon_*`. Adicionar um cliente novo requer editar o
  código (não é config-driven ainda).
