// Dashboard data edge function v10 — multi-project + leads + attribution
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const APPROVED_STATUSES = `('paid','Paid','approved','Aprovada','aprovada','Completa','completa')`;

const externalPgConnectionString = Deno.env.get('EXTERNAL_PG_CONNECTION_STRING') || '';

if (!externalPgConnectionString) {
  throw new Error('EXTERNAL_PG_CONNECTION_STRING is not configured');
}

// Parse connection string manually since Pool doesn't accept URI directly
function parsePgUri(uri: string) {
  const match = uri.match(/^postgres(?:ql)?:\/\/([^:]+):([^@]+)@([^:\/]+):(\d+)\/(.+)$/);
  if (!match) throw new Error('Invalid PG connection string format: ' + uri.substring(0, 30));
  return {
    user: match[1],
    password: match[2],
    hostname: match[3],
    port: parseInt(match[4]),
    database: match[5],
  };
}

let externalPgPool: Pool;
try {
  const pgParams = parsePgUri(externalPgConnectionString);
  externalPgPool = new Pool(pgParams, 1, true);
} catch (e) {
  console.error('Failed to create PG pool:', e.message);
  throw e;
}

async function queryExternalPG(sql: string, params: unknown[] = []) {
  const client = await externalPgPool.connect();
  try {
    const result = await client.queryObject(sql, params);
    return result.rows;
  } finally {
    client.release();
  }
}

// ========== PROJECT CONFIGS ==========

interface LeadTableConfig {
  table: string;
  dateColumn: string;
  countExpression: string;
  phoneColumn: string;
  sourceName: string;
}

interface ProjectConfig {
  metaTable: string;
  linksTable: string;
  greenSchema: string;
  principalProducts: string[];
  bumpProducts: string[];
  taxaFixaPorVenda: number;
  custoManychat: number;
  defaultMetaWhere: string;
  offerFilters: Record<string, OfferFilters>;
  leadConfigs: LeadTableConfig[];
  tmbTable?: string; // optional TMB sales table
}

interface OfferFilters {
  metaWhere: string;
  principalProduct: string;
  useEmailLinkedBumps: boolean;
  leadSources?: string[]; // filter leadConfigs by sourceName
}

const PROJECTS: Record<string, ProjectConfig> = {
  checkup: {
    metaTable: 'bd_ads_clientes.meta_uelicon_venancio',
    linksTable: 'bd_ads_clientes.meta_uelicon_venancio_links',
    greenSchema: 'uelicon_database.controle_green',
    principalProducts: [
      'Check-up da Vida Financeira',
      'Check-up da Vida Financeira - Sem Order Bump',
      'Check-up da Vida Financeira 147',
      'Check-up da Vida Financeira 197',
      'Check-up da Vida Financeira 247',
    ],
    bumpProducts: ['Avaliação individual de um especialista', 'Check-up do CNPJ'],
    taxaFixaPorVenda: 18,
    custoManychat: 0.35,
    defaultMetaWhere: ` AND UPPER(campanha) LIKE '%CHECKUP%'`,
    offerFilters: {
      com_ob: {
        metaWhere: ` AND UPPER(campanha) LIKE '%CHECKUP%' AND UPPER(campanha) NOT LIKE '%S/OB%' AND UPPER(campanha) NOT LIKE '%147%' AND UPPER(campanha) NOT LIKE '%197%' AND UPPER(campanha) NOT LIKE '%247%' AND UPPER(campanha) NOT LIKE '%TESTE TICKETS%'`,
        principalProduct: 'Check-up da Vida Financeira',
        useEmailLinkedBumps: true,
      },
      sem_ob: {
        metaWhere: ` AND UPPER(campanha) LIKE '%S/OB%'`,
        principalProduct: 'Check-up da Vida Financeira - Sem Order Bump',
        useEmailLinkedBumps: true,
      },
      '147': {
        metaWhere: ` AND (UPPER(campanha) LIKE '%147%' OR (UPPER(campanha) LIKE '%TESTE TICKETS%' AND UPPER(conjunto) LIKE '%147%'))`,
        principalProduct: 'Check-up da Vida Financeira 147',
        useEmailLinkedBumps: true,
      },
      '197': {
        metaWhere: ` AND (UPPER(campanha) LIKE '%197%' OR (UPPER(campanha) LIKE '%TESTE TICKETS%' AND UPPER(conjunto) LIKE '%197%'))`,
        principalProduct: 'Check-up da Vida Financeira 197',
        useEmailLinkedBumps: true,
      },
      '247': {
        metaWhere: ` AND (UPPER(campanha) LIKE '%247%' OR (UPPER(campanha) LIKE '%TESTE TICKETS%' AND UPPER(conjunto) LIKE '%247%'))`,
        principalProduct: 'Check-up da Vida Financeira 247',
        useEmailLinkedBumps: true,
      },
    },
    leadConfigs: [],
  },
  'formacao-consultor': {
    metaTable: 'bd_ads_clientes.meta_uelicon_venancio',
    linksTable: 'bd_ads_clientes.meta_uelicon_venancio_links',
    greenSchema: 'uelicon_database.controle_green',
    principalProducts: [
      'Formação Consultor 360',
      'Formação Consultor 360 (parcelado)',
    ],
    bumpProducts: [],
    taxaFixaPorVenda: 0,
    custoManychat: 0,
    tmbTable: 'uelicon_database.controle_tmb',
    defaultMetaWhere: ` AND (UPPER(campanha) LIKE '%50K-DEZ25%' OR UPPER(campanha) LIKE '%LEADS APLICACAO%' OR UPPER(campanha) LIKE '%LEADS APLICAÇÃO%' OR UPPER(campanha) LIKE '%PRESENCIAL%' OR UPPER(campanha) LIKE '%RMKT FORMACAO%' OR UPPER(campanha) LIKE '%RMKT FORMAÇÃO%')`,
    offerFilters: {
      aplicacao: {
        metaWhere: ` AND (UPPER(campanha) LIKE '%LEADS APLICACAO%' OR UPPER(campanha) LIKE '%LEADS APLICAÇÃO%')`,
        principalProduct: '',
        useEmailLinkedBumps: false,
        leadSources: ['Aplicação'],
      },
      '50k': {
        metaWhere: ` AND UPPER(campanha) LIKE '%50K-DEZ25%'`,
        principalProduct: '',
        useEmailLinkedBumps: false,
        leadSources: ['Lançamento 50K'],
      },
      presencial: {
        metaWhere: ` AND UPPER(campanha) LIKE '%PRESENCIAL%'`,
        principalProduct: '',
        useEmailLinkedBumps: false,
        leadSources: ['Presencial'],
      },
      rmkt: {
        metaWhere: ` AND (UPPER(campanha) LIKE '%RMKT FORMACAO%' OR UPPER(campanha) LIKE '%RMKT FORMAÇÃO%')`,
        principalProduct: '',
        useEmailLinkedBumps: false,
      },
    },
    leadConfigs: [
      { table: 'bd_ads_clientes.leads_uelicon_venancio_aplicacao_formac', dateColumn: '"Data"', countExpression: 'DISTINCT "telefone"', phoneColumn: '"telefone"', sourceName: 'Aplicação' },
      { table: 'bd_ads_clientes.leads_uelicon_venancio_acao_50k_ter', dateColumn: '"Data"', countExpression: 'DISTINCT "telefone"', phoneColumn: '"telefone"', sourceName: 'Lançamento 50K' },
      { table: 'bd_ads_clientes.leads_uelicon_venancio_presencial', dateColumn: '"Data"', countExpression: 'DISTINCT "telefone"', phoneColumn: '"telefone"', sourceName: 'Presencial' },
    ],
  },
  'sistema-leads': {
    metaTable: 'bd_ads_clientes.meta_uelicon_venancio',
    linksTable: 'bd_ads_clientes.meta_uelicon_venancio_links',
    greenSchema: 'uelicon_database.controle_green',
    principalProducts: [],
    bumpProducts: [],
    taxaFixaPorVenda: 0,
    custoManychat: 0,
    defaultMetaWhere: ` AND UPPER(campanha) LIKE '%SISTEMA%'`,
    offerFilters: {
      'consulta-form': {
        metaWhere: ` AND UPPER(campanha) LIKE '%SISTEMA%' AND UPPER(campanha) LIKE '%CONSULTA FORM%'`,
        principalProduct: '',
        useEmailLinkedBumps: false,
      },
      'consulta-quiz': {
        metaWhere: ` AND UPPER(campanha) LIKE '%SISTEMA%' AND UPPER(campanha) LIKE '%CONSULTA QUIZ%'`,
        principalProduct: '',
        useEmailLinkedBumps: false,
      },
      'rating': {
        metaWhere: ` AND UPPER(campanha) LIKE '%SISTEMA%' AND UPPER(campanha) LIKE '%RATING%'`,
        principalProduct: '',
        useEmailLinkedBumps: false,
      },
      'limpa-nome': {
        metaWhere: ` AND UPPER(campanha) LIKE '%SISTEMA%' AND UPPER(campanha) LIKE '%LIMPA NOME%'`,
        principalProduct: '',
        useEmailLinkedBumps: false,
      },
    },
    leadConfigs: [],
  },
  'distribuicao': {
    metaTable: 'bd_ads_clientes.meta_uelicon_venancio',
    linksTable: 'bd_ads_clientes.meta_uelicon_venancio_links',
    greenSchema: 'uelicon_database.controle_green',
    principalProducts: [],
    bumpProducts: [],
    taxaFixaPorVenda: 0,
    custoManychat: 0,
    defaultMetaWhere: ` AND (UPPER(campanha) LIKE '%INSTAGRAM C1%' OR UPPER(campanha) LIKE '%INSTAGRAM C2%' OR UPPER(campanha) LIKE '%INSTAGRAM C3%' OR UPPER(campanha) LIKE '%POST DO INSTAGRAM:%')`,
    offerFilters: {
      'c1': {
        metaWhere: ` AND (UPPER(campanha) LIKE '%INSTAGRAM C1%' OR UPPER(campanha) LIKE '%POST DO INSTAGRAM:%')`,
        principalProduct: '',
        useEmailLinkedBumps: false,
      },
      'c2': {
        metaWhere: ` AND UPPER(campanha) LIKE '%INSTAGRAM C2%'`,
        principalProduct: '',
        useEmailLinkedBumps: false,
      },
      'c3': {
        metaWhere: ` AND UPPER(campanha) LIKE '%INSTAGRAM C3%'`,
        principalProduct: '',
        useEmailLinkedBumps: false,
      },
    },
    leadConfigs: [],
  },
};

