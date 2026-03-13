import { useState } from "react";
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Target, BarChart3, Receipt, Users, CreditCard, MousePointerClick, Eye, Monitor, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import type { SummaryData } from "@/lib/dashboard-api";

interface KPICardsProps {
  data: SummaryData | undefined;
  isLoading: boolean;
  comparison7d?: SummaryData;
  comparison14d?: SummaryData;
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
  return <div className="h-8 w-24 bg-muted rounded animate-pulse" />;
}

function calcMetrics(data: SummaryData | undefined) {
  if (!data) return null;
  const traffic = data.traffic;
  const sales = data.sales;

  const totalGasto = Number(traffic?.total_gasto || 0);
  const receitaBruta = Number(sales?.receita_bruta || 0);
  const receitaLiquida = Number(sales?.receita_liquida || 0);
  const vendasAprovadas = Number(sales?.vendas_aprovadas || 0);
  const totalCliques = Number(traffic?.total_cliques || 0);
  const totalImpressoes = Number(traffic?.total_impressoes || 0);
  const totalCheckouts = Number(traffic?.total_checkouts || 0);
  const totalViews = Number(traffic?.total_views || 0);
  const totalComprasMeta = Number(traffic?.total_compras_meta || 0);
  const taxaFixa = Number(sales?.taxa_fixa || 0);
  const coProdutor = Number(sales?.co_produtor || 0);
  const taxaGreen = Number(sales?.taxa_green || 0);

  const lucro = receitaLiquida - taxaFixa;
  const roi = totalGasto > 0 ? receitaBruta / totalGasto : 0;
  const cac = vendasAprovadas > 0 ? (totalGasto + taxaFixa + coProdutor + taxaGreen) / vendasAprovadas : 0;
  const cpc = totalCliques > 0 ? totalGasto / totalCliques : 0;
  const ctr = totalImpressoes > 0 ? totalCliques / totalImpressoes : 0;
  const cpm = totalImpressoes > 0 ? (totalGasto / totalImpressoes) * 1000 : 0;
  const taxaCarregamento = totalCliques > 0 ? totalViews / totalCliques : 0;
  const taxaConversaoPagina = totalViews > 0 ? totalCheckouts / totalViews : 0;
  // Taxa conversão checkout: vendas Greenn / checkouts Meta
  const taxaConversaoCheckout = totalCheckouts > 0 ? vendasAprovadas / totalCheckouts : 0;

  return {
    totalGasto, receitaBruta, receitaLiquida, vendasAprovadas,
    taxaFixa, coProdutor, taxaGreen, lucro, roi,
    cac, cpc, ctr, cpm, taxaCarregamento, taxaConversaoPagina, taxaConversaoCheckout,
  };
}

