// Dashboard query helpers — column detection, attribution, lead aggregation, TMB installments.
// Imports shared config/filters from ./dashboard-config.

import { query as queryExternalPG } from '../db.js';
import {
  type ProjectConfig,
  APPROVED_STATUSES,
  TMB_PAID_STATUSES,
  UNPAID_EXCLUSIONS,
  principalFilter,
} from './dashboard-config.js';

export const PHONE_CANDIDATES = ['telefone', 'Telefone', 'Telefone do cliente', 'telefone_cliente', 'celular', 'Celular'];
export const EMAIL_CANDIDATES = ['Email do cliente', 'email', 'Email', 'e-mail', 'E-mail'];

// ========== PHONE NORMALIZATION ==========
//
// Brazilian phones are stored in several variants across lead forms, Greenn sales,
// TMB sales and CSV exports:
//   - "+55 (11) 99999-9999"   (formatted)
//   - "5511999999999"         (digits only, 13 digits — new mobile format with the 9 prefix)
//   - "551199999999"          (digits only, 12 digits — old 8-digit mobile or fixed line)
//   - "1199999999"            (10 digits — no country code, old mobile format)
//   - "11999999999"           (11 digits — no country code, new mobile format)
//
// The Brazilian mobile 9-prefix mandate (2012) means the same customer can be stored
// as a 12-digit number in an old table and as a 13-digit number in a new one. To
// match them, we reduce each phone to a canonical 10-digit suffix: DDD (2) + 8-digit
// subscriber number, stripping country code and the mobile 9 if present.
//
// We also keep a "last 8 digits" key as a looser fallback — catches cases where DDD
// itself was typed differently (rare but does happen in cross-system captures).

export function digitsOnly(phone: string | null | undefined): string {
  return (phone ?? '').replace(/[^0-9]/g, '');
}

/**
 * Canonical form: last 10 digits (DDD + 8-digit subscriber), mobile 9 stripped if present.
 * Works regardless of whether the input has country code, formatting or the mobile 9 prefix.
 * Returns empty string if the input has fewer than 10 digits (not a valid BR phone).
 */
export function canonicalPhone(phone: string | null | undefined): string {
  let d = digitsOnly(phone);
  if (d.length < 10) return '';

  // Drop the country code 55 if present (13- or 12-digit starting with 55).
  if ((d.length === 13 || d.length === 12) && d.startsWith('55')) {
    d = d.slice(2);
  }

  // Drop the mobile 9 prefix if present (11-digit number where position 2 is '9').
  // After stripping 55, an 11-digit number means "DD 9 XXXXXXXX" (new mobile format).
  if (d.length === 11 && d[2] === '9') {
    d = d.slice(0, 2) + d.slice(3);
  }

  // At this point we expect 10 digits (DDD + 8-digit subscriber). Anything else is
  // weird data — return what we have for the looser fallbacks to handle.
  return d;
}

/** Last 8 digits — the subscriber number without DDD or mobile 9 prefix. */
export function last8(phone: string | null | undefined): string {
  const d = digitsOnly(phone);
  return d.length >= 8 ? d.slice(-8) : '';
}

/**
 * Build a set containing every canonical + last-8 variant of a phone.
 * Used when building the lead-phone lookup sets so a single Set.has() call can
 * answer "does any known lead phone match this sale phone?".
 */
export function phoneVariants(phone: string | null | undefined): string[] {
  const variants: string[] = [];
  const canon = canonicalPhone(phone);
  if (canon) variants.push('c:' + canon);
  const l8 = last8(phone);
  if (l8) variants.push('l8:' + l8);
  return variants;
}

// SQL helper: generate an expression that produces the canonical form of a phone column.
// Used in buildPhoneFilter so the SQL-level filter also benefits from canonicalisation.
function canonicalPhoneSql(col: string): string {
  // 1) strip non-digits; 2) strip leading 55; 3) strip the mobile 9 prefix; 4) keep last 10.
  return `
    RIGHT(
      CASE
        WHEN LENGTH(REGEXP_REPLACE(COALESCE(${col},''), '[^0-9]', '', 'g')) = 11
             AND SUBSTRING(REGEXP_REPLACE(COALESCE(${col},''), '[^0-9]', '', 'g'), 3, 1) = '9'
        THEN SUBSTRING(REGEXP_REPLACE(COALESCE(${col},''), '[^0-9]', '', 'g'), 1, 2)
             || SUBSTRING(REGEXP_REPLACE(COALESCE(${col},''), '[^0-9]', '', 'g'), 4)
        WHEN LENGTH(REGEXP_REPLACE(COALESCE(${col},''), '[^0-9]', '', 'g')) >= 12
             AND LEFT(REGEXP_REPLACE(COALESCE(${col},''), '[^0-9]', '', 'g'), 2) = '55'
        THEN (
          CASE
            WHEN LENGTH(REGEXP_REPLACE(COALESCE(${col},''), '[^0-9]', '', 'g')) = 13
                 AND SUBSTRING(REGEXP_REPLACE(COALESCE(${col},''), '[^0-9]', '', 'g'), 5, 1) = '9'
            THEN SUBSTRING(REGEXP_REPLACE(COALESCE(${col},''), '[^0-9]', '', 'g'), 3, 2)
                 || SUBSTRING(REGEXP_REPLACE(COALESCE(${col},''), '[^0-9]', '', 'g'), 6)
            ELSE SUBSTRING(REGEXP_REPLACE(COALESCE(${col},''), '[^0-9]', '', 'g'), 3)
          END
        )
        ELSE REGEXP_REPLACE(COALESCE(${col},''), '[^0-9]', '', 'g')
      END,
      10
    )
  `;
}

