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
  const taxaFixa = Number(summary.sales?.taxa_fixa || 0);
  const coProdutor = Number(summary.sales?.co_produtor || 0);
  const taxaGreen = Number(summary.sales?.taxa_green || 0);
  const receitaBruta = Number(summary.sales?.receita_bruta || 0);
  const lucro = receitaLiquida - totalGasto - taxaFixa;
  const custoTotal = totalGasto + taxaFixa;
  const roi = custoTotal > 0 ? receitaLiquida / custoTotal : 0;
  const cac = vendasAprovadas > 0 ? (totalGasto + taxaFixa + coProdutor + taxaGreen) / vendasAprovadas : 0;

  if (roi >= 1) {
    insights.push({ text: `ROI positivo de ${roi.toFixed(2)}. Para cada R$1 investido, retornam R$${roi.toFixed(2)}.`, type: 'success' });
  } else {
    insights.push({ text: `ROI negativo de ${roi.toFixed(2)}. Operação no prejuízo de ${formatCurrency(Math.abs(lucro))}.`, type: 'warning' });
  }

  if (cac > 0) {
    insights.push({ text: `CAC atual: ${formatCurrency(cac)}. Cada cliente custa isso para adquirir.`, type: 'info' });
  }

  if (taxaFixa > 0) {
    insights.push({ text: `Taxa fixa total: ${formatCurrency(taxaFixa)} (R$18 × ${vendasAprovadas} vendas do produto principal).`, type: 'info' });
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

  if (salesDaily && salesDaily.length > 0) {
    const bestDay = [...salesDaily].sort((a, b) => Number(b.vendas_aprovadas) - Number(a.vendas_aprovadas))[0];
    if (bestDay) {
      insights.push({
        text: `Melhor dia: ${new Date(bestDay.dia).toLocaleDateString('pt-BR')} com ${bestDay.vendas_aprovadas} vendas aprovadas.`,
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
