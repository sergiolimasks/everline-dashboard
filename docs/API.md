# API Reference

Todas as rotas do backend Express em `api/src/routes/`. Base URL em produção:
`https://api.agenciaeverline.com.br`. Base URL local: `http://localhost:3001`.

## Convenções

- **Autenticação**: cookie httpOnly `everline_session` (JWT). Alternativa:
  header `Authorization: Bearer <jwt>` para testes via curl.
- **CORS**: configurado com `credentials: true` — requests do browser
  **precisam** usar `fetch(..., { credentials: 'include' })`.
- **Erros**: todas as respostas de erro seguem `{ "error": "mensagem" }` com
  status HTTP apropriado. Em dev (`NODE_ENV !== 'production'`) erros 5xx
  incluem a mensagem original; em prod é genérico.
- **Validação**: bodies JSON são validados com Zod. Erro de validação retorna
  400 com `{ error: "campo: mensagem" }`.
- **Rate limit**: apenas em `POST /auth/login` — 30 tentativas falhadas por
  IP por 15 minutos (sucessos não contam).

## Health

### `GET /health`

Ping do banco de dados. Usado pelo Traefik e uptime monitors.

**Auth**: nenhum.

**Response 200**:
```json
{ "ok": true, "db": "up" }
```

**Response 503** (DB down):
```json
{ "ok": false, "db": "down", "error": "connection refused" }
```

## Auth

### `POST /auth/login`

**Auth**: nenhum. Rate limited (30 failures/15min/IP).

**Body**:
```json
{
  "email": "admin@example.com",
  "password": "..."
}
```

**Response 200** — seta cookie `everline_session`:
```json
{
  "user": {
    "id": "00000000-0000-0000-0000-000000000001",
    "email": "admin@example.com",
    "display_name": "Sergio Lima",
    "token_version": 0,
    "roles": ["super_admin"]
  }
}
```

**Erros**:
- `400` — email/password com formato inválido
- `401` — credenciais inválidas
- `429` — rate limit atingido

### `GET /auth/me`

Retorna o user da sessão atual. Usado pelo frontend ao montar AuthProvider.

**Auth**: `requireAuth`.

**Response 200**:
```json
{
  "user": { "id": "...", "email": "...", "roles": [...], ... }
}
```

**Erros**:
- `401` — não autenticado, token inválido, ou sessão expirada (token_version bump)

### `POST /auth/logout`

Limpa o cookie. Idempotente — seguro chamar sem estar logado.

**Auth**: nenhum.

**Response 200**:
```json
{ "ok": true }
```

## Admin — Profiles / Users

Todas essas rotas exigem `requireAuth + requireAdmin` (roles `admin`,
`super_admin` ou `gestor`).

### `GET /profiles`

Lista todos os users com timestamps de criação e último login.

**Response 200**:
```json
[
  {
    "user_id": "uuid",
    "display_name": "Sergio Lima",
    "email": "sergiolima@...",
    "created_at": "2026-04-10T14:05:00Z",
    "last_login_at": "2026-04-10T21:32:12Z"
  },
  ...
]
```

### `POST /users`

Cria um novo user (com role opcional).

**Body**:
```json
{
  "email": "novo@cliente.com",
  "password": "min6chars",
  "role": "user",               // opcional: user | gestor | admin | super_admin
  "displayName": "Nome Completo" // opcional
}
```

**Response 200**:
```json
{ "success": true, "user_id": "uuid" }
```

**Erros**:
- `400` — validation (email inválido, senha < 6 chars)
- `409` — email já existe

### `PATCH /users/:id/password`

Muda a senha de um user. **Bumpa `token_version`** — invalida todos os JWTs
existentes desse user.

**Body**:
```json
{ "newPassword": "min6chars" }
```

**Response 200**:
```json
{ "success": true }
```

**Erros**:
- `404` — user não encontrado

### `DELETE /users/:id`

Remove um user (cascade deleta `user_roles` e `user_campaign_access`).

**Response 200**:
```json
{ "success": true }
```

## Admin — Roles

### `GET /user_roles`

Lista todas as atribuições de role.

**Auth**: `requireAuth + requireAdmin`.

