// Dashboard data edge function v10 — multi-project + leads + attribution
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const APPROVED_STATUSES = `('paid','Paid','approved','Aprovada','aprovada','Completa','completa')`;

async function queryExternalPG(sql: string, params: unknown[] = []) {
  const client = new Client({
    hostname: "72.60.51.200",
    port: 5432,
    database: "postgres",
    user: "postgres",
    password: "REDACTED_PG_PASS",
    tls: { enabled: false },
  });
  await client.connect();
  try {
    const result = await client.queryObject(sql, params);
    return result.rows;
  } finally {
    await client.end();
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
}

interface OfferFilters {
  metaWhere: string;
  principalProduct: string;
  useEmailLinkedBumps: boolean;
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
    defaultMetaWhere: ` AND (UPPER(campanha) LIKE '%50K-DEZ25%' OR UPPER(campanha) LIKE '%LEADS APLICACAO%' OR UPPER(campanha) LIKE '%LEADS APLICAÇÃO%' OR UPPER(campanha) LIKE '%PRESENCIAL%')`,
    offerFilters: {},
    leadConfigs: [
      { table: 'bd_ads_clientes.leads_uelicon_venancio_aplicacao_formac', dateColumn: '"Data"', countExpression: 'DISTINCT "telefone"', phoneColumn: '"telefone"', sourceName: 'Aplicação' },
      { table: 'bd_ads_clientes.leads_uelicon_venancio_acao_50k_ter', dateColumn: '"Data"', countExpression: '*', phoneColumn: '"telefone"', sourceName: 'Lançamento 50K' },
      { table: 'bd_ads_clientes.leads_uelicon_venancio_presencial', dateColumn: '"Data"', countExpression: 'DISTINCT "telefone"', phoneColumn: '"telefone"', sourceName: 'Presencial' },
    ],
  },
};

function getProjectConfig(project: string): ProjectConfig {
  return PROJECTS[project] || PROJECTS['checkup'];
}

function getOfferFiltersForProject(config: ProjectConfig, offer: string): OfferFilters {
  if (offer && offer !== 'all' && config.offerFilters[offer]) {
    return config.offerFilters[offer];
  }
  return {
    metaWhere: config.defaultMetaWhere,
    principalProduct: '',
    useEmailLinkedBumps: false,
  };
}

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

