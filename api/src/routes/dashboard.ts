// Dashboard route — thin Router that composes config and helpers into the v10 endpoints.
// Business logic lives in ./dashboard-config and ./dashboard-helpers.

import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { query as queryExternalPG } from '../db.js';
import { requireAuth } from '../auth.js';
import {
  APPROVED_STATUSES,
  UNPAID_EXCLUSIONS,
  getProjectConfig,
  getOfferFiltersForProject,
  principalFilter,
  bumpFilter,
  allProductsFilter,
} from './dashboard-config.js';
import {
  PHONE_CANDIDATES,
  getTableColumns,
  findColumn,
  buildPhoneFilter,
  queryLeadsTotal,
  queryLeadsDaily,
  queryLeadToSaleAvgDays,
  queryAttribution,
  queryTmbSalesSummary,
  queryTmbSalesDaily,
  queryTmbParcelas,
  buildTmbEmailFilter,
} from './dashboard-helpers.js';


export const dashboardRouter = Router();

// Cap dashboard queries per IP. Each request hits multiple SQL queries on the
// shared PG, so a misbehaving client (or a compromised session) can burn the
// pool fast. 240 req / 5min / IP = ~50 per min per IP, well above any legit
// interactive usage but low enough to contain abuse.
const dashboardLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisições. Aguarde alguns minutos.' },
});

dashboardRouter.get(
  '/dashboard-data',
  dashboardLimiter,
  requireAuth,
  async (req: Request, res: Response) => {
  try {
    const endpoint = (req.query.endpoint as string) || 'summary';
    const dateFrom = (req.query.date_from as string) || null;
    const dateTo = (req.query.date_to as string) || null;
    const offer = (req.query.offer as string) || 'all';
    const project = (req.query.project as string) || 'checkup';

    const config = getProjectConfig(project);
    const filters = getOfferFiltersForProject(config, offer);
    const metaFilter = filters.metaWhere;

    // Filter leadConfigs by selected offer's leadSources
    const filteredConfig = filters.leadSources
      ? { ...config, leadConfigs: config.leadConfigs.filter(lc => filters.leadSources!.includes(lc.sourceName)) }
      : config;

    // Build phone-based sales filter when a specific campaign is selected
    let salesPhoneFilter = '';
    if (filters.leadSources && filteredConfig.leadConfigs.length > 0) {
      // Detect phone column in sales table
      const salesCols = await getTableColumns(config.greenSchema);
      const salesPhoneCol = findColumn(salesCols, PHONE_CANDIDATES);
      if (salesPhoneCol) {
        salesPhoneFilter = buildPhoneFilter(filteredConfig, salesPhoneCol);
      }
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

      const [totalLeads, leadToSale] = await Promise.all([
        queryLeadsTotal(filteredConfig, params),
        queryLeadToSaleAvgDays(
          config,
          filteredConfig,
          filters.principalProduct,
          dateFrom,
          dateTo,
          salesPhoneFilter
        ),
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
          lead_to_sale_avg_days: leadToSale.avg_days,
          lead_to_sale_matched: leadToSale.matched,
          lead_to_sale_distribution: leadToSale.distribution,
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

    const json = JSON.parse(
      JSON.stringify({ data }, (_, v) => (typeof v === 'bigint' ? Number(v) : v))
    );
    res.json(json);
  } catch (error: any) {
    console.error('Dashboard v10 error:', error);
    const exposeDetails = process.env.NODE_ENV !== 'production';
    res.status(500).json({
      error: exposeDetails ? error?.message || 'Internal server error' : 'Erro ao processar requisição',
    });
  }
  }
);
