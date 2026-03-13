// Dashboard data edge function v5
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const APPROVED_STATUSES = `('paid','Paid','approved','Aprovada','aprovada','Completa','completa')`;
const TAXA_FIXA_POR_VENDA = 18;

// Only these products belong to this dashboard
const DASHBOARD_PRODUCTS_FILTER = `(LOWER("Nome do produto") LIKE '%check-up%' OR LOWER("Nome do produto") LIKE '%checkup%' OR LOWER("Nome do produto") LIKE '%vida financeira%' OR LOWER("Nome do produto") LIKE '%avalia__o individual%' OR LOWER("Nome do produto") LIKE '%cnpj%')`;

// Products considered "principal" (not order bumps) — only Check-up da Vida Financeira
const PRINCIPAL_PRODUCT_FILTER = `(LOWER("Nome do produto") LIKE '%check-up da vida%' OR LOWER("Nome do produto") LIKE '%checkup da vida%' OR LOWER("Nome do produto") LIKE '%check-up da vida financeira%')`;
// Order bumps: Avaliação individual + Check-up do CNPJ
const ORDERBUMP_PRODUCT_FILTER = `(${DASHBOARD_PRODUCTS_FILTER} AND NOT ${PRINCIPAL_PRODUCT_FILTER})`;

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { searchParams } = new URL(req.url);
    const endpoint = searchParams.get('endpoint') || 'summary';
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');

    let dateFilter = '';
    const params: string[] = [];

    if (dateFrom && dateTo) {
      dateFilter = ` AND data::date >= $1 AND data::date <= $2`;
      params.push(dateFrom, dateTo);
    }

    // IMPORTANT: Only CHECKOUT campaigns count for traffic
    const checkoutFilter = ` AND UPPER(campanha) LIKE '%CHECKUP%'`;

    let data: unknown[] = [];

    if (endpoint === 'traffic_daily') {
      data = await queryExternalPG(`
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
          SUM(gasto) as gasto
        FROM bd_ads_clientes.meta_uelicon_venancio
        WHERE 1=1 ${dateFilter} ${checkoutFilter}
        GROUP BY data::date
        ORDER BY data::date DESC
      `, params);
    } else if (endpoint === 'sales_daily') {
      const salesDateFilter = dateFrom && dateTo
        ? ` AND "Data"::date >= $1 AND "Data"::date <= $2`
        : '';
      
      // Principal product: count sales + revenue
      const principalRows = await queryExternalPG(`
        SELECT 
          "Data"::date as dia,
          COUNT(*) FILTER (WHERE "Status da venda" IN ${APPROVED_STATUSES}) as vendas_aprovadas,
          SUM(CASE WHEN "Status da venda" IN ${APPROVED_STATUSES} THEN REPLACE("Valor Bruto", ',', '.')::numeric ELSE 0 END) as receita_bruta,
          SUM(CASE WHEN "Status da venda" IN ${APPROVED_STATUSES} THEN REPLACE("Valor Líquido", ',', '.')::numeric ELSE 0 END) as receita_liquida
        FROM uelicon_database.controle_green
        WHERE ${PRINCIPAL_PRODUCT_FILTER} ${salesDateFilter}
        GROUP BY "Data"::date
        ORDER BY "Data"::date DESC
      `, params);

      // Order bumps: only revenue, no count
      const bumpRows = await queryExternalPG(`
        SELECT 
          "Data"::date as dia,
          SUM(CASE WHEN "Status da venda" IN ${APPROVED_STATUSES} THEN REPLACE("Valor Bruto", ',', '.')::numeric ELSE 0 END) as receita_bruta_bump,
          SUM(CASE WHEN "Status da venda" IN ${APPROVED_STATUSES} THEN REPLACE("Valor Líquido", ',', '.')::numeric ELSE 0 END) as receita_liquida_bump
        FROM uelicon_database.controle_green
        WHERE ${ORDERBUMP_PRODUCT_FILTER} ${salesDateFilter}
        GROUP BY "Data"::date
      `, params);

      // Merge by day
      const bumpMap = new Map();
      for (const b of bumpRows as any[]) {
        bumpMap.set(String(b.dia), b);
      }

      data = (principalRows as any[]).map(p => {
        const bump = bumpMap.get(String(p.dia)) || { receita_bruta_bump: 0, receita_liquida_bump: 0 };
        const vendas = Number(p.vendas_aprovadas || 0);
        const taxaFixa = vendas * TAXA_FIXA_POR_VENDA;
        return {
          dia: p.dia,
          vendas_aprovadas: vendas,
          receita_bruta: Number(p.receita_bruta || 0) + Number(bump.receita_bruta_bump || 0),
          receita_liquida: Number(p.receita_liquida || 0) + Number(bump.receita_liquida_bump || 0),
          taxa_fixa: taxaFixa,
        };
      });
    } else if (endpoint === 'summary') {
      // Traffic: only CHECKOUT campaigns
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
          COUNT(DISTINCT data::date) as dias_ativos
        FROM bd_ads_clientes.meta_uelicon_venancio
        WHERE 1=1 ${dateFilter} ${checkoutFilter}
      `, params);

      const salesDateFilter = dateFrom && dateTo
        ? ` AND "Data"::date >= $1 AND "Data"::date <= $2`
        : '';

      // Principal product sales
      const principalSales = await queryExternalPG(`
        SELECT 
          COUNT(*) FILTER (WHERE "Status da venda" IN ${APPROVED_STATUSES}) as vendas_aprovadas,
          SUM(CASE WHEN "Status da venda" IN ${APPROVED_STATUSES} THEN REPLACE("Valor Bruto", ',', '.')::numeric ELSE 0 END) as receita_bruta,
          SUM(CASE WHEN "Status da venda" IN ${APPROVED_STATUSES} THEN REPLACE("Valor Líquido", ',', '.')::numeric ELSE 0 END) as receita_liquida
        FROM uelicon_database.controle_green
        WHERE ${PRINCIPAL_PRODUCT_FILTER} ${salesDateFilter}
      `, params);

      // Order bump revenue only
      const bumpSales = await queryExternalPG(`
        SELECT 
          SUM(CASE WHEN "Status da venda" IN ${APPROVED_STATUSES} THEN REPLACE("Valor Bruto", ',', '.')::numeric ELSE 0 END) as receita_bruta_bump,
          SUM(CASE WHEN "Status da venda" IN ${APPROVED_STATUSES} THEN REPLACE("Valor Líquido", ',', '.')::numeric ELSE 0 END) as receita_liquida_bump
        FROM uelicon_database.controle_green
        WHERE ${ORDERBUMP_PRODUCT_FILTER} ${salesDateFilter}
      `, params);

      // Products breakdown
      const products = await queryExternalPG(`
        SELECT 
          "Nome do produto" as produto,
          COUNT(*) FILTER (WHERE "Status da venda" IN ${APPROVED_STATUSES}) as vendas_aprovadas,
          SUM(CASE WHEN "Status da venda" IN ${APPROVED_STATUSES} THEN REPLACE("Valor Bruto", ',', '.')::numeric ELSE 0 END) as receita_bruta,
          SUM(CASE WHEN "Status da venda" IN ${APPROVED_STATUSES} THEN REPLACE("Valor Líquido", ',', '.')::numeric ELSE 0 END) as receita_liquida
        FROM uelicon_database.controle_green
        WHERE ${DASHBOARD_PRODUCTS_FILTER} ${salesDateFilter}
        GROUP BY "Nome do produto"
      `, params);

      const vendasPrincipal = Number((principalSales[0] as any)?.vendas_aprovadas || 0);
      const taxaFixaTotal = vendasPrincipal * TAXA_FIXA_POR_VENDA;
      const receitaBrutaTotal = Number((principalSales[0] as any)?.receita_bruta || 0) + Number((bumpSales[0] as any)?.receita_bruta_bump || 0);
      const receitaLiquidaTotal = Number((principalSales[0] as any)?.receita_liquida || 0) + Number((bumpSales[0] as any)?.receita_liquida_bump || 0);

      data = [{
        traffic: traffic[0],
        sales: {
          vendas_aprovadas: vendasPrincipal,
          receita_bruta: receitaBrutaTotal,
          receita_liquida: receitaLiquidaTotal,
          taxa_fixa: taxaFixaTotal,
        },
        products,
      }];
    } else if (endpoint === 'campaigns') {
      // Only CHECKUP campaigns
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
          CASE WHEN SUM(impressoes) > 0 THEN (SUM(gasto) / SUM(impressoes)) * 1000 ELSE 0 END as cpm
        FROM bd_ads_clientes.meta_uelicon_venancio
        WHERE 1=1 ${dateFilter} ${checkoutFilter}
        GROUP BY campanha
        ORDER BY SUM(gasto) DESC
      `, params);
    }

    return new Response(JSON.stringify({ data }, (_, v) => typeof v === 'bigint' ? Number(v) : v), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Dashboard v5 error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
