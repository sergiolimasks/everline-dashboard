import { useState } from "react";
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Target, BarChart3, Receipt, Users, CreditCard, MousePointerClick, Eye, Monitor, CheckCircle, ChevronDown, ChevronUp, PlayCircle, MessageCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SparklineTooltip } from "@/components/dashboard/SparklineTooltip";
import type { SummaryData, TrafficDaily } from "@/lib/dashboard-api";

interface KPICardsProps {
  data: SummaryData | undefined;
  isLoading: boolean;
  comparison7d?: SummaryData;
  comparison14d?: SummaryData;
  trafficDaily?: TrafficDaily[];
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function SkeletonBlock() {
  return <div className="h-8 w-24 bg-muted rounded animate-pulse" />;
}

function calcMetrics(data: SummaryData | undefined) {
  if (!data) return null;
  const traffic = data.traffic;
  const sales = data.sales;

  const gastoMeta = Number(traffic?.total_gasto || 0);
  const impostoMeta = gastoMeta * 0.125;
  const totalGasto = gastoMeta + impostoMeta;
  const receitaBruta = Number(sales?.receita_bruta || 0);
  const receitaLiquida = Number(sales?.receita_liquida || 0);
  const vendasAprovadas = Number(sales?.vendas_aprovadas || 0);
  const vendasBump = Number(sales?.vendas_bump || 0);
  const totalCliques = Number(traffic?.total_cliques || 0);
  const totalImpressoes = Number(traffic?.total_impressoes || 0);
  const totalCheckouts = Number(traffic?.total_checkouts || 0);
  const totalViews = Number(traffic?.total_views || 0);
  const totalViews3s = Number(traffic?.total_views_3s || 0);
  const taxaFixa = Number(sales?.taxa_fixa || 0);
  const custoManychat = vendasAprovadas * 0.35;
  const coProdutor = Number(sales?.co_produtor || 0);
  const taxaGreen = Number(sales?.taxa_green || 0);
  const diasAtivos = Number(traffic?.dias_ativos || 1);

  const lucro = receitaLiquida - totalGasto - taxaFixa - custoManychat;
  const custoTotal = totalGasto + taxaFixa + custoManychat;
  const roi = custoTotal > 0 ? receitaLiquida / custoTotal : 0;
  const cac = vendasAprovadas > 0 ? (totalGasto + taxaFixa + custoManychat + coProdutor + taxaGreen) / vendasAprovadas : 0;
  const cpc = totalCliques > 0 ? totalGasto / totalCliques : 0;
  const ctr = totalImpressoes > 0 ? totalCliques / totalImpressoes : 0;
  const cpm = totalImpressoes > 0 ? (totalGasto / totalImpressoes) * 1000 : 0;
  const taxaCarregamento = totalCliques > 0 ? totalViews / totalCliques : 0;
  const taxaConversaoPagina = totalViews > 0 ? totalCheckouts / totalViews : 0;
  const taxaConversaoCheckout = totalCheckouts > 0 ? vendasAprovadas / totalCheckouts : 0;
  const thumbStopRate = totalImpressoes > 0 ? totalViews3s / totalImpressoes : 0;
  const receitaPorVenda = vendasAprovadas > 0 ? receitaBruta / vendasAprovadas : 0;

  const vendasAprovDia = vendasAprovadas / diasAtivos;
  const vendasBumpDia = vendasBump / diasAtivos;

  return {
    gastoMeta, impostoMeta, totalGasto, receitaBruta, receitaLiquida, vendasAprovadas, vendasBump,
    taxaFixa, custoManychat, coProdutor, taxaGreen, lucro, roi, diasAtivos,
    cac, cpc, ctr, cpm, taxaCarregamento, taxaConversaoPagina, taxaConversaoCheckout,
    thumbStopRate, receitaPorVenda, vendasAprovDia, vendasBumpDia,
  };
}

function ComparisonTag({ current, previous, label, invertColor = false }: { 
  current: number; previous: number; label: string; invertColor?: boolean;
}) {
  if (previous === 0 && current === 0) return <span className="text-[10px] text-muted-foreground opacity-50">{label}: --</span>;
  const change = previous !== 0 ? ((current - previous) / Math.abs(previous)) * 100 : (current > 0 ? 100 : 0);
  const isUp = change >= 0;
  const isGood = invertColor ? !isUp : isUp;
  return (
    <div className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${isGood ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
      {isUp ? <TrendingUp className="h-2.5 w-2.5 shrink-0" /> : <TrendingDown className="h-2.5 w-2.5 shrink-0" />}
      <span>{change >= 0 ? '+' : ''}{change.toFixed(1)}%</span>
    </div>
  );
}

function ComparisonColumn({ current, previous, label, invertColor = false, formatValue }: {
  current: number; previous: number; label: string; invertColor?: boolean; formatValue?: (v: number) => string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[9px] text-muted-foreground font-medium">{label}</span>
      <ComparisonTag current={current} previous={previous} label={label} invertColor={invertColor} />
      {formatValue && <span className="text-[9px] text-muted-foreground">{formatValue(previous)}</span>}
    </div>
  );
}

function ComparisonRow({ metricKey, current, comp7d, comp14d, invertColor = false, formatValue }: {
  metricKey: string; current: any; comp7d: any; comp14d: any; invertColor?: boolean; formatValue?: (v: number) => string;
}) {
  if (!comp7d || !comp14d) return null;
  const c = current?.[metricKey] ?? 0;
  const v7 = comp7d?.[metricKey] ?? 0;
  const v14 = comp14d?.[metricKey] ?? 0;

  return (
    <div className="flex items-center gap-3 mt-2">
      <ComparisonColumn current={c} previous={v7} label="7d" invertColor={invertColor} formatValue={formatValue} />
      <ComparisonColumn current={c} previous={v14} label="14d" invertColor={invertColor} formatValue={formatValue} />
    </div>
  );
}

function KPICard({
  label, value, icon: Icon, color, isLoading, metricKey, current, comp7d, comp14d, invertComparison = false, inlineComparison = false, formatValue,
  tooltipContent,
}: {
  label: string; value: string | null; icon: any; color: string; isLoading: boolean;
  metricKey: string; current: any; comp7d: any; comp14d: any; invertComparison?: boolean; inlineComparison?: boolean;
  formatValue?: (v: number) => string;
  tooltipContent?: React.ReactNode;
}) {
  const cardContent = (
    <div className="kpi-card flex flex-col h-full">
      <div className="flex items-center justify-between mb-1">
        <span className="kpi-label">{label}</span>
        <Icon className={`h-4 w-4 ${color} shrink-0`} />
      </div>
      <div className="flex-1 flex flex-col justify-center">
        {inlineComparison ? (
          <div className="flex items-center gap-3 flex-wrap">
            {value ? <span className={`kpi-value ${color}`}>{value}</span> : <SkeletonBlock />}
            {!isLoading && comp7d && comp14d && (
              <div className="flex items-center gap-3">
                <ComparisonColumn current={current?.[metricKey] ?? 0} previous={comp7d?.[metricKey] ?? 0} label="7d" invertColor={invertComparison} formatValue={formatValue} />
                <ComparisonColumn current={current?.[metricKey] ?? 0} previous={comp14d?.[metricKey] ?? 0} label="14d" invertColor={invertComparison} formatValue={formatValue} />
              </div>
            )}
          </div>
        ) : (
          <>
            {value ? <span className={`kpi-value ${color}`}>{value}</span> : <SkeletonBlock />}
            {!isLoading && comp7d && comp14d && (
              <ComparisonRow metricKey={metricKey} current={current} comp7d={comp7d} comp14d={comp14d} invertColor={invertComparison} formatValue={formatValue} />
            )}
          </>
        )}
      </div>
    </div>
  );

  if (tooltipContent) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>{cardContent}</div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="p-0">
            {tooltipContent}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return cardContent;
}

export function KPICards({ data, isLoading, comparison7d, comparison14d, trafficDaily }: KPICardsProps) {
  const [showDetails, setShowDetails] = useState(false);

  const current = calcMetrics(data);
  const comp7d = calcMetrics(comparison7d);
  const comp14d = calcMetrics(comparison14d);

  const products = data?.products || [];
  const mainProducts = products.filter(p => {
    // Heuristic: order bumps tend to have lower sales count than main product
    const maxSales = Math.max(...products.map(pp => pp.vendas_aprovadas));
    return p.vendas_aprovadas === maxSales;
  });
  const bumpProducts = products.filter(p => !mainProducts.includes(p));

  // Vendas Aprovadas tooltip
  const vendasTooltip = !isLoading && products.length > 0 ? (
    <div className="w-64 p-3">
      <p className="text-xs font-semibold mb-2 text-foreground">Produtos Vendidos</p>
      <div className="space-y-1.5 text-[11px]">
        {products.map((p) => (
          <div key={p.produto} className="flex justify-between gap-2">
            <span className="text-muted-foreground truncate">{p.produto}</span>
            <span className="font-medium text-foreground shrink-0">{p.vendas_aprovadas} vendas</span>
          </div>
        ))}
        <div className="border-t border-border pt-1.5 flex justify-between font-semibold">
          <span className="text-muted-foreground">Total Aprovadas</span>
          <span className="text-foreground">{current?.vendasAprovadas || 0}</span>
        </div>
      </div>
    </div>
  ) : undefined;

  // Order Bumps tooltip
  const bumpsTooltip = !isLoading && products.length > 0 ? (
    <div className="w-64 p-3">
      <p className="text-xs font-semibold mb-2 text-foreground">Order Bumps</p>
      <div className="space-y-1.5 text-[11px]">
        {bumpProducts.length > 0 ? bumpProducts.map((p) => (
          <div key={p.produto} className="flex justify-between gap-2">
            <span className="text-muted-foreground truncate">{p.produto}</span>
            <span className="font-medium text-foreground shrink-0">{p.vendas_aprovadas} vendas</span>
          </div>
        )) : (
          <span className="text-muted-foreground">Nenhum order bump no período</span>
        )}
        <div className="border-t border-border pt-1.5 flex justify-between font-semibold">
          <span className="text-muted-foreground">Total Bumps</span>
          <span className="text-foreground">{current?.vendasBump || 0}</span>
        </div>
      </div>
    </div>
  ) : undefined;

  // ROI tooltip with formula
  const roiTooltip = !isLoading ? (
    <div className="w-80 p-3">
      <p className="text-xs font-semibold mb-2 text-foreground">Fórmula do ROI</p>
      <div className="space-y-2 text-[11px]">
        <div className="bg-muted/50 rounded-md p-2 text-center font-mono text-xs text-foreground">
          ROI = Receita Líquida ÷ (Investimento + Consultas + ManyChat)
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between"><span className="text-primary">Receita Líquida</span><span className="font-medium text-primary">{formatCurrency(current?.receitaLiquida || 0)}</span></div>
          <div className="flex justify-between"><span className="text-destructive">Investimento</span><span className="font-medium text-destructive">{formatCurrency(current?.totalGasto || 0)}</span></div>
          <div className="flex justify-between"><span className="text-destructive">Custo Consultas</span><span className="font-medium text-destructive">{formatCurrency(current?.taxaFixa || 0)}</span></div>
          <div className="flex justify-between"><span className="text-destructive">ManyChat</span><span className="font-medium text-destructive">{formatCurrency(current?.custoManychat || 0)}</span></div>
          <div className="border-t border-border pt-1.5">
            <div className="flex justify-between font-semibold">
              <span className="text-muted-foreground">Custo Total</span>
              <span className="text-foreground">{formatCurrency((current?.totalGasto || 0) + (current?.taxaFixa || 0) + (current?.custoManychat || 0))}</span>
            </div>
            <div className="flex justify-between font-semibold mt-1">
              <span className="text-muted-foreground">ROI</span>
              <span className={`${(current?.roi || 0) >= 1 ? 'text-primary' : 'text-destructive'}`}>
                {formatCurrency(current?.receitaLiquida || 0)} ÷ {formatCurrency((current?.totalGasto || 0) + (current?.taxaFixa || 0) + (current?.custoManychat || 0))} = {(current?.roi || 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : undefined;

  // Sparkline metric extractors for traffic daily
  const dailyData = trafficDaily || [];

  const sparklineConfigs: Record<string, { metricFn: (d: TrafficDaily) => number; format: (v: number) => string; label: string }> = {
    cpc: {
      metricFn: (d) => d.cliques > 0 ? (d.gasto * 1.125) / d.cliques : 0,
      format: formatCurrency,
      label: "CPC",
    },
    ctr: {
      metricFn: (d) => d.impressoes > 0 ? d.cliques / d.impressoes : 0,
      format: formatPercent,
      label: "CTR",
    },
    cpm: {
      metricFn: (d) => d.impressoes > 0 ? ((d.gasto * 1.125) / d.impressoes) * 1000 : 0,
      format: formatCurrency,
      label: "CPM",
    },
    thumbStopRate: {
      metricFn: (d) => d.impressoes > 0 ? d.views_3s / d.impressoes : 0,
      format: formatPercent,
      label: "Thumb Stop",
    },
    taxaCarregamento: {
      metricFn: (d) => d.cliques > 0 ? d.views_pagina / d.cliques : 0,
      format: formatPercent,
      label: "Tx Carreg. Página",
    },
    taxaConversaoPagina: {
      metricFn: (d) => d.views_pagina > 0 ? d.checkouts / d.views_pagina : 0,
      format: formatPercent,
      label: "Tx Conv. Página",
    },
    taxaConversaoCheckout: {
      metricFn: (d) => d.checkouts > 0 ? d.compras / d.checkouts : 0,
      format: formatPercent,
      label: "Tx Conv. Checkout",
    },
  };

  function getSparkline(key: string) {
    const cfg = sparklineConfigs[key];
    if (!cfg) return undefined;
    return <SparklineTooltip dailyData={dailyData} metricFn={cfg.metricFn} formatValue={cfg.format} label={cfg.label} />;
  }

  return (
    <div className="space-y-4">
      {/* Fixed: Investimento, Vendas, Order Bumps, Lucro, ROI */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPICard
          label="Investimento Total" value={isLoading ? null : formatCurrency(current?.totalGasto || 0)}
          icon={DollarSign} color="text-chart-orange" isLoading={isLoading}
          metricKey="totalGasto" current={current} comp7d={null} comp14d={null}
          tooltipContent={!isLoading ? (
            <div className="w-72 p-3">
              <p className="text-xs font-semibold mb-2 text-foreground">Composição do Investimento</p>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between"><span className="text-muted-foreground">Gasto Meta Ads</span><span className="font-medium text-foreground">{formatCurrency(current?.gastoMeta || 0)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Imposto Meta (12,5%)</span><span className="font-medium text-foreground">{formatCurrency(current?.impostoMeta || 0)}</span></div>
                <div className="border-t border-border pt-1.5 flex justify-between font-semibold">
                  <span className="text-muted-foreground">Investimento Total</span>
                  <span className="text-foreground">{formatCurrency(current?.totalGasto || 0)}</span>
                </div>
              </div>
            </div>
          ) : undefined}
        />
        <KPICard
          label="Vendas Aprovadas" value={isLoading ? null : String(current?.vendasAprovadas || 0)}
          icon={ShoppingCart} color="text-chart-green" isLoading={isLoading}
          metricKey="vendasAprovDia" current={current} comp7d={comp7d} comp14d={comp14d}
          inlineComparison formatValue={(v) => `${v.toFixed(0)}/d`}
          tooltipContent={vendasTooltip}
        />
        <KPICard
          label="Order Bumps" value={isLoading ? null : String(current?.vendasBump || 0)}
          icon={Target} color="text-chart-purple" isLoading={isLoading}
          metricKey="vendasBumpDia" current={current} comp7d={comp7d} comp14d={comp14d}
          inlineComparison formatValue={(v) => `${v.toFixed(0)}/d`}
          tooltipContent={bumpsTooltip}
        />
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <KPICard
                  label="Lucro" value={isLoading ? null : formatCurrency(current?.lucro || 0)}
                  icon={(current?.lucro || 0) >= 0 ? TrendingUp : TrendingDown}
                  color={(current?.lucro || 0) >= 0 ? "kpi-trend-up" : "kpi-trend-down"}
                  isLoading={isLoading}
                  metricKey="lucro" current={current} comp7d={null} comp14d={null}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="w-72 p-3">
              <p className="text-xs font-semibold mb-2 text-foreground">Composição do Lucro</p>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between"><span className="text-primary">Receita Líquida</span><span className="font-medium text-primary">+ {formatCurrency(current?.receitaLiquida || 0)}</span></div>
                <div className="flex justify-between"><span className="text-destructive">Investimento</span><span className="font-medium text-destructive">- {formatCurrency(current?.totalGasto || 0)}</span></div>
                <div className="flex justify-between"><span className="text-destructive">Custo Consultas</span><span className="font-medium text-destructive">- {formatCurrency(current?.taxaFixa || 0)}</span></div>
                <div className="flex justify-between"><span className="text-destructive">ManyChat</span><span className="font-medium text-destructive">- {formatCurrency(current?.custoManychat || 0)}</span></div>
                <div className="border-t border-border pt-1.5 flex justify-between font-semibold">
                  <span className="text-muted-foreground">Lucro</span>
                  <span className={`${(current?.lucro || 0) >= 0 ? 'text-primary' : 'text-destructive'}`}>{formatCurrency(current?.lucro || 0)}</span>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <KPICard
          label="ROI" value={isLoading ? null : (current?.roi || 0).toFixed(2)}
          icon={BarChart3}
          color={(current?.roi || 0) >= 1 ? "kpi-trend-up" : "kpi-trend-down"}
          isLoading={isLoading}
          metricKey="roi" current={current} comp7d={comp7d} comp14d={comp14d}
          inlineComparison
          tooltipContent={roiTooltip}
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <KPICard
                  label="CAC" value={isLoading ? null : formatCurrency(current?.cac || 0)}
                  icon={Target} color="text-chart-blue" isLoading={isLoading}
                  metricKey="cac" current={current} comp7d={comp7d} comp14d={comp14d}
                  formatValue={formatCurrency} invertComparison
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="w-72 p-3">
              <p className="text-xs font-semibold mb-2 text-foreground">Composição do CAC</p>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between"><span className="text-muted-foreground">Investimento em Tráfego</span><span className="font-medium text-foreground">{formatCurrency((current?.vendasAprovadas || 0) > 0 ? (current?.totalGasto || 0) / current.vendasAprovadas : 0)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Custo das Consultas</span><span className="font-medium text-foreground">{formatCurrency((current?.vendasAprovadas || 0) > 0 ? (current?.taxaFixa || 0) / current.vendasAprovadas : 0)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">ManyChat</span><span className="font-medium text-foreground">{formatCurrency((current?.vendasAprovadas || 0) > 0 ? (current?.custoManychat || 0) / current.vendasAprovadas : 0)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Taxa Co-Produtor</span><span className="font-medium text-foreground">{formatCurrency((current?.vendasAprovadas || 0) > 0 ? (current?.coProdutor || 0) / current.vendasAprovadas : 0)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Taxa Greenn</span><span className="font-medium text-foreground">{formatCurrency((current?.vendasAprovadas || 0) > 0 ? (current?.taxaGreen || 0) / current.vendasAprovadas : 0)}</span></div>
                <div className="border-t border-border pt-1.5 flex justify-between font-semibold">
                  <span className="text-muted-foreground">CAC Total</span>
                  <span className="text-foreground">{formatCurrency(current?.cac || 0)}</span>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <KPICard
                  label="Receita/Venda" value={isLoading ? null : formatCurrency(current?.receitaPorVenda || 0)}
                  icon={DollarSign} color="text-chart-green" isLoading={isLoading}
                  metricKey="receitaPorVenda" current={current} comp7d={comp7d} comp14d={comp14d}
                  formatValue={formatCurrency}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="w-80 p-3">
              <p className="text-xs font-semibold mb-1 text-foreground">Contribuição por Produto na Receita/Venda</p>
              <p className="text-[10px] text-muted-foreground mb-2">Receita de cada produto ÷ vendas do produto principal</p>
              <div className="space-y-1.5 text-[11px]">
                {(() => {
                  const vendasPrincipal = current?.vendasAprovadas || 0;
                  return products.map((p) => {
                    const contribuicao = vendasPrincipal > 0 ? p.receita_bruta / vendasPrincipal : 0;
                    return (
                      <div key={p.produto} className="flex justify-between gap-2">
                        <span className="text-muted-foreground truncate">{p.produto}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-muted-foreground/60">{p.vendas_aprovadas}v</span>
                          <span className="font-medium text-foreground">{formatCurrency(contribuicao)}</span>
                        </div>
                      </div>
                    );
                  });
                })()}
                {products.length === 0 && (
                  <span className="text-muted-foreground">Sem dados de produtos</span>
                )}
                <div className="border-t border-border pt-1.5 flex justify-between font-semibold">
                  <span className="text-muted-foreground">Receita/Venda Total</span>
                  <span className="text-foreground">{formatCurrency(current?.receitaPorVenda || 0)}</span>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <KPICard
          label="CPC" value={isLoading ? null : formatCurrency(current?.cpc || 0)}
          icon={MousePointerClick} color="text-chart-purple" isLoading={isLoading}
          metricKey="cpc" current={current} comp7d={comp7d} comp14d={comp14d}
          formatValue={formatCurrency} invertComparison
          tooltipContent={getSparkline("cpc")}
        />
        <KPICard
          label="CTR" value={isLoading ? null : formatPercent(current?.ctr || 0)}
          icon={MousePointerClick} color="text-chart-orange" isLoading={isLoading}
          metricKey="ctr" current={current} comp7d={comp7d} comp14d={comp14d}
          formatValue={formatPercent}
          tooltipContent={getSparkline("ctr")}
        />
        <KPICard
          label="CPM" value={isLoading ? null : formatCurrency(current?.cpm || 0)}
          icon={Eye} color="text-chart-yellow" isLoading={isLoading}
          metricKey="cpm" current={current} comp7d={comp7d} comp14d={comp14d} invertComparison
          formatValue={formatCurrency}
          tooltipContent={getSparkline("cpm")}
        />
        <KPICard
          label="Thumb Stop" value={isLoading ? null : formatPercent(current?.thumbStopRate || 0)}
          icon={PlayCircle} color="text-chart-red" isLoading={isLoading}
          metricKey="thumbStopRate" current={current} comp7d={comp7d} comp14d={comp14d}
          formatValue={formatPercent}
          tooltipContent={getSparkline("thumbStopRate")}
        />
        <KPICard
          label="Tx Carreg. Página" value={isLoading ? null : formatPercent(current?.taxaCarregamento || 0)}
          icon={Monitor} color="text-chart-green" isLoading={isLoading}
          metricKey="taxaCarregamento" current={current} comp7d={comp7d} comp14d={comp14d}
          formatValue={formatPercent}
          tooltipContent={getSparkline("taxaCarregamento")}
        />
        <KPICard
          label="Tx Conv. Página" value={isLoading ? null : formatPercent(current?.taxaConversaoPagina || 0)}
          icon={CheckCircle} color="text-chart-blue" isLoading={isLoading}
          metricKey="taxaConversaoPagina" current={current} comp7d={comp7d} comp14d={comp14d}
          formatValue={formatPercent}
          tooltipContent={getSparkline("taxaConversaoPagina")}
        />
        <KPICard
          label="Tx Conv. Checkout" value={isLoading ? null : formatPercent(current?.taxaConversaoCheckout || 0)}
          icon={ShoppingCart} color="text-primary" isLoading={isLoading}
          metricKey="taxaConversaoCheckout" current={current} comp7d={comp7d} comp14d={comp14d}
          formatValue={formatPercent}
          tooltipContent={getSparkline("taxaConversaoCheckout")}
        />
      </div>
    </div>
  );
}
