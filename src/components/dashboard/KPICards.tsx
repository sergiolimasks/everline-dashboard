import { TrendingUp, TrendingDown, DollarSign, MousePointerClick, Eye, ShoppingCart, Target, BarChart3, Receipt, Users, CreditCard } from "lucide-react";
import type { SummaryData } from "@/lib/dashboard-api";

interface KPICardsProps {
  data: SummaryData | undefined;
  isLoading: boolean;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatNumber(value: number) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString('pt-BR');
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function Skeleton() {
  return <div className="h-8 w-24 bg-muted rounded animate-pulse-glow" />;
}

export function KPICards({ data, isLoading }: KPICardsProps) {
  const traffic = data?.traffic;
  const sales = data?.sales;

  const totalGasto = Number(traffic?.total_gasto || 0);
  const receitaBruta = Number(sales?.receita_bruta || 0);
  const receitaLiquida = Number(sales?.receita_liquida || 0);
  const vendasAprovadas = Number(sales?.vendas_aprovadas || 0);
  const totalCliques = Number(traffic?.total_cliques || 0);
  const totalImpressoes = Number(traffic?.total_impressoes || 0);
  const totalCheckouts = Number(traffic?.total_checkouts || 0);
  const taxaFixa = Number(sales?.taxa_fixa || 0);
  const coProdutor = Number(sales?.co_produtor || 0);
  const taxaGreen = Number(sales?.taxa_green || 0);

  const lucro = receitaLiquida - taxaFixa;
  const roi = totalGasto > 0 ? ((receitaLiquida - totalGasto - taxaFixa) / totalGasto) : 0;
  const cac = vendasAprovadas > 0 ? (totalGasto + taxaFixa + coProdutor + taxaGreen) / vendasAprovadas : 0;
  const ctr = totalImpressoes > 0 ? totalCliques / totalImpressoes : 0;
  const taxaConversao = totalCheckouts > 0 ? vendasAprovadas / totalCheckouts : 0;

  const kpis = [
    {
      label: "Investimento Total",
      value: isLoading ? null : formatCurrency(totalGasto),
      icon: DollarSign,
      color: "text-chart-orange",
    },
    {
      label: "Faturamento",
      value: isLoading ? null : formatCurrency(receitaBruta),
      icon: TrendingUp,
      color: "text-primary",
    },
    {
      label: "Custo das Consultas Estimado",
      value: isLoading ? null : formatCurrency(taxaFixa),
      icon: Receipt,
      color: "text-chart-purple",
    },
    {
      label: "Co-Produtor",
      value: isLoading ? null : formatCurrency(coProdutor),
      icon: Users,
      color: "text-chart-blue",
    },
    {
      label: "Taxa Greenn",
      value: isLoading ? null : formatCurrency(taxaGreen),
      icon: CreditCard,
      color: "text-chart-yellow",
    },
    {
      label: "Lucro",
      value: isLoading ? null : formatCurrency(lucro),
      icon: lucro >= 0 ? TrendingUp : TrendingDown,
      color: lucro >= 0 ? "kpi-trend-up" : "kpi-trend-down",
    },
    {
      label: "ROI",
      value: isLoading ? null : `${(roi * 100).toFixed(1)}%`,
      icon: BarChart3,
      color: roi >= 0 ? "kpi-trend-up" : "kpi-trend-down",
    },
    {
      label: "CAC",
      value: isLoading ? null : formatCurrency(cac),
      icon: Target,
      color: "text-chart-blue",
    },
    {
      label: "Vendas Aprovadas",
      value: isLoading ? null : formatNumber(vendasAprovadas),
      icon: ShoppingCart,
      color: "text-primary",
    },
    {
      label: "CTR",
      value: isLoading ? null : formatPercent(ctr),
      icon: MousePointerClick,
      color: "text-chart-purple",
    },
    {
      label: "Taxa Conversão",
      value: isLoading ? null : formatPercent(taxaConversao),
      icon: Eye,
      color: "text-chart-yellow",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="kpi-card">
          <div className="flex items-center justify-between mb-3">
            <span className="kpi-label">{kpi.label}</span>
            <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
          </div>
          {kpi.value ? (
            <span className={`kpi-value ${kpi.color}`}>{kpi.value}</span>
          ) : (
            <Skeleton />
          )}
        </div>
      ))}
    </div>
  );
}