**Response 200**:
```json
[
  { "id": "uuid", "user_id": "uuid", "role": "super_admin" },
  ...
]
```

### `GET /user_roles/me`

Retorna a role do user atual. Endpoint usado pelo `AuthContext`
pra decidir qual UI mostrar.

**Auth**: `requireAuth` (qualquer user).

**Response 200**:
```json
[{ "id": "uuid", "user_id": "uuid", "role": "user" }]
```
(Array vazio se o user não tem role atribuída — fallback implícito pra `user`.)

### `POST /user_roles`

Atribui ou atualiza a role de um user. Como `user_roles` tem
`UNIQUE(user_id)`, um POST com user já com role faz UPDATE.

**Body**:
```json
{ "user_id": "uuid", "role": "admin" }
```

**Response 200**:
```json
{ "success": true, "id": "uuid" }
```

### `DELETE /user_roles/user/:userId`

Remove a role de um user (ele vira `user` implícito).

**Response 200**:
```json
{ "success": true, "removed": 1 }
```

## Admin — Campaign Access

### `GET /user_campaign_access`

Lista atribuições de acesso a dashboards.

**Auth**: `requireAuth`, com lógica adicional:
- `GET /user_campaign_access` (sem params) → **admin only** — retorna todas
- `GET /user_campaign_access?user_id=me` → acesso próprio (qualquer user)
- `GET /user_campaign_access?user_id=<uuid>` → **admin only** — acesso de outro user