// Unpaid account exclusions — these accounts had spend that was NOT actually paid
// so we exclude their raw gasto from CHECKUP meta queries only
const UNPAID_EXCLUSIONS = ` AND NOT (conta = '1202066241345194' AND data::date >= '2026-03-10' AND data::date <= '2026-03-23' AND UPPER(campanha) LIKE '%CHECKUP%')`;

function getProjectConfig(project: string): ProjectConfig {
  return PROJECTS[project] || PROJECTS['checkup'];
}

function getOfferFiltersForProject(config: ProjectConfig, offer: string): OfferFilters & { isAllNoFilter?: boolean } {
  if (offer === 'all_no_filter') {
    return {
      metaWhere: config.defaultMetaWhere,
      principalProduct: '',
      useEmailLinkedBumps: false,
      isAllNoFilter: true,
    };
  }
  // Support multi-select offers (comma-separated) with OR logic
  if (offer && offer !== 'all' && offer.includes(',')) {
    const keys = offer.split(',').filter(k => config.offerFilters[k]);
    if (keys.length > 0) {
      const orClauses = keys.map(k => `(1=1 ${config.offerFilters[k].metaWhere})`);
      return {
        metaWhere: ` AND (${orClauses.join(' OR ')})`,
        principalProduct: '',
        useEmailLinkedBumps: false,
      };
    }
  }
  if (offer && offer !== 'all' && config.offerFilters[offer]) {
    return config.offerFilters[offer];
  }
  return {
    metaWhere: config.defaultMetaWhere,
    principalProduct: '',
    useEmailLinkedBumps: false,
  };
}

// All principal products across ALL projects (for panel view)
const ALL_PRINCIPAL_PRODUCTS = [
  ...PROJECTS['checkup'].principalProducts,
  ...PROJECTS['formacao-consultor'].principalProducts,
];

const ALL_BUMP_PRODUCTS = [
  'Avaliação individual de um especialista',
  'Check-up do CNPJ',
];

function principalFilter(config: ProjectConfig, productName: string): string {
  if (!productName) {
    if (config.principalProducts.length > 0) {
      const names = config.principalProducts.map(p => `'${p}'`).join(',');
      return `"Nome do produto" IN (${names})`;
    }
    return `1=0`;
  }
  return `"Nome do produto" = '${productName}'`;
}

function bumpFilter(config: ProjectConfig, productName: string): string {
  if (config.bumpProducts.length === 0) return `1=0`;
  const bumpList = config.bumpProducts.map(p => `'${p}'`).join(',');
  if (!productName) {
    return `("Nome do produto" IN (${bumpList}))`;
  }
  return `("Nome do produto" IN (${bumpList}) AND "Email do cliente" IN (SELECT DISTINCT "Email do cliente" FROM ${config.greenSchema} WHERE "Nome do produto" = '${productName}' AND "Status da venda" IN ${APPROVED_STATUSES}))`;
}

function allProductsFilter(config: ProjectConfig, productName: string): string {
  if (!productName) {
    const allNames = [...config.principalProducts, ...config.bumpProducts].map(p => `'${p}'`).join(',');
    return `"Nome do produto" IN (${allNames})`;
  }
  return `("Nome do produto" = '${productName}' OR ${bumpFilter(config, productName)})`;
}

// Build a phone-based WHERE clause to filter sales by lead source phones
function buildPhoneFilter(filteredConfig: ProjectConfig, salesPhoneCol: string): string {
  if (filteredConfig.leadConfigs.length === 0) return '';
  const unions = filteredConfig.leadConfigs.map(lc =>
    `SELECT DISTINCT REGEXP_REPLACE(TRIM(${lc.phoneColumn}), '[^0-9]', '', 'g') as tel FROM ${lc.table} WHERE ${lc.phoneColumn} IS NOT NULL AND TRIM(${lc.phoneColumn}) != ''`
  ).join(' UNION ');
  return ` AND REGEXP_REPLACE(TRIM(${salesPhoneCol}), '[^0-9]', '', 'g') IN (${unions})`;
}

