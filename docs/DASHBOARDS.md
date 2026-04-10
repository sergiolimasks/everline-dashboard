# Dashboards — Projetos e Ofertas

Os dashboards do Everline são configurados por `project` + `offer` em
`api/src/routes/dashboard-config.ts`. Cada projeto corresponde a uma frente
comercial do cliente, e cada offer é um filtro dentro daquela frente (tipo de
campanha, faixa de preço, fonte de leads, etc).

## Modelo de configuração

Cada projeto em `PROJECTS` tem a seguinte estrutura:

```typescript
interface ProjectConfig {
  metaTable: string;              // tabela Meta Ads (bd_ads_clientes.meta_*)
  linksTable: string;             // tabela de links UTM/tracking
  greenSchema: string;            // schema.tabela de vendas aprovadas (uelicon_database.controle_*)
  principalProducts: string[];    // nomes dos produtos principais (em "Produto" da controle_green)
  bumpProducts: string[];         // nomes dos order bumps
  taxaFixaPorVenda: number;       // taxa fixa (R$) descontada por venda pra calcular receita líquida
  custoManychat: number;          // custo unitário por lead via Manychat
  tmbTable?: string;              // tabela TMB quando aplicável
  defaultMetaWhere: string;       // WHERE adicional aplicado ao metaTable quando offer=all
  offerFilters: Record<string, OfferFilters>;
  leadConfigs: LeadTableConfig[]; // tabelas de leads a somar e como detectar fonte
}

interface OfferFilters {
  metaWhere: string;              // filtro SQL aplicado ao metaTable
  principalProduct: string;       // qual produto considerar como principal pra essa offer
  useEmailLinkedBumps: boolean;   // se true, associa bumps ao principal via email
  leadSources?: string[];         // filtra leadConfigs pelos sourceName listados
}
```

## Projeto: `checkup`

Dashboard principal do Uelicon — venda do **Check-up da Vida Financeira**
(produto de R$97–247 variando por faixa).

- **Meta table**: `bd_ads_clientes.meta_uelicon_venancio`
- **Green schema**: `uelicon_database.controle_green`
- **Taxa fixa por venda**: R$18
- **Custo Manychat**: R$0,35 por lead
- **Default filter**: `campanha LIKE '%CHECKUP%'`

### Offers

| Slug | Descrição | Filtro principal |
|---|---|---|
| `all` | Tudo | `campanha LIKE '%CHECKUP%'` |
| `com_ob` | Com Order Bump | `LIKE '%CHECKUP%' AND NOT LIKE '%S/OB%' AND NOT LIKE '%147%' AND NOT LIKE '%197%' AND NOT LIKE '%247%' AND NOT LIKE '%TESTE TICKETS%'` |
| `sem_ob` | Sem Order Bump | `LIKE '%S/OB%'` |
| `147` | Checkup 147 | `LIKE '%147%' OR ('%TESTE TICKETS%' AND conjunto LIKE '%147%')` |
| `197` | Checkup 197 | `LIKE '%197%' OR ('%TESTE TICKETS%' AND conjunto LIKE '%197%')` |
| `247` | Checkup 247 | `LIKE '%247%' OR ('%TESTE TICKETS%' AND conjunto LIKE '%247%')` |

### Produtos

- **Principal**: "Check-up da Vida Financeira" (+ variações por faixa)
- **Bumps**: "Avaliação individual de um especialista", "Check-up do CNPJ"
- **TMB**: não aplica

### Exclusão de gastos não-pagos

```sql
AND NOT (conta = '1202066241345194'
         AND data::date BETWEEN '2026-03-10' AND '2026-03-23'
         AND UPPER(campanha) LIKE '%CHECKUP%')
```

Em `UNPAID_EXCLUSIONS` (dashboard-config.ts:184). Esse período teve gasto que
não foi efetivamente cobrado no cartão — excluímos do `gasto` do Checkup pra
não inflar CPL/CPA. Ao adicionar novos períodos problemáticos, editar essa
constante.

## Projeto: `formacao-consultor`

Treinamento escalonado: Formação Consultor 360 (principal) + TMB (order bump
pós-venda).

- **Meta table**: mesma do checkup (`meta_uelicon_venancio`)
- **Green schema**: `uelicon_database.controle_green`
- **TMB table**: `uelicon_database.controle_tmb` ⭐
- **Taxa fixa**: 0 (sem taxa)
- **Custo Manychat**: 0

### Offers

| Slug | Descrição | Lead source |
|---|---|---|
| `all` | Tudo | — |
| `aplicacao` | Leads de Aplicação | `LIKE '%LEADS APLICACAO%'` |
| `50k` | Lançamento 50K Dez 2025 | `LIKE '%50K-DEZ25%'` |
| `presencial` | Evento Presencial | `LIKE '%PRESENCIAL%'` |
| `rmkt` | Remarketing | `LIKE '%RMKT FORMACAO%'` |

### Lead configs

Três tabelas de leads separadas, cada uma com seu sourceName:

```typescript
{
  'bd_ads_clientes.leads_uelicon_venancio_aplicacao_formac' → 'Aplicação',
  'bd_ads_clientes.leads_uelicon_venancio_acao_50k_ter'     → 'Lançamento 50K',
  'bd_ads_clientes.leads_uelicon_venancio_presencial'       → 'Presencial',
}
```

Todas contam `DISTINCT "telefone"` no período filtrado. O offer `rmkt` não
filtra leadConfigs (usa todas — remarketing atinge qualquer fonte).

## Projeto: `sistema-leads`

Dashboard do Sistema de Leads — geração pura de leads (sem vendas diretas).
Métricas focadas em CPL e volume.

