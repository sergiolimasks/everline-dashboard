import type { SalesDaily, TrafficDaily } from "@/lib/dashboard-api";

function toDateKey(dia: string) {
  return String(dia).slice(0, 10);
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function getNeighborRate(
  points: Array<{ views: number; checkouts: number; sales: number }>,
  fromIndex: number,
  step: -1 | 1
) {
  let i = fromIndex + step;
  while (i >= 0 && i < points.length) {
    const point = points[i];
    if (point.views > 0 && point.checkouts > point.sales) {
      return point.checkouts / point.views;
    }
    i += step;
  }
  return null;
}

/**
 * Ajusta checkouts diários quando ficam inconsistentes (<= vendas aprovadas),
 * usando contexto dos dias vizinhos e mantendo o valor estimado acima das vendas.
 */
export function estimateCheckoutSeries(
  trafficDaily: TrafficDaily[] | undefined,
  salesDaily: SalesDaily[] | undefined
) {
  const salesByDate = new Map<string, number>();
  (salesDaily || []).forEach((day) => {
    const key = toDateKey(day.dia);
    salesByDate.set(key, (salesByDate.get(key) || 0) + Number(day.vendas_aprovadas || 0));
  });

  const points = (trafficDaily || [])
    .map((day) => {
      const key = toDateKey(day.dia);
      return {
        dia: key,
        views: Number(day.views_pagina || 0),
        checkouts: Number(day.checkouts || 0),
        sales: salesByDate.get(key) || 0,
      };
    })
    .sort((a, b) => a.dia.localeCompare(b.dia));

  const estimatedByDate = new Map<string, number>();
  if (!points.length) return estimatedByDate;

  const baselineRates = points
    .filter((p) => p.views > 0 && p.checkouts > p.sales)
    .map((p) => p.checkouts / p.views);

  const medianRate = median(baselineRates);

  for (let i = 0; i < points.length; i++) {
    const point = points[i];

    if (point.sales <= 0 || point.checkouts > point.sales) {
      estimatedByDate.set(point.dia, point.checkouts);
      continue;
    }

    const neighborRates: number[] = [];
    const prevRate = getNeighborRate(points, i, -1);
    const nextRate = getNeighborRate(points, i, 1);
    if (prevRate !== null) neighborRates.push(prevRate);
    if (nextRate !== null) neighborRates.push(nextRate);

    const contextualRate = neighborRates.length
      ? neighborRates.reduce((sum, rate) => sum + rate, 0) / neighborRates.length
      : medianRate;

    const minimumOverSales = point.sales + Math.max(1, Math.round(point.sales * 0.08));
    const fallbackRate = point.views > 0 ? Math.max(minimumOverSales / point.views, 0.02) : 0;
    const chosenRate = contextualRate > 0 ? contextualRate : fallbackRate;

    const estimateByRate = point.views > 0 ? Math.round(point.views * chosenRate) : minimumOverSales;
    let estimated = Math.max(estimateByRate, minimumOverSales);

    if (point.views > 0) {
      const logicalCap = Math.max(point.views, minimumOverSales);
      estimated = Math.min(estimated, logicalCap);
    }

    if (estimated <= point.sales) {
      estimated = point.sales + 1;
    }

    estimatedByDate.set(point.dia, estimated);
  }

  return estimatedByDate;
}

export function getEstimatedCheckoutsForDay(
  estimatedByDate: Map<string, number>,
  day: TrafficDaily
) {
  return estimatedByDate.get(toDateKey(day.dia)) ?? Number(day.checkouts || 0);
}

export function isDateInRange(day: string, dateFrom?: string, dateTo?: string) {
  const key = toDateKey(day);
  if (dateFrom && key < dateFrom) return false;
  if (dateTo && key > dateTo) return false;
  return true;
}