// Calculate average sales cycle in days (lead capture → sale date) by matching phone numbers
async function queryCicloMedioVenda(config: ProjectConfig, params: string[], salesPhoneFilter: string, salesPhoneCol: string | null): Promise<number | null> {
  if (config.leadConfigs.length === 0 || !salesPhoneCol) return null;

  const pFilter = principalFilter(config, '');
  const salesDateFilter = params.length >= 2 ? ` AND "Data"::date >= $1 AND "Data"::date <= $2` : '';

  const leadUnions = config.leadConfigs.map(lc =>
    `SELECT REGEXP_REPLACE(TRIM(${lc.phoneColumn}), '[^0-9]', '', 'g') as telefone, MIN(${lc.dateColumn}::date) as data_lead FROM ${lc.table} WHERE ${lc.phoneColumn} IS NOT NULL AND TRIM(${lc.phoneColumn}) != '' GROUP BY REGEXP_REPLACE(TRIM(${lc.phoneColumn}), '[^0-9]', '', 'g')`
  ).join(' UNION ALL ');

  const sql = `
    WITH leads_agg AS (
      SELECT telefone, MIN(data_lead) as primeira_captacao FROM (${leadUnions}) sub GROUP BY telefone
    ),
    vendas AS (
      SELECT REGEXP_REPLACE(TRIM(${salesPhoneCol}), '[^0-9]', '', 'g') as telefone, MIN("Data"::date) as data_venda
      FROM ${config.greenSchema}
      WHERE ${pFilter} AND "Status da venda" IN ${APPROVED_STATUSES} ${salesDateFilter}
        AND ${salesPhoneCol} IS NOT NULL AND TRIM(${salesPhoneCol}) != '' ${salesPhoneFilter}
      GROUP BY REGEXP_REPLACE(TRIM(${salesPhoneCol}), '[^0-9]', '', 'g')
    )
    SELECT AVG(v.data_venda - l.primeira_captacao) as ciclo_medio
    FROM vendas v
    INNER JOIN leads_agg l ON v.telefone = l.telefone
    WHERE v.data_venda >= l.primeira_captacao
  `;

  const rows = await queryExternalPG(sql, params);
  const ciclo = Number((rows[0] as any)?.ciclo_medio);
  return isNaN(ciclo) ? null : Math.round(ciclo * 10) / 10;
}

async function queryLeadsTotal(config: ProjectConfig, params: string[]): Promise<number> {
  if (config.leadConfigs.length === 0) return 0;
  let total = 0;
  for (const lc of config.leadConfigs) {
    const dateFilter = params.length >= 2
      ? ` WHERE ${lc.dateColumn}::date >= $1 AND ${lc.dateColumn}::date <= $2`
      : '';
    const rows = await queryExternalPG(
      `SELECT COUNT(${lc.countExpression}) as total FROM ${lc.table}${dateFilter}`,
      params
    );
    total += Number((rows[0] as any)?.total || 0);
  }
  return total;
}

async function queryLeadsDaily(config: ProjectConfig, params: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (config.leadConfigs.length === 0) return map;
  for (const lc of config.leadConfigs) {
    const dateFilter = params.length >= 2
      ? ` WHERE ${lc.dateColumn}::date >= $1 AND ${lc.dateColumn}::date <= $2`
      : '';
    const rows = await queryExternalPG(
      `SELECT ${lc.dateColumn}::date as dia, COUNT(${lc.countExpression}) as total FROM ${lc.table}${dateFilter} GROUP BY ${lc.dateColumn}::date`,
      params
    );
    for (const r of rows as any[]) {
      const key = String(r.dia).slice(0, 10);
      map.set(key, (map.get(key) || 0) + Number(r.total || 0));
    }
  }
  return map;
}

// ========== PHONE + EMAIL SALES ATTRIBUTION ==========