// Build a phone-based WHERE clause to filter sales by lead source phones.
// Uses canonical form on both sides so 12/13-digit mobile variants still match.
export function buildPhoneFilter(filteredConfig: ProjectConfig, salesPhoneCol: string): string {
  if (filteredConfig.leadConfigs.length === 0) return '';
  const unions = filteredConfig.leadConfigs.map(lc =>
    `SELECT DISTINCT ${canonicalPhoneSql(lc.phoneColumn)} as tel FROM ${lc.table} WHERE ${lc.phoneColumn} IS NOT NULL AND TRIM(${lc.phoneColumn}) != ''`
  ).join(' UNION ');
  return ` AND ${canonicalPhoneSql(salesPhoneCol)} IN (${unions})`;
}

export async function queryLeadsTotal(config: ProjectConfig, params: string[]): Promise<number> {
  if (config.leadConfigs.length === 0) return 0;
  const results = await Promise.all(
    config.leadConfigs.map((lc) => {
      const dateFilter = params.length >= 2
        ? ` WHERE ${lc.dateColumn}::date >= $1 AND ${lc.dateColumn}::date <= $2`
        : '';
      return queryExternalPG(
        `SELECT COUNT(${lc.countExpression}) as total FROM ${lc.table}${dateFilter}`,
        params
      );
    })
  );
  return results.reduce((sum, rows) => sum + Number((rows[0] as any)?.total || 0), 0);
}

export async function queryLeadsDaily(config: ProjectConfig, params: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (config.leadConfigs.length === 0) return map;
  const results = await Promise.all(
    config.leadConfigs.map((lc) => {
      const dateFilter = params.length >= 2
        ? ` WHERE ${lc.dateColumn}::date >= $1 AND ${lc.dateColumn}::date <= $2`
        : '';
      return queryExternalPG(
        `SELECT ${lc.dateColumn}::date as dia, COUNT(${lc.countExpression}) as total FROM ${lc.table}${dateFilter} GROUP BY ${lc.dateColumn}::date`,
        params
      );
    })
  );
  for (const rows of results) {
    for (const r of rows as any[]) {
      const key = String(r.dia).slice(0, 10);
      map.set(key, (map.get(key) || 0) + Number(r.total || 0));
    }
  }
  return map;
}

// ========== PHONE + EMAIL SALES ATTRIBUTION ==========