- **Meta table**: `meta_uelicon_venancio`
- **Default filter**: `campanha LIKE '%SISTEMA%'`
- **Lead configs**: vazio — usa o campo `leads` direto do Meta Ads

### Offers

| Slug | Filtro |
|---|---|
| `all` | `LIKE '%SISTEMA%'` |
| `consulta-form` | `LIKE '%SISTEMA%' AND LIKE '%CONSULTA FORM%'` |
| `consulta-quiz` | `LIKE '%SISTEMA%' AND LIKE '%CONSULTA QUIZ%'` |
| `rating` | `LIKE '%SISTEMA%' AND LIKE '%RATING%'` |
| `limpa-nome` | `LIKE '%SISTEMA%' AND LIKE '%LIMPA NOME%'` |

**Nota**: o `dashboard.ts` trata `project === 'sistema-leads'` especialmente
no `traffic_daily` — usa `row.meta_leads` direto em vez de fazer lookup em
tabelas de leads (porque não há tabela dedicada aqui).

## Projeto: `distribuicao`

Posts orgânicos do Instagram distribuindo conteúdo. Métricas simples: alcance,
impressões, cliques.

- **Meta table**: `meta_uelicon_venancio`
- **Default filter**: campanhas `INSTAGRAM C1/C2/C3` ou `POST DO INSTAGRAM:`

### Offers

| Slug | Filtro |
|---|---|
| `all` | Todos os `INSTAGRAM C*` e `POST DO INSTAGRAM:` |
| `c1` | C1 + posts |
| `c2` | C2 |
| `c3` | C3 |

## Adicionar um projeto novo

Cada projeto novo exige mexer em **3 lugares**:

1. **`api/src/routes/dashboard-config.ts`** — adicionar entrada em `PROJECTS`:

    ```typescript
    'novo-projeto': {
      metaTable: 'bd_ads_clientes.meta_novo_cliente',
      linksTable: 'bd_ads_clientes.meta_novo_cliente_links',
      greenSchema: 'uelicon_database.controle_green',  // ou outro
      principalProducts: ['Produto X'],
      bumpProducts: [],
      taxaFixaPorVenda: 18,
      custoManychat: 0.35,
      defaultMetaWhere: ` AND UPPER(campanha) LIKE '%NOVO%'`,
      offerFilters: {
        oferta1: {
          metaWhere: ` AND UPPER(campanha) LIKE '%NOVO%' AND LIKE '%OFERTA1%'`,
          principalProduct: 'Produto X',
          useEmailLinkedBumps: false,
        },
      },
      leadConfigs: [],
    }
    ```

2. **`auth_everline.client_offers`** — via migration ou endpoint admin:

    ```sql
    INSERT INTO auth_everline.client_offers (client_id, offer_slug, label)
    SELECT id, 'novo-projeto', 'Nome do Dashboard'
    FROM auth_everline.clients WHERE slug = 'cliente-slug';
    ```

3. **Frontend** — adicionar rota em `src/App.tsx` e lógica no `Panel.tsx`
    pra rendezvous do novo card + página `Index.tsx` com `projectKey="novo-projeto"`.

## Adicionar um cliente novo

Atualmente (2026-04-10) **requer mudanças de código**, não é totalmente
config-driven. Processo:

1. **Criar cliente no DB**:
    ```sql
    INSERT INTO auth_everline.clients (name, slug)
    VALUES ('Novo Cliente', 'novo-cliente');
    ```

2. **Criar as ofertas em `client_offers`** apontando pros slugs dos PROJECTS
   que ele vai ter acesso.

3. **Atribuir acesso de usuários** em `user_campaign_access` (preferencialmente
   via endpoint admin `POST /user_campaign_access`).

4. **Ajustar PROJECTS em `dashboard-config.ts`** se o cliente tiver tabelas
   próprias de ads (`bd_ads_clientes.meta_novo_cliente`) ou vendas diferentes.
   Na prática, hoje todos os projetos referenciam tabelas do Uelicon.

5. **Atualizar layout do Panel.tsx** se o cliente precisar de cards específicos
   (ex: esconder dashboards que ele não usa).

**Débito técnico**: as configs deveriam vir 100% do banco (tabela
`dashboard_configs` com meta table, filters, etc em JSONB) pra não precisar
deployar código a cada cliente novo. Por enquanto é hardcoded.

## Cálculo de métricas

Todas as métricas finais são calculadas no frontend em
`src/lib/dashboard-api.ts → calcMetrics`. A API retorna os agregados crus
(gasto, impressões, vendas, receita) e o frontend deriva:

- **CPL** = `gasto / leads`
- **CPA** = `gasto / vendas_aprovadas`
- **ROAS** = `receita_liquida / gasto`
- **Taxa de conversão lead → venda** = `vendas / leads`
- **Ticket médio** = `receita_bruta / vendas`
- **Lead-to-sale average days** = média de dias entre criação do lead e compra
  (calculado no backend via `queryLeadToSaleAvgDays` em `dashboard-helpers.ts`
  porque precisa join direto no SQL, caro demais no frontend)

Métricas derivadas específicas (como receita líquida descontando taxa fixa e
co-produtor) seguem a lógica em `dashboard-helpers.ts`. Se mudar regra, mudar
lá.

## Debug de colunas

Quando uma tabela nova aparece ou uma tabela existente muda de schema (ex:
renomearam `telefone` pra `phone`), use o endpoint de debug:

```
GET /dashboard-data?endpoint=debug_columns&project=checkup
```

Retorna as colunas detectadas em `metaTable`, `greenSchema` e cada
`leadConfig.table`. Útil pra diagnosticar erros de "coluna não encontrada" em
produção.