// Detect columns via information_schema in a single query per schema
async function getTableColumns(schemaAndTable: string): Promise<Set<string>> {
  // schemaAndTable like "uelicon_database.controle_green" or "bd_ads_clientes.leads_..."
  const parts = schemaAndTable.split('.');
  const schema = parts[0];
  const table = parts[1];
  const rows = await queryExternalPG(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2`,
    [schema, table]
  );
  const cols = new Set<string>();
  for (const r of rows as any[]) {
    cols.add(String(r.column_name));
  }
  return cols;
}

function findColumn(columns: Set<string>, candidates: string[]): string | null {
  for (const c of candidates) {
    if (columns.has(c)) return `"${c}"`;
  }
  return null;
}

const PHONE_CANDIDATES = ['telefone', 'Telefone', 'Telefone do cliente', 'telefone_cliente', 'celular', 'Celular'];
const EMAIL_CANDIDATES = ['Email do cliente', 'email', 'Email', 'e-mail', 'E-mail'];

async function queryAttribution(config: ProjectConfig, params: string[]): Promise<any[]> {
  if (config.leadConfigs.length === 0) return [];

  // Detect all columns in parallel (one query per table)
  const allTables = [config.greenSchema, ...config.leadConfigs.map(lc => lc.table)];
  const uniqueTables = [...new Set(allTables)];
  const columnSets = await Promise.all(uniqueTables.map(t => getTableColumns(t)));
  const tableColumns: Map<string, Set<string>> = new Map();
  uniqueTables.forEach((t, i) => tableColumns.set(t, columnSets[i]));

  const salesCols = tableColumns.get(config.greenSchema)!;
  const salesPhoneColumn = findColumn(salesCols, PHONE_CANDIDATES);
  if (!salesPhoneColumn) {
    throw new Error('Nenhuma coluna de telefone encontrada na base de vendas');
  }
  const salesEmailColumn = findColumn(salesCols, EMAIL_CANDIDATES);

  const leadEmailColumns: Map<string, string | null> = new Map();
  for (const lc of config.leadConfigs) {
    const cols = tableColumns.get(lc.table)!;
    leadEmailColumns.set(lc.sourceName, findColumn(cols, EMAIL_CANDIDATES));
  }

  const salesDateFilter = params.length >= 2
    ? ` AND "Data"::date >= $1 AND "Data"::date <= $2`
    : '';
  const pFilter = principalFilter(config, '');

  // Build sales query with both phone and email
  const emailSelectCol = salesEmailColumn ? `, LOWER(TRIM(${salesEmailColumn})) as email` : '';
  const emailGroupBy = salesEmailColumn ? `, LOWER(TRIM(${salesEmailColumn}))` : '';
  const salesRows = await queryExternalPG(`
    SELECT REGEXP_REPLACE(TRIM(${salesPhoneColumn}), '[^0-9]', '', 'g') as telefone${emailSelectCol},
           COUNT(*) as vendas,
           SUM(COALESCE(NULLIF(REPLACE("Valor Bruto", ',', '.'), '')::numeric, 0)) as receita_bruta,
           SUM(COALESCE(NULLIF(REPLACE("Valor Líquido", ',', '.'), '')::numeric, 0)) as receita_liquida
    FROM ${config.greenSchema}
    WHERE ${pFilter} AND "Status da venda" IN ${APPROVED_STATUSES} ${salesDateFilter}
      AND ${salesPhoneColumn} IS NOT NULL AND TRIM(${salesPhoneColumn}) != ''
    GROUP BY REGEXP_REPLACE(TRIM(${salesPhoneColumn}), '[^0-9]', '', 'g')${emailGroupBy}
  `, params);

  interface SaleEntry { vendas: number; receita_bruta: number; receita_liquida: number; email?: string; phone: string }
  const salesEntries: SaleEntry[] = [];
  for (const r of salesRows as any[]) {
    if (r.telefone) {
      salesEntries.push({
        phone: String(r.telefone),
        email: r.email ? String(r.email) : undefined,
        vendas: Number(r.vendas || 0),
        receita_bruta: Number(r.receita_bruta || 0),
        receita_liquida: Number(r.receita_liquida || 0),
      });
    }
  }

  // Build phone sets per source
  const sourcePhones: Map<string, Set<string>> = new Map();
  for (const lc of config.leadConfigs) {
    const rows = await queryExternalPG(
      `SELECT DISTINCT REGEXP_REPLACE(TRIM(${lc.phoneColumn}), '[^0-9]', '', 'g') as telefone FROM ${lc.table} WHERE ${lc.phoneColumn} IS NOT NULL AND TRIM(${lc.phoneColumn}) != ''`,
      []
    );
    const phones = new Set<string>();
    for (const r of rows as any[]) {
      if (r.telefone) phones.add(String(r.telefone));
    }
    sourcePhones.set(lc.sourceName, phones);
  }

  // Build email sets per source (fallback) — columns already detected
  const sourceEmails: Map<string, Set<string>> = new Map();
  if (salesEmailColumn) {
    const emailPromises = config.leadConfigs
      .filter(lc => leadEmailColumns.get(lc.sourceName))
      .map(async (lc) => {
        const leadEmailCol = leadEmailColumns.get(lc.sourceName)!;
        const rows = await queryExternalPG(
          `SELECT DISTINCT LOWER(TRIM(${leadEmailCol})) as email FROM ${lc.table} WHERE ${leadEmailCol} IS NOT NULL AND TRIM(${leadEmailCol}) != ''`,
          []
        );
        const emails = new Set<string>();
        for (const r of rows as any[]) {
          if (r.email) emails.add(String(r.email));
        }
        return { sourceName: lc.sourceName, emails };
      });
    const emailResults = await Promise.all(emailPromises);
    for (const { sourceName, emails } of emailResults) {
      sourceEmails.set(sourceName, emails);
    }
  }

  // Count leads per source
  const leadCounts: Map<string, number> = new Map();
  for (const lc of config.leadConfigs) {
    const df = params.length >= 2
      ? ` WHERE ${lc.dateColumn}::date >= $1 AND ${lc.dateColumn}::date <= $2`
      : '';
    const rows = await queryExternalPG(
      `SELECT COUNT(${lc.countExpression}) as total FROM ${lc.table}${df}`,
      params
    );
    leadCounts.set(lc.sourceName, Number((rows[0] as any)?.total || 0));
  }

  // Query spend per source using offer filters
  const sourceSpend: Map<string, number> = new Map();
  const sourceLeadMap: Record<string, string> = {};
  for (const lc of config.leadConfigs) {
    sourceLeadMap[lc.sourceName] = lc.sourceName;
  }
  for (const [offerKey, filters] of Object.entries(config.offerFilters)) {
    if (filters.leadSources && filters.leadSources.length === 1) {
      const sourceName = filters.leadSources[0];
      const dateFilter = params.length >= 2 ? ` AND data::date >= $1 AND data::date <= $2` : '';
      const rows = await queryExternalPG(
        `SELECT COALESCE(SUM(gasto), 0) as total_gasto FROM ${config.metaTable} WHERE 1=1 ${dateFilter} ${filters.metaWhere} ${UNPAID_EXCLUSIONS}`,
        params
      );
      const gasto = Number((rows[0] as any)?.total_gasto || 0) * 1.125; // +12.5% tax
      sourceSpend.set(sourceName, gasto);
    }
  }

  const attribution: Map<string, { vendas: number; receita_bruta: number; receita_liquida: number; leads: number; gasto: number }> = new Map();
  for (const lc of config.leadConfigs) {
    attribution.set(lc.sourceName, { vendas: 0, receita_bruta: 0, receita_liquida: 0, leads: leadCounts.get(lc.sourceName) || 0, gasto: sourceSpend.get(lc.sourceName) || 0 });
  }
  attribution.set('Não identificado', { vendas: 0, receita_bruta: 0, receita_liquida: 0, leads: 0, gasto: 0 });

  // Helper to attribute a sale entry
  function attributeSale(sale: SaleEntry) {
    // 1st pass: match by phone
    let matchedSources: string[] = [];
    for (const [sourceName, phones] of sourcePhones) {
      if (phones.has(sale.phone)) {
        matchedSources.push(sourceName);
      }
    }

    // 2nd pass: if no phone match, try email fallback
    if (matchedSources.length === 0 && sale.email && sourceEmails.size > 0) {
      for (const [sourceName, emails] of sourceEmails) {
        if (emails.has(sale.email)) {
          matchedSources.push(sourceName);
        }
      }
    }

    if (matchedSources.length === 0) {
      const entry = attribution.get('Não identificado')!;
      entry.vendas += sale.vendas;
      entry.receita_bruta += sale.receita_bruta;
      entry.receita_liquida += sale.receita_liquida;
    } else {
      const weight = 1 / matchedSources.length;
      for (const src of matchedSources) {
        const entry = attribution.get(src)!;
        entry.vendas += sale.vendas * weight;
        entry.receita_bruta += sale.receita_bruta * weight;
        entry.receita_liquida += sale.receita_liquida * weight;
      }
    }
  }

  // Attribute Greenn sales
  for (const sale of salesEntries) {
    attributeSale(sale);
  }

  // Attribute TMB sales (parcela = 0 only) if tmbTable is configured
  if (config.tmbTable) {
    const tmbDateFilter = params.length >= 2 ? ` AND data_pagamento::date >= $1 AND data_pagamento::date <= $2` : '';
    const tmbRows = await queryExternalPG(`
      SELECT LOWER(TRIM(cliente_email)) as email,
             COUNT(*) as vendas,
             COALESCE(SUM(valor_total), 0) as receita_bruta,
             COALESCE(SUM(repasse), 0) as receita_liquida
      FROM ${config.tmbTable}
      WHERE parcela = 0 AND status_pagamento IN ${TMB_PAID_STATUSES} ${tmbDateFilter}
        AND cliente_email IS NOT NULL AND TRIM(cliente_email) != ''
      GROUP BY LOWER(TRIM(cliente_email))
    `, params);

    for (const r of tmbRows as any[]) {
      const email = r.email ? String(r.email) : undefined;
      if (!email) continue;
      // TMB sales match by email only (no phone column)
      let matchedSources: string[] = [];
      for (const [sourceName, emails] of sourceEmails) {
        if (emails.has(email)) {
          matchedSources.push(sourceName);
        }
      }
      const vendas = Number(r.vendas || 0);
      const receita_bruta = Number(r.receita_bruta || 0);
      const receita_liquida = Number(r.receita_liquida || 0);

      if (matchedSources.length === 0) {
        const entry = attribution.get('Não identificado')!;
        entry.vendas += vendas;
        entry.receita_bruta += receita_bruta;
        entry.receita_liquida += receita_liquida;
      } else {
        const weight = 1 / matchedSources.length;
        for (const src of matchedSources) {
          const entry = attribution.get(src)!;
          entry.vendas += vendas * weight;
          entry.receita_bruta += receita_bruta * weight;
          entry.receita_liquida += receita_liquida * weight;
        }
      }
    }
  }

  const result: any[] = [];
  for (const [source, data] of attribution) {
    if (data.vendas > 0 || data.leads > 0) {
      const lucro = data.receita_liquida - data.gasto;
      result.push({
        source,
        gasto: Math.round(data.gasto * 100) / 100,
        leads: data.leads,
        cpl: data.leads > 0 ? Math.round((data.gasto / data.leads) * 100) / 100 : 0,
        vendas: Math.round(data.vendas * 100) / 100,
        cpa: data.vendas > 0 ? Math.round((data.gasto / data.vendas) * 100) / 100 : 0,
        roi: data.gasto > 0 ? Math.round((data.receita_liquida / data.gasto) * 100) / 100 : 0,
        lucro: Math.round(lucro * 100) / 100,
        receita_bruta: Math.round(data.receita_bruta * 100) / 100,
        receita_liquida: Math.round(data.receita_liquida * 100) / 100,
        taxa_conversao: data.leads > 0 ? data.vendas / data.leads : 0,
      });
    }
  }

  return result;
}

const TMB_PAID_STATUSES = `('Efetivado','Recebido')`;

// Query TMB new sales (parcela = 0) summary
async function queryTmbSalesSummary(tmbTable: string, params: string[], emailFilter: string): Promise<{ vendas: number; repasse: number; repasse_coprodutor: number; taxa_tmb: number; valor_total: number }> {
  const dateFilter = params.length >= 2 ? ` AND data_pagamento::date >= $1 AND data_pagamento::date <= $2` : '';
  const rows = await queryExternalPG(`
    SELECT 
      COUNT(*) as vendas,
      COALESCE(SUM(repasse), 0) as repasse,
      COALESCE(SUM(repasse_coprodutor), 0) as repasse_coprodutor,
      COALESCE(SUM(taxa_tmb), 0) as taxa_tmb,
      COALESCE(SUM(valor_total), 0) as valor_total
    FROM ${tmbTable}
    WHERE parcela = 0 AND status_pagamento IN ${TMB_PAID_STATUSES} ${dateFilter} ${emailFilter}
  `, params);
  const r = rows[0] as any;
  return { vendas: Number(r?.vendas || 0), repasse: Number(r?.repasse || 0), repasse_coprodutor: Number(r?.repasse_coprodutor || 0), taxa_tmb: Number(r?.taxa_tmb || 0), valor_total: Number(r?.valor_total || 0) };
}

// Query TMB new sales (parcela = 0) daily
async function queryTmbSalesDaily(tmbTable: string, params: string[], emailFilter: string): Promise<Map<string, { vendas: number; repasse: number; repasse_coprodutor: number; taxa_tmb: number; valor_total: number }>> {
  const dateFilter = params.length >= 2 ? ` AND data_pagamento::date >= $1 AND data_pagamento::date <= $2` : '';
  const rows = await queryExternalPG(`
    SELECT 
      TO_CHAR(data_pagamento::date, 'YYYY-MM-DD') as dia,
      COUNT(*) as vendas,
      COALESCE(SUM(repasse), 0) as repasse,
      COALESCE(SUM(repasse_coprodutor), 0) as repasse_coprodutor,
      COALESCE(SUM(taxa_tmb), 0) as taxa_tmb,
      COALESCE(SUM(valor_total), 0) as valor_total
    FROM ${tmbTable}
    WHERE parcela = 0 AND status_pagamento IN ${TMB_PAID_STATUSES} ${dateFilter} ${emailFilter}
    GROUP BY data_pagamento::date
  `, params);
  const map = new Map();
  for (const r of rows as any[]) {
    const key = String(r.dia).slice(0, 10);
    map.set(key, { vendas: Number(r.vendas || 0), repasse: Number(r.repasse || 0), repasse_coprodutor: Number(r.repasse_coprodutor || 0), taxa_tmb: Number(r.taxa_tmb || 0), valor_total: Number(r.valor_total || 0) });
  }
  return map;
}

// Query TMB parcelas (parcela > 0) summary with per-installment breakdown
async function queryTmbParcelas(tmbTable: string, params: string[]): Promise<{ total_parcelas: number; valor_total: number; repasse: number; repasse_coprodutor: number; taxa_tmb: number; por_parcela: Array<{ parcela: number; quantidade: number; valor_total: number; repasse: number; repasse_coprodutor: number; taxa_tmb: number }> }> {
  const dateFilter = params.length >= 2 ? ` AND data_pagamento::date >= $1 AND data_pagamento::date <= $2` : '';
  const rows = await queryExternalPG(`
    SELECT 
      parcela,
      COUNT(*) as quantidade,
      COALESCE(SUM(valor_total), 0) as valor_total,
      COALESCE(SUM(repasse), 0) as repasse,
      COALESCE(SUM(repasse_coprodutor), 0) as repasse_coprodutor,
      COALESCE(SUM(taxa_tmb), 0) as taxa_tmb
    FROM ${tmbTable}
    WHERE parcela > 0 AND status_pagamento IN ${TMB_PAID_STATUSES} ${dateFilter}
    GROUP BY parcela
    ORDER BY parcela
  `, params);
  let total_parcelas = 0, valor_total = 0, repasse = 0, repasse_coprodutor = 0, taxa_tmb = 0;
  const por_parcela: Array<{ parcela: number; quantidade: number; valor_total: number; repasse: number; repasse_coprodutor: number; taxa_tmb: number }> = [];
  for (const r of rows as any[]) {
    const qty = Number(r.quantidade || 0);
    const vt = Number(r.valor_total || 0);
    const rp = Number(r.repasse || 0);
    const rc = Number(r.repasse_coprodutor || 0);
    const tt = Number(r.taxa_tmb || 0);
    total_parcelas += qty;
    valor_total += vt;
    repasse += rp;
    repasse_coprodutor += rc;
    taxa_tmb += tt;
    por_parcela.push({ parcela: Number(r.parcela), quantidade: qty, valor_total: vt, repasse: rp, repasse_coprodutor: rc, taxa_tmb: tt });
  }
  return { total_parcelas, valor_total, repasse, repasse_coprodutor, taxa_tmb, por_parcela };
}

// Build TMB email filter based on lead sources
async function buildTmbEmailFilter(filteredConfig: ProjectConfig): Promise<string> {
  if (filteredConfig.leadConfigs.length === 0) return '';
  const parts: string[] = [];
  for (const lc of filteredConfig.leadConfigs) {
    const cols = await getTableColumns(lc.table);
    const emailCol = findColumn(cols, EMAIL_CANDIDATES);
    if (emailCol) {
      parts.push(`SELECT DISTINCT LOWER(TRIM(${emailCol})) as email FROM ${lc.table} WHERE ${emailCol} IS NOT NULL AND TRIM(${emailCol}) != ''`);
    }
  }
  if (parts.length === 0) return '';
  return ` AND LOWER(TRIM(cliente_email)) IN (${parts.join(' UNION ')})`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { searchParams } = new URL(req.url);
    const endpoint = searchParams.get('endpoint') || 'summary';
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const offer = searchParams.get('offer') || 'all';
    const project = searchParams.get('project') || 'checkup';

    const config = getProjectConfig(project);
    const filters = getOfferFiltersForProject(config, offer);
    const metaFilter = filters.metaWhere;

    // Filter leadConfigs by selected offer's leadSources
    const filteredConfig = filters.leadSources
      ? { ...config, leadConfigs: config.leadConfigs.filter(lc => filters.leadSources!.includes(lc.sourceName)) }
      : config;

    // Build phone-based sales filter when a specific campaign is selected
    let salesPhoneFilter = '';
    let detectedSalesPhoneCol: string | null = null;
    if (filters.leadSources && filteredConfig.leadConfigs.length > 0) {
      // Detect phone column in sales table
      const salesCols = await getTableColumns(config.greenSchema);
      detectedSalesPhoneCol = findColumn(salesCols, PHONE_CANDIDATES);
      if (detectedSalesPhoneCol) {
        salesPhoneFilter = buildPhoneFilter(filteredConfig, detectedSalesPhoneCol);
      }
    } else if (config.leadConfigs.length > 0) {
      // Still detect phone col for ciclo medio even when no specific filter
      const salesCols = await getTableColumns(config.greenSchema);
      detectedSalesPhoneCol = findColumn(salesCols, PHONE_CANDIDATES);
    }

    let dateFilter = '';
    const params: string[] = [];

    if (dateFrom && dateTo) {
      dateFilter = ` AND data::date >= $1 AND data::date <= $2`;
      params.push(dateFrom, dateTo);
    }

    let data: unknown[] = [];

    if (endpoint === 'traffic_daily') {
      const trafficRows = await queryExternalPG(`
        SELECT 
          TO_CHAR(data::date, 'YYYY-MM-DD') as dia,
          SUM(impressoes) as impressoes,
          SUM(alcance) as alcance,
          SUM(cliques) as cliques,
          SUM(cliques_link) as cliques_link,
          SUM(views_pagina) as views_pagina,
          SUM(checkouts) as checkouts,
          SUM(compras) as compras,
          SUM(valor_compras) as valor_compras,
          SUM(gasto) as gasto,
          SUM(views_3s) as views_3s,
          COALESCE(SUM(leads), 0) as meta_leads
        FROM ${config.metaTable}
        WHERE 1=1 ${dateFilter} ${metaFilter} ${UNPAID_EXCLUSIONS}
        GROUP BY data::date
        ORDER BY data::date DESC
      `, params);

      const leadsMap = await queryLeadsDaily(filteredConfig, params);
      data = (trafficRows as any[]).map(row => ({
        ...row,
        leads: project === 'sistema-leads'
          ? Number(row.meta_leads || 0)
          : (leadsMap.get(String(row.dia).slice(0, 10)) || 0),
      }));

    } else if (endpoint === 'sales_daily') {
      const salesDateFilter = dateFrom && dateTo
        ? ` AND "Data"::date >= $1 AND "Data"::date <= $2`
        : '';

      const pFilter = principalFilter(config, filters.principalProduct);

      const principalRows = await queryExternalPG(`
        SELECT 
          TO_CHAR("Data"::date, 'YYYY-MM-DD') as dia,
          COUNT(*) FILTER (WHERE "Status da venda" IN ${APPROVED_STATUSES}) as vendas_aprovadas,
          SUM(CASE WHEN "Status da venda" IN ${APPROVED_STATUSES} THEN COALESCE(NULLIF(REPLACE("Valor Bruto", ',', '.'), '')::numeric, 0) ELSE 0 END) as receita_bruta,
          SUM(CASE WHEN "Status da venda" IN ${APPROVED_STATUSES} THEN COALESCE(NULLIF(REPLACE("Valor Líquido", ',', '.'), '')::numeric, 0) ELSE 0 END) as receita_liquida,
          SUM(CASE WHEN "Status da venda" IN ${APPROVED_STATUSES} THEN COALESCE(NULLIF(REPLACE("Co-Produtor", ',', '.'), '')::numeric, 0) ELSE 0 END) as co_produtor
        FROM ${config.greenSchema}
        WHERE ${pFilter} ${salesDateFilter} ${salesPhoneFilter}
        GROUP BY "Data"::date
        ORDER BY "Data"::date DESC
      `, params);

      let bumpRows: any[] = [];
      if (config.bumpProducts.length > 0) {
        const bFilter = bumpFilter(config, filters.principalProduct);
        bumpRows = await queryExternalPG(`
          SELECT 
            TO_CHAR("Data"::date, 'YYYY-MM-DD') as dia,
            SUM(CASE WHEN "Status da venda" IN ${APPROVED_STATUSES} THEN COALESCE(NULLIF(REPLACE("Valor Bruto", ',', '.'), '')::numeric, 0) ELSE 0 END) as receita_bruta_bump,
            SUM(CASE WHEN "Status da venda" IN ${APPROVED_STATUSES} THEN COALESCE(NULLIF(REPLACE("Valor Líquido", ',', '.'), '')::numeric, 0) ELSE 0 END) as receita_liquida_bump,
            SUM(CASE WHEN "Status da venda" IN ${APPROVED_STATUSES} THEN COALESCE(NULLIF(REPLACE("Co-Produtor", ',', '.'), '')::numeric, 0) ELSE 0 END) as co_produtor_bump,
            COUNT(*) FILTER (WHERE "Status da venda" IN ${APPROVED_STATUSES} AND "Nome do produto" = 'Check-up do CNPJ') as vendas_cnpj
          FROM ${config.greenSchema}
          WHERE ${bFilter} ${salesDateFilter} ${salesPhoneFilter}
          GROUP BY "Data"::date
        `, params) as any[];
      }

      const bumpMap = new Map();
      for (const b of bumpRows) {
        bumpMap.set(String(b.dia), b);
      }

      // Merge Greenn daily data
      const allDays = new Set<string>();
      for (const p of principalRows as any[]) allDays.add(String(p.dia).slice(0, 10));

      const greenMap = new Map();
      for (const p of principalRows as any[]) {
        const key = String(p.dia).slice(0, 10);
        greenMap.set(key, p);
      }

      // TMB daily data (parcela=0 only)
      let tmbDailyMap = new Map();
      if (config.tmbTable) {
        const tmbEmailFilter = filters.leadSources ? await buildTmbEmailFilter(filteredConfig) : '';
        tmbDailyMap = await queryTmbSalesDaily(config.tmbTable, params, tmbEmailFilter);
        for (const k of tmbDailyMap.keys()) allDays.add(k);
      }

      const sortedDays = [...allDays].sort((a, b) => b.localeCompare(a));
      data = sortedDays.map(day => {
        const g = greenMap.get(day);
        const bump = bumpMap.get(day) || { receita_bruta_bump: 0, receita_liquida_bump: 0, co_produtor_bump: 0, vendas_cnpj: 0 };
        const tmb = tmbDailyMap.get(day) || { vendas: 0, repasse: 0, repasse_coprodutor: 0, taxa_tmb: 0, valor_total: 0 };
        const greenVendas = Number(g?.vendas_aprovadas || 0);
        const vendasCnpj = Number(bump.vendas_cnpj || 0);
        const taxaFixa = config.taxaFixaPorVenda > 0 ? (greenVendas + vendasCnpj) * config.taxaFixaPorVenda : 0;
        return {
          dia: day,
          vendas_aprovadas: greenVendas + tmb.vendas,
          vendas_cnpj: vendasCnpj,
          receita_bruta: Number(g?.receita_bruta || 0) + Number(bump.receita_bruta_bump || 0) + tmb.valor_total,
          receita_liquida: Number(g?.receita_liquida || 0) + Number(bump.receita_liquida_bump || 0) + tmb.repasse,
          taxa_fixa: taxaFixa,
          co_produtor: Number(g?.co_produtor || 0) + Number(bump.co_produtor_bump || 0) + tmb.repasse_coprodutor,
          taxa_tmb: tmb.taxa_tmb,
        };
      });

    } else if (endpoint === 'summary') {
      const traffic = await queryExternalPG(`
        SELECT 
          SUM(impressoes) as total_impressoes,
          SUM(cliques) as total_cliques,
          SUM(cliques_link) as total_cliques_link,
          SUM(views_pagina) as total_views,
          SUM(checkouts) as total_checkouts,
          SUM(compras) as total_compras_meta,
          SUM(valor_compras) as total_valor_compras,
          SUM(gasto) as total_gasto,
          SUM(views_3s) as total_views_3s,
          COUNT(DISTINCT data::date) as dias_ativos
        FROM ${config.metaTable}
        WHERE 1=1 ${dateFilter} ${metaFilter} ${UNPAID_EXCLUSIONS}
      `, params);

      const salesDateFilter = dateFrom && dateTo
        ? ` AND "Data"::date >= $1 AND "Data"::date <= $2`
        : '';

      const isPanel = (filters as any).isAllNoFilter;
      const pFilter = isPanel
        ? principalFilter(config, '')
        : principalFilter(config, filters.principalProduct);
      const apFilter = isPanel
        ? allProductsFilter(config, '')
        : allProductsFilter(config, filters.principalProduct);

      const principalSales = await queryExternalPG(`
        SELECT 
          COUNT(*) FILTER (WHERE "Status da venda" IN ${APPROVED_STATUSES}) as vendas_aprovadas,
          SUM(CASE WHEN "Status da venda" IN ${APPROVED_STATUSES} THEN COALESCE(NULLIF(REPLACE("Valor Bruto", ',', '.'), '')::numeric, 0) ELSE 0 END) as receita_bruta,
          SUM(CASE WHEN "Status da venda" IN ${APPROVED_STATUSES} THEN COALESCE(NULLIF(REPLACE("Valor Líquido", ',', '.'), '')::numeric, 0) ELSE 0 END) as receita_liquida,
          SUM(CASE WHEN "Status da venda" IN ${APPROVED_STATUSES} THEN COALESCE(NULLIF(REPLACE("Co-Produtor", ',', '.'), '')::numeric, 0) ELSE 0 END) as co_produtor,
          SUM(CASE WHEN "Status da venda" IN ${APPROVED_STATUSES} THEN COALESCE(NULLIF(REPLACE("TAXA GREEN", ',', '.'), '')::numeric, 0) ELSE 0 END) as taxa_green
        FROM ${config.greenSchema}
        WHERE ${pFilter} ${salesDateFilter} ${salesPhoneFilter}
      `, params);

      let bumpSalesRow: any = { vendas_bump: 0, vendas_cnpj: 0, receita_bruta_bump: 0, receita_liquida_bump: 0, co_produtor_bump: 0, taxa_green_bump: 0 };
      if (!isPanel && config.bumpProducts.length > 0) {
        const bFilter = bumpFilter(config, filters.principalProduct);
        const bumpSales = await queryExternalPG(`
          SELECT 
            COUNT(*) FILTER (WHERE "Status da venda" IN ${APPROVED_STATUSES}) as vendas_bump,
            COUNT(*) FILTER (WHERE "Status da venda" IN ${APPROVED_STATUSES} AND "Nome do produto" = 'Check-up do CNPJ') as vendas_cnpj,
            SUM(CASE WHEN "Status da venda" IN ${APPROVED_STATUSES} THEN COALESCE(NULLIF(REPLACE("Valor Bruto", ',', '.'), '')::numeric, 0) ELSE 0 END) as receita_bruta_bump,
            SUM(CASE WHEN "Status da venda" IN ${APPROVED_STATUSES} THEN COALESCE(NULLIF(REPLACE("Valor Líquido", ',', '.'), '')::numeric, 0) ELSE 0 END) as receita_liquida_bump,
            SUM(CASE WHEN "Status da venda" IN ${APPROVED_STATUSES} THEN COALESCE(NULLIF(REPLACE("Co-Produtor", ',', '.'), '')::numeric, 0) ELSE 0 END) as co_produtor_bump,
            SUM(CASE WHEN "Status da venda" IN ${APPROVED_STATUSES} THEN COALESCE(NULLIF(REPLACE("TAXA GREEN", ',', '.'), '')::numeric, 0) ELSE 0 END) as taxa_green_bump
          FROM ${config.greenSchema}
          WHERE ${bFilter} ${salesDateFilter} ${salesPhoneFilter}
        `, params);
        bumpSalesRow = bumpSales[0] || bumpSalesRow;
      }

      // For panel view: get co_produtor from all products in this project (including bumps)
      let panelCoProdutorTotal = 0;
      if (isPanel) {
        const allSales = await queryExternalPG(`
          SELECT 
            SUM(CASE WHEN "Status da venda" IN ${APPROVED_STATUSES} THEN COALESCE(NULLIF(REPLACE("Co-Produtor", ',', '.'), '')::numeric, 0) ELSE 0 END) as co_produtor_all
          FROM ${config.greenSchema}
          WHERE ${apFilter} ${salesDateFilter} ${salesPhoneFilter}
        `, params);
        panelCoProdutorTotal = Number((allSales[0] as any)?.co_produtor_all || 0);
      }

      const products = await queryExternalPG(`
        SELECT 
          "Nome do produto" as produto,
          COUNT(*) FILTER (WHERE "Status da venda" IN ${APPROVED_STATUSES}) as vendas_aprovadas,
          SUM(CASE WHEN "Status da venda" IN ${APPROVED_STATUSES} THEN COALESCE(NULLIF(REPLACE("Valor Bruto", ',', '.'), '')::numeric, 0) ELSE 0 END) as receita_bruta,
          SUM(CASE WHEN "Status da venda" IN ${APPROVED_STATUSES} THEN COALESCE(NULLIF(REPLACE("Valor Líquido", ',', '.'), '')::numeric, 0) ELSE 0 END) as receita_liquida
        FROM ${config.greenSchema}
        WHERE ${apFilter} ${salesDateFilter} ${salesPhoneFilter}
        GROUP BY "Nome do produto"
      `, params);

      const vendasPrincipal = Number((principalSales[0] as any)?.vendas_aprovadas || 0);
      const vendasCnpj = Number(bumpSalesRow?.vendas_cnpj || 0);
      const taxaFixaTotal = config.taxaFixaPorVenda > 0 ? (vendasPrincipal + vendasCnpj) * config.taxaFixaPorVenda : 0;
      let receitaBrutaTotal = Number((principalSales[0] as any)?.receita_bruta || 0) + Number(bumpSalesRow?.receita_bruta_bump || 0);
      let receitaLiquidaTotal = Number((principalSales[0] as any)?.receita_liquida || 0) + Number(bumpSalesRow?.receita_liquida_bump || 0);
      let coProdutorTotal = isPanel ? panelCoProdutorTotal : (Number((principalSales[0] as any)?.co_produtor || 0) + Number(bumpSalesRow?.co_produtor_bump || 0));
      const taxaGreenTotal = Number((principalSales[0] as any)?.taxa_green || 0) + Number(bumpSalesRow?.taxa_green_bump || 0);

      // TMB sales (parcela=0) — merge into totals
      let tmbSummary = { vendas: 0, repasse: 0, repasse_coprodutor: 0, taxa_tmb: 0, valor_total: 0 };
      let tmbParcelas: { total_parcelas: number; valor_total: number; repasse: number; repasse_coprodutor: number; taxa_tmb: number; por_parcela: any[] } = { total_parcelas: 0, valor_total: 0, repasse: 0, repasse_coprodutor: 0, taxa_tmb: 0, por_parcela: [] };
      if (config.tmbTable) {
        const tmbEmailFilter = filters.leadSources ? await buildTmbEmailFilter(filteredConfig) : '';
        [tmbSummary, tmbParcelas] = await Promise.all([
          queryTmbSalesSummary(config.tmbTable, params, tmbEmailFilter),
          queryTmbParcelas(config.tmbTable, params),
        ]);
        receitaBrutaTotal += tmbSummary.valor_total;
        receitaLiquidaTotal += tmbSummary.repasse;
        coProdutorTotal += tmbSummary.repasse_coprodutor;
      }

      const [totalLeads, cicloMedioVenda] = await Promise.all([
        queryLeadsTotal(filteredConfig, params),
        queryCicloMedioVenda(filteredConfig, params, salesPhoneFilter, detectedSalesPhoneCol),
      ]);

      // Add TMB products to products list if there are TMB sales
      const productsArr = products as any[];
      if (tmbSummary.vendas > 0) {
        productsArr.push({
          produto: 'Formação Consultor 360 (TMB)',
          vendas_aprovadas: tmbSummary.vendas,
          receita_bruta: tmbSummary.valor_total,
          receita_liquida: tmbSummary.repasse,
        });
      }

      data = [{
        traffic: { ...(traffic[0] as any), total_leads: totalLeads },
        sales: {
          vendas_aprovadas: vendasPrincipal + tmbSummary.vendas,
          vendas_bump: Number(bumpSalesRow?.vendas_bump || 0),
          receita_bruta: receitaBrutaTotal,
          receita_liquida: receitaLiquidaTotal,
          taxa_fixa: taxaFixaTotal,
          co_produtor: coProdutorTotal,
          taxa_green: taxaGreenTotal,
          taxa_tmb: tmbSummary.taxa_tmb,
        },
        products: productsArr,
        parcelas: tmbParcelas.total_parcelas > 0 ? {
          total_parcelas: tmbParcelas.total_parcelas,
          valor_total: tmbParcelas.valor_total,
          repasse: tmbParcelas.repasse,
          repasse_coprodutor: tmbParcelas.repasse_coprodutor,
          taxa_tmb: tmbParcelas.taxa_tmb,
          por_parcela: tmbParcelas.por_parcela,
        } : null,
        ciclo_medio_venda: cicloMedioVenda,
      }];

    } else if (endpoint === 'campaigns') {
      data = await queryExternalPG(`
        SELECT 
          campanha,
          SUM(impressoes) as impressoes,
          SUM(alcance) as alcance,
          SUM(cliques) as cliques,
          SUM(cliques_link) as cliques_link,
          SUM(views_pagina) as views_pagina,
          SUM(checkouts) as checkouts,
          SUM(compras) as compras,
          SUM(valor_compras) as valor_compras,
          SUM(gasto) as gasto,
          SUM(views_3s) as views_3s,
          COALESCE(SUM(endform), 0) as endform,
          COALESCE(SUM(lead_aplicacao), 0) as lead_aplicacao,
          COALESCE(SUM(lead_presencial), 0) as lead_presencial,
          COALESCE(SUM(leads), 0) as meta_leads,
          CASE WHEN SUM(cliques) > 0 THEN SUM(gasto) / SUM(cliques) ELSE 0 END as cpc,
          CASE WHEN SUM(impressoes) > 0 THEN (SUM(gasto) / SUM(impressoes)) * 1000 ELSE 0 END as cpm,
          CASE WHEN SUM(alcance) > 0 THEN SUM(impressoes)::numeric / SUM(alcance) ELSE 0 END as frequencia,
          CASE WHEN SUM(impressoes) > 0 THEN SUM(views_3s)::numeric / SUM(impressoes) ELSE 0 END as tsr,
          CASE WHEN BOOL_OR(UPPER(status_campanha) = 'ACTIVE') THEN 'ACTIVE' ELSE MAX(status_campanha) END as status
        FROM ${config.metaTable}
        WHERE 1=1 ${dateFilter} ${metaFilter} ${UNPAID_EXCLUSIONS}
        GROUP BY campanha
        ORDER BY SUM(gasto) DESC
      `, params);

    } else if (endpoint === 'ads') {
      const adsRows = await queryExternalPG(`
        SELECT 
          anuncio,
          SUM(impressoes) as impressoes,
          SUM(alcance) as alcance,
          SUM(cliques) as cliques,
          SUM(cliques_link) as cliques_link,
          SUM(views_pagina) as views_pagina,
          SUM(gasto) as gasto,
          SUM(views_3s) as views_3s,
          SUM(compras) as compras,
          SUM(valor_compras) as valor_compras,
          COALESCE(SUM(endform), 0) as endform,
          COALESCE(SUM(lead_aplicacao), 0) as lead_aplicacao,
          COALESCE(SUM(lead_presencial), 0) as lead_presencial,
          COALESCE(SUM(leads), 0) as meta_leads,
          CASE WHEN SUM(impressoes) > 0 THEN SUM(cliques)::numeric / SUM(impressoes) ELSE 0 END as ctr,
          CASE WHEN SUM(impressoes) > 0 THEN SUM(views_3s)::numeric / SUM(impressoes) ELSE 0 END as thumb_stop_rate,
          CASE WHEN SUM(cliques) > 0 THEN SUM(gasto) / SUM(cliques) ELSE 0 END as cpc,
          CASE WHEN SUM(impressoes) > 0 THEN (SUM(gasto) / SUM(impressoes)) * 1000 ELSE 0 END as cpm,
          CASE WHEN BOOL_OR(UPPER(status_anuncio) = 'ACTIVE') THEN 'ACTIVE' ELSE MAX(status_anuncio) END as status
        FROM ${config.metaTable}
        WHERE 1=1 ${dateFilter} ${metaFilter} ${UNPAID_EXCLUSIONS}
        GROUP BY anuncio
        ORDER BY SUM(gasto) DESC
      `, params);

      let linksRows: unknown[] = [];
      try {
        linksRows = await queryExternalPG(`
          SELECT anuncio, link_preview as link
          FROM ${config.linksTable}
        `, []);
      } catch (e) {
        console.error('Error fetching links table:', e);
      }

      const linkMap = new Map<string, string>();
      for (const l of linksRows as any[]) {
        if (l.anuncio && l.link) linkMap.set(String(l.anuncio), String(l.link));
      }

      data = (adsRows as any[]).map(row => ({
        ...row,
        link: linkMap.get(String(row.anuncio)) || null,
      }));

    } else if (endpoint === 'attribution') {
      data = await queryAttribution(filteredConfig, params);
    } else if (endpoint === 'debug_columns') {
      const tables = [config.greenSchema, ...config.leadConfigs.map(lc => lc.table)];
      const results: Record<string, string[]> = {};
      for (const t of [...new Set(tables)]) {
        const cols = await getTableColumns(t);
        results[t] = [...cols];
      }
      data = [results];
    }

    return new Response(JSON.stringify({ data }, (_, v) => typeof v === 'bigint' ? Number(v) : v), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Dashboard v10 error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