**Response 200**:
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "client_id": "uuid",
    "offer_slug": "uelicon",
    "label": "Check-up da Vida Financeira"
  },
  ...
]
```

### `POST /user_campaign_access`

Cria uma atribuição. Valida que `(client_id, offer_slug)` existe em
`client_offers` antes de inserir — previne typos.

**Body**:
```json
{
  "user_id": "uuid",
  "client_id": "uuid",
  "offer_slug": "uelicon",
  "label": "Check-up da Vida Financeira"
}
```

**Response 200**:
```json
{ "success": true, "id": "uuid" }
```

**Erros**:
- `400` — dashboard não pertence ao cliente
- `409` — acesso já atribuído (unique violation)

### `DELETE /user_campaign_access/:id`

Remove uma atribuição.

**Response 200**:
```json
{ "success": true }
```

## Admin — Clients

### `GET /clients`

Lista clientes. **Qualquer user autenticado** pode chamar — o Panel precisa
disso pra renderizar os cards.

**Auth**: `requireAuth`.

**Response 200**:
```json
[
  { "id": "uuid", "name": "Uelicon Venâncio", "slug": "uelicon" },
  ...
]
```

### `POST /clients`

Cria um cliente.

**Auth**: `requireAdmin`.

**Body**:
```json
{ "name": "Cliente X", "slug": "cliente-x" }
```

**Response 200**:
```json
{ "success": true, "id": "uuid" }
```

### `DELETE /clients/:id`

Remove um cliente (cascade deleta `client_offers` e `user_campaign_access`).

**Response 200**:
```json
{ "success": true }
```

## Admin — Client Offers

Dashboards (ofertas) disponíveis por cliente. Um cliente pode ter N dashboards.

### `GET /client_offers`

Lista todas as ofertas. Qualquer user autenticado pode chamar.

**Auth**: `requireAuth`.

**Response 200**:
```json
[
  {
    "id": "uuid",
    "client_id": "uuid",
    "offer_slug": "uelicon",
    "label": "Check-up da Vida Financeira"
  },
  ...
]
```

### `POST /client_offers`

Cria uma oferta.

**Auth**: `requireAdmin`.

**Body**:
```json
{
  "client_id": "uuid",
  "offer_slug": "formacao-consultor",
  "label": "Formação Consultor 360"
}
```

### `DELETE /client_offers/:id`

Remove uma oferta.

## Dashboard — Métricas

### `GET /dashboard-data`

Endpoint polimórfico que serve todas as métricas dos dashboards. O comportamento
muda com base no query param `endpoint`.

**Auth**: `requireAuth` (qualquer user — mas o frontend restringe acesso via
`user_campaign_access`).

**Query params comuns**:

| Param | Tipo | Default | Descrição |
|---|---|---|---|
| `endpoint` | string | `summary` | Qual métrica retornar |
| `project` | string | `checkup` | Qual projeto (config em `dashboard-config.ts`) |
| `offer` | string | `all` | Qual oferta dentro do projeto |
| `date_from` | `YYYY-MM-DD` | — | Início do intervalo |
| `date_to` | `YYYY-MM-DD` | — | Fim do intervalo |

**Projetos válidos**: `checkup`, `formacao-consultor`, `sistema-leads`,
`distribuicao`. Ver [`DASHBOARDS.md`](./DASHBOARDS.md).

### Endpoint: `summary`

Retorna o resumo principal do dashboard: gasto, leads, vendas, receita, ROAS,
CPL, CPA, lead-to-sale time médio, etc.

**Exemplo**:
```
GET /dashboard-data?endpoint=summary&project=checkup&offer=com_ob&date_from=2026-04-01&date_to=2026-04-10
```

**Response 200**:
```json
{
  "gasto": 12345.67,
  "impressoes": 150000,
  "cliques": 3200,
  "leads": 210,
  "vendas_aprovadas": 18,
  "receita_bruta": 5400.00,
  "receita_liquida": 4800.00,
  "roas": 0.44,
  "cpl": 58.78,
  "cpa": 685.87,
  "lead_to_sale_avg_days": 3.2,
  ...
}
```

### Endpoint: `traffic_daily`

Série temporal diária de métricas de tráfego (impressões, cliques, gasto,
leads).

**Response 200**: array de dias.
```json
[
  {
    "dia": "2026-04-10",
    "impressoes": 15000,
    "alcance": 12000,
    "cliques": 320,
    "cliques_link": 180,
    "views_pagina": 150,
    "checkouts": 22,
    "compras": 3,
    "valor_compras": 900.00,
    "gasto": 1200.50,
    "views_3s": 9000,
    "leads": 21
  },
  ...
]
```

### Endpoint: `sales_daily`

Série temporal diária de vendas aprovadas (produto principal + bumps).

**Response 200**: array de dias com `vendas_aprovadas`, `receita_bruta`,
`receita_liquida`, `co_produtor`, e quando aplicável `bump_vendas`, `bump_receita`.

### Endpoint: `campaigns`

Agregado por campanha Meta Ads com métricas de funil.

**Response 200**: array de campanhas com `campanha`, `gasto`, `leads`,
`vendas`, `cpl`, `cpa`, `roas`.

### Endpoint: `ads`

Agregado por anúncio (nível mais granular que campaigns).

### Endpoint: `attribution`

Breakdown de atribuição de vendas por origem de lead
(`utm_source`/`utm_campaign` ou matching por telefone).

### Endpoint: `debug_columns`

**Dev-only** — lista as colunas das tabelas Meta/Green pra debugar detecção
automática. Não usado pelo frontend em produção.

## Cliente HTTP do frontend

Todas as chamadas passam por `src/lib/api.ts` que:

1. Envolve `fetch` com `credentials: 'include'`
2. Intercepta 401 → redireciona pro `/login` e limpa o `AuthContext`
3. Normaliza erros pra objetos JS (throw com `.status` e `.body`)

Uso típico:

```typescript
import { api } from '@/lib/api';

const profiles = await api.get<Profile[]>('/profiles');
const { id } = await api.post<{ id: string }>('/users', { email, password });
```

As chamadas de dashboard ficam em `src/lib/dashboard-api.ts`, com tipos
específicos por endpoint.

## Testes manuais rápidos

```bash
# Login (grava cookie em /tmp/cookies.txt)
curl -c /tmp/cookies.txt -X POST https://api.agenciaeverline.com.br/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"..."}'

# Endpoint autenticado usando cookie
curl -b /tmp/cookies.txt https://api.agenciaeverline.com.br/auth/me

# Summary do Checkup
curl -b /tmp/cookies.txt "https://api.agenciaeverline.com.br/dashboard-data?endpoint=summary&project=checkup&offer=com_ob&date_from=2026-04-01&date_to=2026-04-10"
```