export async function getTableColumns(schemaAndTable: string): Promise<Set<string>> {
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

export function findColumn(columns: Set<string>, candidates: string[]): string | null {
  for (const c of candidates) {
    if (columns.has(c)) return `"${c}"`;
  }
  return null;
}

export async function queryAttribution(config: ProjectConfig, params: string[]): Promise<any[]> {
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

  // Build phone + email + lead-count sets per source.
  //
  // IMPORTANT: phone/email lookups must cover the ENTIRE lead history, not just
  // the requested window. A sale on 2026-04-10 can legitimately come from a
  // lead captured on 2025-12-15 — date-filtering the phone set silently
  // attributes such sales to "Não identificado".
  //
  // Only the `total` count is windowed (because it feeds the per-source "leads"
  // KPI in the dashboard, which is inherently date-scoped).
  const perSourcePromises = config.leadConfigs.map(async (lc) => {
    const leadEmailCol = leadEmailColumns.get(lc.sourceName);

    const [phoneRows, emailRows, countRows] = await Promise.all([
      queryExternalPG(
        `SELECT DISTINCT REGEXP_REPLACE(TRIM(${lc.phoneColumn}), '[^0-9]', '', 'g') as telefone
         FROM ${lc.table}
         WHERE ${lc.phoneColumn} IS NOT NULL AND TRIM(${lc.phoneColumn}) != ''`,
        []
      ),
      salesEmailColumn && leadEmailCol
        ? queryExternalPG(
            `SELECT DISTINCT LOWER(TRIM(${leadEmailCol})) as email
             FROM ${lc.table}
             WHERE ${leadEmailCol} IS NOT NULL AND TRIM(${leadEmailCol}) != ''`,
            []
          )
        : Promise.resolve([] as any[]),
      queryExternalPG(
        `SELECT COUNT(${lc.countExpression}) as total FROM ${lc.table}${
          params.length >= 2 ? ` WHERE ${lc.dateColumn}::date >= $1 AND ${lc.dateColumn}::date <= $2` : ''
        }`,
        params
      ),
    ]);

    // Store every variant of every lead phone so sale lookups can hit on any
    // of them. Prefix-tagged ('c:' canonical, 'l8:' last 8) so the two variants
    // never collide with each other.
    const phones = new Set<string>();
    for (const r of phoneRows as any[]) {
      if (r.telefone) {
        for (const v of phoneVariants(String(r.telefone))) phones.add(v);
      }
    }
    const emails = new Set<string>();
    for (const r of emailRows as any[]) {
      if (r.email) emails.add(String(r.email));
    }
    const total = Number((countRows[0] as any)?.total || 0);

    return { sourceName: lc.sourceName, phones, emails, total };
  });

  const perSource = await Promise.all(perSourcePromises);
  const sourcePhones: Map<string, Set<string>> = new Map();
  const sourceEmails: Map<string, Set<string>> = new Map();
  const leadCounts: Map<string, number> = new Map();
  for (const { sourceName, phones, emails, total } of perSource) {
    sourcePhones.set(sourceName, phones);
    if (emails.size > 0) sourceEmails.set(sourceName, emails);
    leadCounts.set(sourceName, total);
  }

  // Query spend per source using offer filters
  const sourceSpend: Map<string, number> = new Map();
  const sourceLeadMap: Record<string, string> = {};
  for (const lc of config.leadConfigs) {
    sourceLeadMap[lc.sourceName] = lc.sourceName;
  }
  for (const [, filters] of Object.entries(config.offerFilters)) {
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
    const matchedSources: string[] = [];

    // 1st pass: canonical phone match (handles 12↔13 digit variants + formatting).
    // Tries the canonical key first, then falls back to last-8 digits.
    const canonKey = 'c:' + canonicalPhone(sale.phone);
    const l8Key = 'l8:' + last8(sale.phone);
    for (const [sourceName, phones] of sourcePhones) {
      if ((canonKey !== 'c:' && phones.has(canonKey)) || (l8Key !== 'l8:' && phones.has(l8Key))) {
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

  // Attribute TMB sales (parcela = 0 only) if tmbTable is configured.
  // Tries phone first (backfilled from TMB portal CSV — see migration 006) against all
  // lead sources, then falls back to email against sources that have email columns.
  // Rows without any match land in "Não identificado".
  if (config.tmbTable) {
    const tmbDateFilter = params.length >= 2 ? ` AND data_pagamento::date >= $1 AND data_pagamento::date <= $2` : '';
    const tmbRows = await queryExternalPG(`
      SELECT REGEXP_REPLACE(TRIM(COALESCE(telefone,'')), '[^0-9]', '', 'g') as phone,
             LOWER(TRIM(COALESCE(cliente_email,''))) as email,
             COUNT(*) as vendas,
             COALESCE(SUM(valor_total), 0) as receita_bruta,
             COALESCE(SUM(repasse), 0) as receita_liquida
      FROM ${config.tmbTable}
      WHERE parcela = 0 AND status_pagamento IN ${TMB_PAID_STATUSES} ${tmbDateFilter}
      GROUP BY 1, 2
    `, params);

    for (const r of tmbRows as any[]) {
      const phone = r.phone ? String(r.phone) : '';
      const email = r.email ? String(r.email) : '';
      const vendas = Number(r.vendas || 0);
      const receita_bruta = Number(r.receita_bruta || 0);
      const receita_liquida = Number(r.receita_liquida || 0);

      const matchedSources: string[] = [];

      // 1st pass: canonical phone against all lead sources, with last-8 fallback
      if (phone) {
        const canonKey = 'c:' + canonicalPhone(phone);
        const l8Key = 'l8:' + last8(phone);
        for (const [sourceName, phones] of sourcePhones) {
          if ((canonKey !== 'c:' && phones.has(canonKey)) || (l8Key !== 'l8:' && phones.has(l8Key))) {
            matchedSources.push(sourceName);
          }
        }
      }

      // 2nd pass: email fallback against sources that have an email column
      if (matchedSources.length === 0 && email && sourceEmails.size > 0) {
        for (const [sourceName, emails] of sourceEmails) {
          if (emails.has(email)) {
            matchedSources.push(sourceName);
          }
        }
      }

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

/**
 * Average days from first lead capture to purchase, for sales whose customer
 * exists in any of the filtered lead sources.
 *
 * - Phone match uses canonical form (strips 55 + mobile 9) — same normalisation
 *   used by the attribution flow, so matches are consistent across the dashboard.
 * - "First lead date" means the earliest lead record for that phone, across ALL
 *   lead tables in the filtered config. This measures total time-to-buy from the
 *   customer's first touch, not just the last campaign they engaged with.
 * - Respects offer/project/date filters the same way the other summary queries do.
 * - Sales excluded from the numerator: rows without a phone, rows whose phone
 *   doesn't match any known lead, and rows whose lead date is after the sale
 *   (data errors).
 */
export async function queryLeadToSaleAvgDays(
  config: ProjectConfig,
  filteredConfig: ProjectConfig,
  principalProductName: string,
  dateFrom: string | null,
  dateTo: string | null,
  salesPhoneFilter: string
): Promise<{ avg_days: number | null; matched: number }> {
  if (filteredConfig.leadConfigs.length === 0) {
    return { avg_days: null, matched: 0 };
  }

  const params: string[] = [];
  let greenDateFilter = '';
  let tmbDateFilter = '';
  if (dateFrom && dateTo) {
    params.push(dateFrom, dateTo);
    greenDateFilter = ` AND g."Data"::date >= $1 AND g."Data"::date <= $2`;
    tmbDateFilter = ` AND t.data_pagamento::date >= $1 AND t.data_pagamento::date <= $2`;
  }

  const pFilter = principalFilter(config, principalProductName);

  const leadUnion = filteredConfig.leadConfigs
    .map(
      (lc) =>
        `SELECT ${canonicalPhoneSql(lc.phoneColumn)} AS phone, ${lc.dateColumn}::timestamp AS lead_date
         FROM ${lc.table}
         WHERE ${lc.phoneColumn} IS NOT NULL AND TRIM(${lc.phoneColumn}) != ''`
    )
    .join(' UNION ALL ');

  const tmbUnion = config.tmbTable
    ? `UNION ALL
       SELECT ${canonicalPhoneSql('t.telefone')} AS phone,
              t.data_pagamento::timestamp AS sale_date
       FROM ${config.tmbTable} t
       WHERE t.parcela = 0
         AND t.status_pagamento IN ${TMB_PAID_STATUSES}
         AND t.data_pagamento IS NOT NULL
         AND t.telefone IS NOT NULL AND TRIM(t.telefone) != ''
         ${tmbDateFilter}`
    : '';

  const sql = `
    WITH lead_first AS (
      SELECT phone, MIN(lead_date) AS first_date
      FROM (${leadUnion}) all_leads
      WHERE phone IS NOT NULL AND phone != ''
      GROUP BY phone
    ),
    paid_sales AS (
      SELECT ${canonicalPhoneSql('g.telefone')} AS phone,
             g."Data"::timestamp AS sale_date
      FROM ${config.greenSchema} g
      WHERE ${pFilter}
        AND g."Status da venda" IN ${APPROVED_STATUSES}
        AND g.telefone IS NOT NULL AND TRIM(g.telefone) != ''
        ${greenDateFilter}
        ${salesPhoneFilter}
      ${tmbUnion}
    )
    SELECT
      AVG(EXTRACT(EPOCH FROM (s.sale_date - l.first_date)) / 86400.0) AS avg_days,
      COUNT(*) AS matched
    FROM paid_sales s
    JOIN lead_first l ON s.phone = l.phone AND l.first_date <= s.sale_date
  `;

  const rows = await queryExternalPG(sql, params);
  const row = rows[0] as any;
  return {
    avg_days: row?.avg_days != null ? Number(row.avg_days) : null,
    matched: Number(row?.matched || 0),
  };
}

export async function queryTmbSalesSummary(tmbTable: string, params: string[], emailFilter: string): Promise<{ vendas: number; repasse: number; repasse_coprodutor: number; taxa_tmb: number; valor_total: number }> {
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
export async function queryTmbSalesDaily(tmbTable: string, params: string[], emailFilter: string): Promise<Map<string, { vendas: number; repasse: number; repasse_coprodutor: number; taxa_tmb: number; valor_total: number }>> {
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
export async function queryTmbParcelas(tmbTable: string, params: string[]): Promise<{ total_parcelas: number; valor_total: number; repasse: number; repasse_coprodutor: number; taxa_tmb: number; por_parcela: Array<{ parcela: number; quantidade: number; valor_total: number; repasse: number; repasse_coprodutor: number; taxa_tmb: number }> }> {
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
export async function buildTmbEmailFilter(filteredConfig: ProjectConfig): Promise<string> {
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