function ComparisonTag({ current, previous, label, invertColor = false }: { current: number; previous: number; label: string; invertColor?: boolean }) {
  if (previous === 0 && current === 0) return <span className="text-[10px] text-muted-foreground">{label}: --</span>;
  const change = previous !== 0 ? ((current - previous) / Math.abs(previous)) * 100 : (current > 0 ? 100 : 0);
  const isUp = change >= 0;
  const isGood = invertColor ? !isUp : isUp;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${isGood ? 'text-primary' : 'text-destructive'}`}>
      {isUp ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
      {label}: {change >= 0 ? '+' : ''}{change.toFixed(1)}%
    </span>
  );
}

function KPICard({
  label, value, icon: Icon, color, isLoading, metricKey, current, comp7d, comp14d, invertComparison = false, inlineComparison = false,
}: {
  label: string; value: string | null; icon: any; color: string; isLoading: boolean;
  metricKey: string; current: any; comp7d: any; comp14d: any; invertComparison?: boolean; inlineComparison?: boolean;
}) {
  const c = current?.[metricKey] ?? 0;
  const v7 = comp7d?.[metricKey] ?? 0;
  const v14 = comp14d?.[metricKey] ?? 0;

  const tags = !isLoading && comp7d && comp14d ? (
    <div className="flex items-center gap-2">
      <ComparisonTag current={c} previous={v7} label="7d" invertColor={invertComparison} />
      <ComparisonTag current={c} previous={v14} label="14d" invertColor={invertComparison} />
    </div>
  ) : null;

  return (
    <div className="kpi-card">
      <div className="flex items-center justify-between mb-1">
        <span className="kpi-label">{label}</span>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      {inlineComparison ? (
        <div className="flex items-center gap-3">
          {value ? <span className={`kpi-value ${color}`}>{value}</span> : <Skeleton />}
          {tags}
        </div>
      ) : (
        <>
          {value ? <span className={`kpi-value ${color}`}>{value}</span> : <Skeleton />}
          {tags && <div className="mt-1.5">{tags}</div>}
        </>
      )}
    </div>
  );
}

export function KPICards({ data, isLoading, comparison7d, comparison14d }: KPICardsProps) {
  const [showDetails, setShowDetails] = useState(false);

  const current = calcMetrics(data);
  const comp7d = calcMetrics(comparison7d);
  const comp14d = calcMetrics(comparison14d);

  return (
    <div className="space-y-4">
      {/* Fixed: Investimento, Lucro, ROI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          label="Investimento Total" value={isLoading ? null : formatCurrency(current?.totalGasto || 0)}
          icon={DollarSign} color="text-chart-orange" isLoading={isLoading}
          metricKey="totalGasto" current={current} comp7d={null} comp14d={null}
        />
        <KPICard
          label="Lucro" value={isLoading ? null : formatCurrency(current?.lucro || 0)}
          icon={(current?.lucro || 0) >= 0 ? TrendingUp : TrendingDown}
          color={(current?.lucro || 0) >= 0 ? "kpi-trend-up" : "kpi-trend-down"}
          isLoading={isLoading}
          metricKey="lucro" current={current} comp7d={null} comp14d={null}
        />
        <KPICard
          label="ROI" value={isLoading ? null : (current?.roi || 0).toFixed(2)}
          icon={BarChart3}
          color={(current?.roi || 0) >= 0 ? "kpi-trend-up" : "kpi-trend-down"}
          isLoading={isLoading}
          metricKey="roi" current={current} comp7d={comp7d} comp14d={comp14d}
          inlineComparison
        />
      </div>

      {/* Toggle for financial details */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border border-border bg-card text-secondary-foreground hover:border-primary/50 hover:text-primary transition-colors"
      >
        {showDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {showDetails ? "Ocultar detalhes financeiros" : "Ver detalhes financeiros"}
      </button>

      {showDetails && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            label="Faturamento" value={isLoading ? null : formatCurrency(current?.receitaBruta || 0)}
            icon={TrendingUp} color="text-primary" isLoading={isLoading}
            metricKey="receitaBruta" current={current} comp7d={null} comp14d={null}
          />
          <KPICard
            label="Custo Consultas Estimado" value={isLoading ? null : formatCurrency(current?.taxaFixa || 0)}
            icon={Receipt} color="text-chart-purple" isLoading={isLoading}
            metricKey="taxaFixa" current={current} comp7d={null} comp14d={null}
          />
          <KPICard
            label="Co-Produtor" value={isLoading ? null : formatCurrency(current?.coProdutor || 0)}
            icon={Users} color="text-chart-blue" isLoading={isLoading}
            metricKey="coProdutor" current={current} comp7d={null} comp14d={null}
          />
          <KPICard
            label="Taxa Greenn" value={isLoading ? null : formatCurrency(current?.taxaGreen || 0)}
            icon={CreditCard} color="text-chart-yellow" isLoading={isLoading}
            metricKey="taxaGreen" current={current} comp7d={null} comp14d={null}
          />
        </div>
      )}

      {/* Fixed metrics row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <KPICard
          label="CAC" value={isLoading ? null : formatCurrency(current?.cac || 0)}
          icon={Target} color="text-chart-blue" isLoading={isLoading}
          metricKey="cac" current={current} comp7d={comp7d} comp14d={comp14d}
        />
        <KPICard
          label="CPC" value={isLoading ? null : formatCurrency(current?.cpc || 0)}
          icon={MousePointerClick} color="text-chart-purple" isLoading={isLoading}
          metricKey="cpc" current={current} comp7d={comp7d} comp14d={comp14d}
        />
        <KPICard
          label="CTR" value={isLoading ? null : formatPercent(current?.ctr || 0)}
          icon={MousePointerClick} color="text-chart-orange" isLoading={isLoading}
          metricKey="ctr" current={current} comp7d={comp7d} comp14d={comp14d}
        />
        <KPICard
          label="CPM" value={isLoading ? null : formatCurrency(current?.cpm || 0)}
          icon={Eye} color="text-chart-yellow" isLoading={isLoading}
          metricKey="cpm" current={current} comp7d={comp7d} comp14d={comp14d} invertComparison
        />
        <KPICard
          label="Tx Carreg. Página" value={isLoading ? null : formatPercent(current?.taxaCarregamento || 0)}
          icon={Monitor} color="text-chart-green" isLoading={isLoading}
          metricKey="taxaCarregamento" current={current} comp7d={comp7d} comp14d={comp14d}
        />
        <KPICard
          label="Tx Conv. Página" value={isLoading ? null : formatPercent(current?.taxaConversaoPagina || 0)}
          icon={CheckCircle} color="text-chart-blue" isLoading={isLoading}
          metricKey="taxaConversaoPagina" current={current} comp7d={comp7d} comp14d={comp14d}
        />
        <KPICard
          label="Tx Conv. Checkout" value={isLoading ? null : formatPercent(current?.taxaConversaoCheckout || 0)}
          icon={ShoppingCart} color="text-primary" isLoading={isLoading}
          metricKey="taxaConversaoCheckout" current={current} comp7d={comp7d} comp14d={comp14d}
        />
      </div>
    </div>
  );
}