// ========== EMAIL-BASED SALES ATTRIBUTION ==========
async function queryAttribution(config: ProjectConfig, params: string[]): Promise<any[]> {
  if (config.leadConfigs.length === 0) return [];

  const salesDateFilter = params.length >= 2
    ? ` AND "Data"::date >= $1 AND "Data"::date <= $2`
    : '';
  const pFilter = principalFilter(config, '');

  // 1) Get approved sale phones in the period
  const salesRows = await queryExternalPG(`
    SELECT REGEXP_REPLACE(TRIM("Telefone do cliente"), '[^0-9]', '', 'g') as telefone,
           COUNT(*) as vendas,
           SUM(COALESCE(NULLIF(REPLACE("Valor Bruto", ',', '.'), '')::numeric, 0)) as receita_bruta,
           SUM(COALESCE(NULLIF(REPLACE("Valor Líquido", ',', '.'), '')::numeric, 0)) as receita_liquida
    FROM ${config.greenSchema}
    WHERE ${pFilter} AND "Status da venda" IN ${APPROVED_STATUSES} ${salesDateFilter}
      AND "Telefone do cliente" IS NOT NULL AND TRIM("Telefone do cliente") != ''
    GROUP BY REGEXP_REPLACE(TRIM("Telefone do cliente"), '[^0-9]', '', 'g')
  `, params);

  const salesByPhone = new Map<string, { vendas: number; receita_bruta: number; receita_liquida: number }>();
  for (const r of salesRows as any[]) {
    if (r.telefone) {
      salesByPhone.set(String(r.telefone), {
        vendas: Number(r.vendas || 0),
        receita_bruta: Number(r.receita_bruta || 0),
        receita_liquida: Number(r.receita_liquida || 0),
      });
    }
  }

  // 2) Get phones from each lead source (all time - to catch leads that registered before)
  const sourcePhones: Map<string, Set<string>> = new Map();
  for (const lc of config.leadConfigs) {
    const rows = await queryExternalPG(
      `SELECT DISTINCT REGEXP_REPLACE(TRIM(${lc.emailColumn}), '[^0-9]', '', 'g') as telefone FROM ${lc.table} WHERE ${lc.emailColumn} IS NOT NULL AND TRIM(${lc.emailColumn}) != ''`,
      []
    );
    const phones = new Set<string>();
    for (const r of rows as any[]) {
      if (r.telefone) phones.add(String(r.telefone));
    }
    sourcePhones.set(lc.sourceName, phones);
  }

  // 3) Get lead counts per source for the period
  const leadsDateFilter = params.length >= 2
    ? ` WHERE ${config.leadConfigs[0].dateColumn}::date >= $1 AND ${config.leadConfigs[0].dateColumn}::date <= $2`
    : '';

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

  // 4) Cross-reference: for each sale email, find which sources it belongs to
  const attribution: Map<string, { vendas: number; receita_bruta: number; receita_liquida: number; leads: number }> = new Map();
  // Initialize
  for (const lc of config.leadConfigs) {
    attribution.set(lc.sourceName, { vendas: 0, receita_bruta: 0, receita_liquida: 0, leads: leadCounts.get(lc.sourceName) || 0 });
  }
  attribution.set('Não identificado', { vendas: 0, receita_bruta: 0, receita_liquida: 0, leads: 0 });

  for (const [phone, sale] of salesByPhone) {
    // Find which sources this phone belongs to
    const matchedSources: string[] = [];
    for (const [sourceName, phones] of sourcePhones) {
      if (phones.has(phone)) {
        matchedSources.push(sourceName);
      }
    }

    if (matchedSources.length === 0) {
      // Not found in any lead source
      const entry = attribution.get('Não identificado')!;
      entry.vendas += sale.vendas;
      entry.receita_bruta += sale.receita_bruta;
      entry.receita_liquida += sale.receita_liquida;
    } else {
      // Proportional distribution
      const weight = 1 / matchedSources.length;
      for (const src of matchedSources) {
        const entry = attribution.get(src)!;
        entry.vendas += sale.vendas * weight;
        entry.receita_bruta += sale.receita_bruta * weight;
        entry.receita_liquida += sale.receita_liquida * weight;
      }
    }
  }

  // Convert to array
  const result: any[] = [];
  for (const [source, data] of attribution) {
    if (data.vendas > 0 || data.leads > 0) {
      result.push({
        source,
        leads: data.leads,
        vendas: Math.round(data.vendas * 100) / 100,
        receita_bruta: Math.round(data.receita_bruta * 100) / 100,
        receita_liquida: Math.round(data.receita_liquida * 100) / 100,
        taxa_conversao: data.leads > 0 ? data.vendas / data.leads : 0,
      });
    }
  }

  return result;
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
          data::date as dia,
          SUM(impressoes) as impressoes,
          SUM(alcance) as alcance,
          SUM(cliques) as cliques,
          SUM(cliques_link) as cliques_link,
          SUM(views_pagina) as views_pagina,
          SUM(checkouts) as checkouts,
          SUM(compras) as compras,
          SUM(valor_compras) as valor_compras,
          SUM(gasto) as gasto,
          SUM(views_3s) as views_3s
        FROM ${config.metaTable}
        WHERE 1=1 ${dateFilter} ${metaFilter}
        GROUP BY data::date
        ORDER BY data::date DESC
      `, params);

      const leadsMap = await queryLeadsDaily(config, params);
      data = (trafficRows as any[]).map(row => ({
        ...row,
        leads: leadsMap.get(String(row.dia).slice(0, 10)) || 0,
      }));

    } else if (endpoint === 'sales_daily') {
      const salesDateFilter = dateFrom && dateTo
        ? ` AND "Data"::date >= $1 AND "Data"::date <= $2`
        : '';

      const pFilter = principalFilter(config, filters.principalProduct);

      const principalRows = await queryExternalPG(`
        SELECT 
          "Data"::date as dia,
          COUNT(*) FILTER (WHERE "Status da venda" IN ${APPROVED_STATUSES}) as vendas_aprovadas,
          SUM(CASE WHEN "Status da venda" IN ${APPROVED_STATUSES} THEN COALESCE(NULLIF(REPLACE("Valor Bruto", ',', '.'), '')::numeric, 0) ELSE 0 END) as receita_bruta,
          SUM(CASE WHEN "Status da venda" IN ${APPROVED_STATUSES} THEN COALESCE(NULLIF(REPLACE("Valor Líquido", ',', '.'), '')::numeric, 0) ELSE 0 END) as receita_liquida,
          SUM(CASE WHEN "Status da venda" IN ${APPROVED_STATUSES} THEN COALESCE(NULLIF(REPLACE("Co-Produtor", ',', '.'), '')::numeric, 0) ELSE 0 END) as co_produtor
        FROM ${config.greenSchema}
        WHERE ${pFilter} ${salesDateFilter}
        GROUP BY "Data"::date
        ORDER BY "Data"::date DESC
      `, params);

      let bumpRows: any[] = [];
      if (config.bumpProducts.length > 0) {
        const bFilter = bumpFilter(config, filters.principalProduct);
        bumpRows = await queryExternalPG(`
          SELECT 
            "Data"::date as dia,
            SUM(CASE WHEN "Status da venda" IN ${APPROVED_STATUSES} THEN COALESCE(NULLIF(REPLACE("Valor Bruto", ',', '.'), '')::numeric, 0) ELSE 0 END) as receita_bruta_bump,
            SUM(CASE WHEN "Status da venda" IN ${APPROVED_STATUSES} THEN COALESCE(NULLIF(REPLACE("Valor Líquido", ',', '.'), '')::numeric, 0) ELSE 0 END) as receita_liquida_bump,
            SUM(CASE WHEN "Status da venda" IN ${APPROVED_STATUSES} THEN COALESCE(NULLIF(REPLACE("Co-Produtor", ',', '.'), '')::numeric, 0) ELSE 0 END) as co_produtor_bump,
            COUNT(*) FILTER (WHERE "Status da venda" IN ${APPROVED_STATUSES} AND "Nome do produto" = 'Check-up do CNPJ') as vendas_cnpj
          FROM ${config.greenSchema}
          WHERE ${bFilter} ${salesDateFilter}
          GROUP BY "Data"::date
        `, params) as any[];
      }

      const bumpMap = new Map();
      for (const b of bumpRows) {
        bumpMap.set(String(b.dia), b);
      }

      data = (principalRows as any[]).map(p => {
        const bump = bumpMap.get(String(p.dia)) || { receita_bruta_bump: 0, receita_liquida_bump: 0, co_produtor_bump: 0, vendas_cnpj: 0 };
        const vendas = Number(p.vendas_aprovadas || 0);
        const vendasCnpj = Number(bump.vendas_cnpj || 0);
        const taxaFixa = config.taxaFixaPorVenda > 0 ? (vendas + vendasCnpj) * config.taxaFixaPorVenda : 0;
        return {
          dia: p.dia,
          vendas_aprovadas: vendas,
          receita_bruta: Number(p.receita_bruta || 0) + Number(bump.receita_bruta_bump || 0),
          receita_liquida: Number(p.receita_liquida || 0) + Number(bump.receita_liquida_bump || 0),
          taxa_fixa: taxaFixa,
          co_produtor: Number(p.co_produtor || 0) + Number(bump.co_produtor_bump || 0),
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
        WHERE 1=1 ${dateFilter} ${metaFilter}
      `, params);

      const salesDateFilter = dateFrom && dateTo
        ? ` AND "Data"::date >= $1 AND "Data"::date <= $2`
        : '';

      const pFilter = principalFilter(config, filters.principalProduct);
      const apFilter = allProductsFilter(config, filters.principalProduct);

      const principalSales = await queryExternalPG(`
        SELECT 
          COUNT(*) FILTER (WHERE "Status da venda" IN ${APPROVED_STATUSES}) as vendas_aprovadas,
          SUM(CASE WHEN "Status da venda" IN ${APPROVED_STATUSES} THEN COALESCE(NULLIF(REPLACE("Valor Bruto", ',', '.'), '')::numeric, 0) ELSE 0 END) as receita_bruta,
          SUM(CASE WHEN "Status da venda" IN ${APPROVED_STATUSES} THEN COALESCE(NULLIF(REPLACE("Valor Líquido", ',', '.'), '')::numeric, 0) ELSE 0 END) as receita_liquida,
          SUM(CASE WHEN "Status da venda" IN ${APPROVED_STATUSES} THEN COALESCE(NULLIF(REPLACE("Co-Produtor", ',', '.'), '')::numeric, 0) ELSE 0 END) as co_produtor,
          SUM(CASE WHEN "Status da venda" IN ${APPROVED_STATUSES} THEN COALESCE(NULLIF(REPLACE("TAXA GREEN", ',', '.'), '')::numeric, 0) ELSE 0 END) as taxa_green
        FROM ${config.greenSchema}
        WHERE ${pFilter} ${salesDateFilter}
      `, params);

      let bumpSalesRow: any = { vendas_bump: 0, vendas_cnpj: 0, receita_bruta_bump: 0, receita_liquida_bump: 0, co_produtor_bump: 0, taxa_green_bump: 0 };
      if (config.bumpProducts.length > 0) {
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
          WHERE ${bFilter} ${salesDateFilter}
        `, params);
        bumpSalesRow = bumpSales[0] || bumpSalesRow;
      }

      const products = await queryExternalPG(`
        SELECT 
          "Nome do produto" as produto,
          COUNT(*) FILTER (WHERE "Status da venda" IN ${APPROVED_STATUSES}) as vendas_aprovadas,
          SUM(CASE WHEN "Status da venda" IN ${APPROVED_STATUSES} THEN COALESCE(NULLIF(REPLACE("Valor Bruto", ',', '.'), '')::numeric, 0) ELSE 0 END) as receita_bruta,
          SUM(CASE WHEN "Status da venda" IN ${APPROVED_STATUSES} THEN COALESCE(NULLIF(REPLACE("Valor Líquido", ',', '.'), '')::numeric, 0) ELSE 0 END) as receita_liquida
        FROM ${config.greenSchema}
        WHERE ${apFilter} ${salesDateFilter}
        GROUP BY "Nome do produto"
      `, params);

      const vendasPrincipal = Number((principalSales[0] as any)?.vendas_aprovadas || 0);
      const vendasCnpj = Number(bumpSalesRow?.vendas_cnpj || 0);
      const taxaFixaTotal = config.taxaFixaPorVenda > 0 ? (vendasPrincipal + vendasCnpj) * config.taxaFixaPorVenda : 0;
      const receitaBrutaTotal = Number((principalSales[0] as any)?.receita_bruta || 0) + Number(bumpSalesRow?.receita_bruta_bump || 0);
      const receitaLiquidaTotal = Number((principalSales[0] as any)?.receita_liquida || 0) + Number(bumpSalesRow?.receita_liquida_bump || 0);
      const coProdutorTotal = Number((principalSales[0] as any)?.co_produtor || 0) + Number(bumpSalesRow?.co_produtor_bump || 0);
      const taxaGreenTotal = Number((principalSales[0] as any)?.taxa_green || 0) + Number(bumpSalesRow?.taxa_green_bump || 0);

      const totalLeads = await queryLeadsTotal(config, params);

      data = [{
        traffic: { ...(traffic[0] as any), total_leads: totalLeads },
        sales: {
          vendas_aprovadas: vendasPrincipal,
          vendas_bump: Number(bumpSalesRow?.vendas_bump || 0),
          receita_bruta: receitaBrutaTotal,
          receita_liquida: receitaLiquidaTotal,
          taxa_fixa: taxaFixaTotal,
          co_produtor: coProdutorTotal,
          taxa_green: taxaGreenTotal,
        },
        products,
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
          CASE WHEN SUM(cliques) > 0 THEN SUM(gasto) / SUM(cliques) ELSE 0 END as cpc,
          CASE WHEN SUM(impressoes) > 0 THEN (SUM(gasto) / SUM(impressoes)) * 1000 ELSE 0 END as cpm,
          CASE WHEN BOOL_OR(UPPER(status_campanha) = 'ACTIVE') THEN 'ACTIVE' ELSE MAX(status_campanha) END as status
        FROM ${config.metaTable}
        WHERE 1=1 ${dateFilter} ${metaFilter}
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
          CASE WHEN SUM(impressoes) > 0 THEN SUM(cliques)::numeric / SUM(impressoes) ELSE 0 END as ctr,
          CASE WHEN SUM(impressoes) > 0 THEN SUM(views_3s)::numeric / SUM(impressoes) ELSE 0 END as thumb_stop_rate,
          CASE WHEN SUM(cliques) > 0 THEN SUM(gasto) / SUM(cliques) ELSE 0 END as cpc,
          CASE WHEN SUM(impressoes) > 0 THEN (SUM(gasto) / SUM(impressoes)) * 1000 ELSE 0 END as cpm,
          CASE WHEN BOOL_OR(UPPER(status_anuncio) = 'ACTIVE') THEN 'ACTIVE' ELSE MAX(status_anuncio) END as status
        FROM ${config.metaTable}
        WHERE 1=1 ${dateFilter} ${metaFilter}
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
      data = await queryAttribution(config, params);
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
