import type { SummaryData, TrafficDaily, SalesDaily } from "@/lib/dashboard-api";
import { Lightbulb } from "lucide-react";

interface InsightsProps {
  summary: SummaryData | undefined;
  trafficDaily: TrafficDaily[] | undefined;
  salesDaily: SalesDaily[] | undefined;
  isLoading: boolean;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function Insights({ summary, trafficDaily, salesDaily, isLoading }: InsightsProps) {
  if (isLoading || !summary) {
    return null;
  }

  const insights: Array<{ text: string; type: 'success' | 'warning' | 'info' }> = [];

  const totalGasto = Number(summary.traffic?.total_gasto || 0);
  const receitaLiquida = Number(summary.sales?.receita_liquida || 0);
  const vendasAprovadas = Number(summary.sales?.vendas_aprovadas || 0);
  const lucro = receitaLiquida - totalGasto;
  const roi = totalGasto > 0 ? ((receitaLiquida - totalGasto) / totalGasto) * 100 : 0;
  const cac = vendasAprovadas > 0 ? totalGasto / vendasAprovadas : 0;

  // ROI insight
  if (roi > 0) {
    insights.push({ text: `ROI positivo de ${roi.toFixed(1)}%. Para cada R$1 investido, retornam R$${((roi / 100) + 1).toFixed(2)}.`, type: 'success' });
  } else {
    insights.push({ text: `ROI negativo de ${roi.toFixed(1)}%. Operação no prejuízo de ${formatCurrency(Math.abs(lucro))}.`, type: 'warning' });
  }

  // CAC insight
  if (cac > 0) {
    insights.push({ text: `CAC atual: ${formatCurrency(cac)}. Cada cliente custa isso para adquirir.`, type: 'info' });
  }

  // Checkout campaign correlation
  const gastoCheckout = Number(summary.checkout_traffic?.gasto_checkout || 0);
  if (gastoCheckout > 0 && totalGasto > 0) {
    const percentCheckout = (gastoCheckout / totalGasto) * 100;
    insights.push({
      text: `Campanhas CHECKOUT representam ${percentCheckout.toFixed(1)}% do investimento total (${formatCurrency(gastoCheckout)}).`,
      type: 'info',
    });
  }

  // Order bump rate
  const products = summary.products || [];
  const checkupVendas = products
    .filter((p) => (p.produto || '').toLowerCase().includes('checkup') || (p.produto || '').toLowerCase().includes('vida financeira'))
    .reduce((sum, p) => sum + Number(p.vendas_aprovadas), 0);
  const bumpVendas = products
    .filter((p) => !(p.produto || '').toLowerCase().includes('checkup') && !(p.produto || '').toLowerCase().includes('vida financeira'))
    .reduce((sum, p) => sum + Number(p.vendas_aprovadas), 0);

  if (checkupVendas > 0) {
    const bumpRate = (bumpVendas / checkupVendas) * 100;
    insights.push({
      text: `Taxa de order bump: ${bumpRate.toFixed(1)}%. De ${checkupVendas} vendas do Checkup, ${bumpVendas} compraram order bumps.`,
      type: bumpRate > 20 ? 'success' : 'warning',
    });
  }

  // Best day
  if (salesDaily && salesDaily.length > 0) {
    const dailyMap = new Map<string, number>();
    salesDaily.forEach((d) => {
      dailyMap.set(d.dia, (dailyMap.get(d.dia) || 0) + Number(d.vendas_aprovadas));
    });
    const bestDay = Array.from(dailyMap.entries()).sort((a, b) => b[1] - a[1])[0];
    if (bestDay) {
      insights.push({
        text: `Melhor dia: ${new Date(bestDay[0]).toLocaleDateString('pt-BR')} com ${bestDay[1]} vendas aprovadas.`,
        type: 'success',
      });
    }
  }

  const colorMap = {
    success: 'bg-primary/10 text-primary border-primary/20',
    warning: 'bg-destructive/10 text-destructive border-destructive/20',
    info: 'bg-accent/10 text-accent border-accent/20',
  };

  return (
    <div className="chart-container">
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="h-5 w-5 text-chart-yellow" />
        <h3 className="dashboard-section-title">Insights</h3>
      </div>
      <div className="grid gap-3">
        {insights.map((insight, i) => (
          <div
            key={i}
            className={`px-4 py-3 rounded-lg border text-sm ${colorMap[insight.type]}`}
          >
            {insight.text}
          </div>
        ))}
      </div>
    </div>
  );
}
