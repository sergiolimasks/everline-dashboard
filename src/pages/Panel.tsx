import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useSummary } from "@/hooks/use-dashboard";
import { usePageScroll, usePageState } from "@/hooks/use-page-state";
import { formatDateString, formatDayMonth, getWeekStart, parseDateStringLocal } from "@/lib/date-utils";
import { BarChart3, LogOut, ExternalLink, Target, DollarSign, ShoppingCart, Wallet, PiggyBank, Building2, Eye, EyeOff, Calendar as CalendarIcon } from "lucide-react";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { CreateUserTab } from "@/components/admin/CreateUserTab";
import { AssignAccessTab } from "@/components/admin/AssignAccessTab";
import { UnpaidAccountsTable } from "@/components/panel/UnpaidAccountsTable";

interface ClientWithOffers {
  id: string;
  name: string;
  slug: string;
  offers: { offer_slug: string; label: string }[];
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function GastoTooltip({ gastoMeta, imposto, custoConsultas, custoManychat, gastoTotal }: {
  gastoMeta: number; imposto: number; custoConsultas: number; custoManychat: number; gastoTotal: number;
}) {
  return (
    <div className="space-y-1.5 text-xs">
      <p className="font-semibold text-foreground mb-2">Composição do Gasto Total</p>
      <div className="flex justify-between"><span className="text-muted-foreground">Gasto Meta Ads</span><span className="text-foreground font-medium">{formatCurrency(gastoMeta)}</span></div>
      <div className="flex justify-between"><span className="text-muted-foreground">Imposto (12,5%)</span><span className="text-foreground font-medium">{formatCurrency(imposto)}</span></div>
      <div className="flex justify-between"><span className="text-muted-foreground">Custo Consultas (R$18/venda)</span><span className="text-foreground font-medium">{formatCurrency(custoConsultas)}</span></div>
      <div className="flex justify-between"><span className="text-muted-foreground">ManyChat (R$0,35/venda)</span><span className="text-foreground font-medium">{formatCurrency(custoManychat)}</span></div>
      <div className="border-t border-border pt-1.5 flex justify-between font-semibold"><span className="text-foreground">Total</span><span className="text-foreground">{formatCurrency(gastoTotal)}</span></div>
    </div>
  );
}

function VendasTooltip({ products }: { products: { produto: string; vendas_aprovadas: number }[] }) {
  const total = products.reduce((s, p) => s + p.vendas_aprovadas, 0);
  return (
    <div className="space-y-1.5 text-xs">
      <p className="font-semibold text-foreground mb-2">Vendas por Produto</p>
      {products.length === 0 && <p className="text-muted-foreground">Sem dados de produtos</p>}
      {products.map((p) => (
        <div key={p.produto} className="flex justify-between gap-4">
          <span className="text-muted-foreground truncate">{p.produto}</span>
          <span className="text-foreground font-medium shrink-0">{p.vendas_aprovadas}</span>
        </div>
      ))}
      {products.length > 0 && (
        <div className="border-t border-border pt-1.5 flex justify-between font-semibold">
          <span className="text-foreground">Total</span><span className="text-foreground">{total}</span>
        </div>
      )}
    </div>
  );
}

function LucroTooltip({ faturamentoCliente, gastoMeta, imposto, custoConsultas, custoManychat, lucro }: {
  faturamentoCliente: number; gastoMeta: number; imposto: number; custoConsultas: number; custoManychat: number; lucro: number;
}) {
  return (
    <div className="space-y-1.5 text-xs">
      <p className="font-semibold text-foreground mb-2">Composição do Lucro do Cliente</p>
      <div className="flex justify-between"><span className="text-muted-foreground">Faturamento do Cliente</span><span className="text-emerald-400 font-medium">+ {formatCurrency(faturamentoCliente)}</span></div>
      <div className="flex justify-between"><span className="text-muted-foreground">Gasto Meta Ads</span><span className="text-red-400 font-medium">- {formatCurrency(gastoMeta)}</span></div>
      <div className="flex justify-between"><span className="text-muted-foreground">Imposto (12,5%)</span><span className="text-red-400 font-medium">- {formatCurrency(imposto)}</span></div>
      <div className="flex justify-between"><span className="text-muted-foreground">Custo Consultas</span><span className="text-red-400 font-medium">- {formatCurrency(custoConsultas)}</span></div>
      <div className="flex justify-between"><span className="text-muted-foreground">ManyChat</span><span className="text-red-400 font-medium">- {formatCurrency(custoManychat)}</span></div>
      <div className="border-t border-border pt-1.5 flex justify-between font-semibold">
        <span className="text-foreground">Lucro do Cliente</span>
        <span className={lucro >= 0 ? "text-emerald-400" : "text-red-400"}>{formatCurrency(lucro)}</span>
      </div>
    </div>
  );
}

function CacTooltip({ gastoMeta, imposto, custoConsultas, custoManychat, gastoTotal, vendasAprovadas, cac }: {
  gastoMeta: number; imposto: number; custoConsultas: number; custoManychat: number; gastoTotal: number; vendasAprovadas: number; cac: number;
}) {
  const pctMeta = gastoTotal > 0 ? (gastoMeta / gastoTotal) * 100 : 0;
  const pctImposto = gastoTotal > 0 ? (imposto / gastoTotal) * 100 : 0;
  const pctConsultas = gastoTotal > 0 ? (custoConsultas / gastoTotal) * 100 : 0;
  const pctManychat = gastoTotal > 0 ? (custoManychat / gastoTotal) * 100 : 0;
  return (
    <div className="space-y-1.5 text-xs">
      <p className="font-semibold text-foreground mb-2">Composição do CAC</p>
      <div className="flex justify-between"><span className="text-muted-foreground">Meta Ads ({pctMeta.toFixed(1)}%)</span><span className="text-foreground font-medium">{formatCurrency(vendasAprovadas > 0 ? gastoMeta / vendasAprovadas : 0)}</span></div>
      <div className="flex justify-between"><span className="text-muted-foreground">Imposto ({pctImposto.toFixed(1)}%)</span><span className="text-foreground font-medium">{formatCurrency(vendasAprovadas > 0 ? imposto / vendasAprovadas : 0)}</span></div>
      <div className="flex justify-between"><span className="text-muted-foreground">Consultas ({pctConsultas.toFixed(1)}%)</span><span className="text-foreground font-medium">{formatCurrency(vendasAprovadas > 0 ? custoConsultas / vendasAprovadas : 0)}</span></div>
      <div className="flex justify-between"><span className="text-muted-foreground">ManyChat ({pctManychat.toFixed(1)}%)</span><span className="text-foreground font-medium">{formatCurrency(vendasAprovadas > 0 ? custoManychat / vendasAprovadas : 0)}</span></div>
      <div className="border-t border-border pt-1.5 flex justify-between font-semibold"><span className="text-foreground">CAC Total ({vendasAprovadas} vendas)</span><span className="text-foreground">{formatCurrency(cac)}</span></div>
    </div>
  );
}

function ClientCard({ client, isAdmin, isGestor, clientView, dateFrom, dateTo, dateLabel }: { client: ClientWithOffers; isAdmin: boolean; isGestor?: boolean; clientView?: boolean; dateFrom: string; dateTo: string; dateLabel: string }) {
  // Check if this client card has any sales-related dashboards (checkup/formacao)
  const salesSlugs = ['checkup-performance', 'formacao-consultor'];
  const hasSalesDashboards = client.offers.some(o => salesSlugs.includes(o.offer_slug) || (!['sistema-leads', 'distribuicao'].includes(o.offer_slug)));
  
  // Fetch per-project summaries to apply correct cost formulas
  const hasCheckup = client.offers.some(o => o.offer_slug !== 'formacao-consultor');
  const hasFormacao = client.offers.some(o => o.offer_slug === 'formacao-consultor');
  
  const { data: summaryCheckup, isLoading: loadingCheckup } = useSummary(dateFrom, dateTo, "all_no_filter", "checkup");
  const { data: summaryFormacao, isLoading: loadingFormacao } = useSummary(dateFrom, dateTo, "all_no_filter", "formacao-consultor");
  
  const isLoading = loadingCheckup || loadingFormacao;

  // Checkup metrics (has consultas + manychat costs)
  const ckGasto = Number(summaryCheckup?.traffic?.total_gasto || 0);
  const ckImposto = ckGasto * 0.125;
  const ckVendas = Number(summaryCheckup?.sales?.vendas_aprovadas || 0);
  const ckConsultas = Number(summaryCheckup?.sales?.taxa_fixa || 0);
  const ckManychat = ckVendas * 0.35;
  const ckReceitaLiquida = Number(summaryCheckup?.sales?.receita_liquida || 0);
  const ckCoProdutor = Number(summaryCheckup?.sales?.co_produtor || 0);
  const ckGastoTotal = ckGasto + ckImposto + ckConsultas + ckManychat;
  const ckLucro = ckReceitaLiquida - ckGastoTotal;

  // Formação metrics (no consultas, no manychat)
  const fmGasto = Number(summaryFormacao?.traffic?.total_gasto || 0);
  const fmImposto = fmGasto * 0.125;
  const fmVendas = Number(summaryFormacao?.sales?.vendas_aprovadas || 0);
  const fmReceitaLiquida = Number(summaryFormacao?.sales?.receita_liquida || 0);
  const fmCoProdutor = Number(summaryFormacao?.sales?.co_produtor || 0);
  const fmTaxaTmb = Number(summaryFormacao?.sales?.taxa_green || 0); // taxa_tmb from TMB gateway
  const fmGastoTotal = fmGasto + fmImposto;
  const fmLucro = fmReceitaLiquida - fmGastoTotal;

  // Combined totals
  const gastoMeta = ckGasto + fmGasto;
  const imposto = ckImposto + fmImposto;
  const vendasAprovadas = ckVendas + fmVendas;
  const custoConsultas = ckConsultas;
  const custoManychat = ckManychat;
  const gastoTotal = ckGastoTotal + fmGastoTotal;
  const receitaLiquida = ckReceitaLiquida + fmReceitaLiquida;
  const coProdutor = ckCoProdutor + fmCoProdutor;
  const faturamentoAgencia = coProdutor;
  const faturamentoCliente = receitaLiquida;
  const lucroCliente = ckLucro + fmLucro;
  const cac = vendasAprovadas > 0 ? gastoTotal / vendasAprovadas : 0;
  const products = [...(summaryCheckup?.products || []), ...(summaryFormacao?.products || [])];

  const kpis = [
    {
      label: `Investimento (${dateLabel})`, value: formatCurrency(gastoTotal), icon: Wallet, color: "text-red-400",
      tooltip: <GastoTooltip gastoMeta={gastoMeta} imposto={imposto} custoConsultas={custoConsultas} custoManychat={custoManychat} gastoTotal={gastoTotal} />,
    },
    {
      label: `Vendas (${dateLabel})`, value: isLoading ? "..." : String(vendasAprovadas), icon: ShoppingCart, color: "text-blue-400",
      tooltip: <VendasTooltip products={products} />,
    },
    {
      label: "Faturamento do Cliente", value: formatCurrency(faturamentoCliente), icon: DollarSign, color: "text-emerald-400",
      tooltip: null,
    },
    {
      label: "Lucro do Cliente", value: formatCurrency(lucroCliente), icon: PiggyBank,
      color: lucroCliente >= 0 ? "text-emerald-400" : "text-red-400",
      tooltip: <LucroTooltip faturamentoCliente={faturamentoCliente} gastoMeta={gastoMeta} imposto={imposto} custoConsultas={custoConsultas} custoManychat={custoManychat} lucro={lucroCliente} />,
    },
    {
      label: "CAC", value: formatCurrency(cac), icon: Target,
      color: "text-blue-400",
      tooltip: <CacTooltip gastoMeta={gastoMeta} imposto={imposto} custoConsultas={custoConsultas} custoManychat={custoManychat} gastoTotal={gastoTotal} vendasAprovadas={vendasAprovadas} cac={cac} />,
    },
    ...(!clientView && isAdmin && !isGestor ? [{
      label: "Faturamento Agência", value: formatCurrency(faturamentoAgencia), icon: Building2, color: "text-primary",
      tooltip: null as React.ReactNode | null,
    }] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <span className="text-lg font-bold text-primary">{client.name.charAt(0)}</span>
        </div>
        <h2 className="text-xl font-bold font-display text-foreground">{client.name}</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((kpi) => {
          const card = (
            <div className={`rounded-xl border border-border bg-card p-4 space-y-2 ${kpi.tooltip ? "cursor-pointer" : ""}`}>
              <div className="flex items-center gap-2">
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                <p className="text-xs text-muted-foreground truncate">{kpi.label}</p>
              </div>
              <p className={`text-lg font-bold ${kpi.color}`}>
                {isLoading ? "..." : kpi.value}
              </p>
            </div>
          );

          if (kpi.tooltip) {
            return (
              <HoverCard key={kpi.label} openDelay={100} closeDelay={100}>
                <HoverCardTrigger asChild>{card}</HoverCardTrigger>
                <HoverCardContent className="w-72">{kpi.tooltip}</HoverCardContent>
              </HoverCard>
            );
          }

          return <div key={kpi.label}>{card}</div>;
        })}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Relatórios</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {client.offers.map((offer) => {
            // Map offer_slug to dashboard route
            const dashboardPath = offer.offer_slug === 'formacao-consultor'
              ? 'formacao-consultor'
              : offer.offer_slug === 'sistema-leads'
              ? 'sistema-leads'
              : offer.offer_slug === 'distribuicao'
              ? 'distribuicao'
              : 'checkup-performance';
            const reportHref = clientView
              ? `/cliente/${client.slug}/${dashboardPath}`
              : `/interno/${client.slug}/${dashboardPath}`;
            return (
              <Link
                key={offer.offer_slug}
                to={reportHref}
                className="flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors group"
              >
                <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                  {offer.label}
                </p>
                <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Panel({ clientView }: { clientView?: boolean }) {
  const { user, isAdmin, isSuperAdmin, isGestor, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [clients, setClients] = useState<ClientWithOffers[]>([]);
  const [loading, setLoading] = useState(true);
  const stateKey = `panel:${location.pathname}`;
  const today = new Date();
  const todayStr = formatDateString(today);
  const [panelState, setPanelState] = usePageState(stateKey, {
    simulateClientView: false,
    datePreset: "hoje",
    dateFrom: todayStr,
    dateTo: todayStr,
    dateLabel: "Hoje",
  });
  const { simulateClientView, datePreset, dateFrom, dateTo, dateLabel } = panelState;
  const effectiveClientView = clientView || simulateClientView;

  const applyPreset = (preset: string) => {
    const now = new Date();
    let from: Date, to: Date, label: string;
    switch (preset) {
      case "ontem": {
        const d = new Date(now); d.setDate(d.getDate() - 1);
        from = to = d; label = "Ontem"; break;
      }
      case "semana": {
        from = getWeekStart(now, 0);
        to = now;
        label = "Semana";
        break;
      }
      case "mes": {
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        to = now; label = "Mês"; break;
      }
      case "mes_passado": {
        from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        to = new Date(now.getFullYear(), now.getMonth(), 0);
        label = "Mês Passado"; break;
      }
      default: {
        from = to = now; label = "Hoje"; break;
      }
    }
    setPanelState((current) => ({
      ...current,
      datePreset: preset,
      dateFrom: formatDateString(from),
      dateTo: formatDateString(to),
      dateLabel: label,
    }));
  };

  // Gestor loads clients the same way as a regular client user (only assigned ones)
  // but sees the admin-style dashboard (without co-produtor)
  useEffect(() => {
    if (!user) return;

    async function loadClients() {
      if (clientView || (isGestor && !isSuperAdmin)) {
        // For client view or gestor, load only assigned campaigns
        const { data: accessData } = await supabase
          .from("user_campaign_access")
          .select("offer_slug, label")
          .eq("user_id", user!.id);

        if (!accessData || accessData.length === 0) {
          setLoading(false);
          return;
        }

        const slugs = accessData.map((a: any) => a.offer_slug);
        const { data: offersData } = await supabase
          .from("client_offers")
          .select("client_id, offer_slug, label")
          .in("offer_slug", slugs);

        const clientIds = [...new Set((offersData || []).map((o: any) => o.client_id))];
        const { data: clientsData } = await supabase
          .from("clients")
          .select("id, name, slug")
          .in("id", clientIds);

        const clientsWithOffers: ClientWithOffers[] = (clientsData || []).map((c: any) => ({
          ...c,
          offers: (offersData || []).filter((o: any) => o.client_id === c.id),
        }));

        setClients(clientsWithOffers);
      } else {
        // Admin view - load all clients
        const { data: clientsData, error: clientsError } = await supabase
          .from("clients")
          .select("id, name, slug");

        if (clientsError || !clientsData) {
          console.error("Error loading clients:", clientsError);
          setLoading(false);
          return;
        }

        const { data: offersData } = await supabase
          .from("client_offers")
          .select("client_id, offer_slug, label");

        const clientsWithOffers: ClientWithOffers[] = clientsData.map((c: any) => ({
          ...c,
          offers: (offersData || []).filter((o: any) => o.client_id === c.id),
        }));

        setClients(clientsWithOffers);
      }
      setLoading(false);
    }

    loadClients();
  }, [user, clientView, isGestor, isAdmin]);

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  usePageScroll(stateKey, !loading);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-display text-foreground">
                {clientView ? "Meu Painel" : "Painel de Controle"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {clientView ? "Acompanhe seus resultados" : "Visão geral dos clientes"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isSuperAdmin && !clientView && (
              <button
                onClick={() => setPanelState((current) => ({ ...current, simulateClientView: !current.simulateClientView }))}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  simulateClientView
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {simulateClientView ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {simulateClientView ? "Visão Cliente" : "Visão Admin"}
              </button>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-border bg-card text-secondary-foreground hover:border-destructive/50 hover:text-destructive transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </div>

        {isSuperAdmin && !clientView ? (
          <Tabs defaultValue="clientes" className="space-y-6">
            <TabsList>
              <TabsTrigger value="clientes">Clientes</TabsTrigger>
              <TabsTrigger value="usuarios">Cadastrar Usuários</TabsTrigger>
              <TabsTrigger value="acessos">Atribuir Acessos</TabsTrigger>
            </TabsList>

            <TabsContent value="clientes">
              {/* Date filter */}
              <div className="flex items-center gap-2 flex-wrap mb-6">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                {[
                  { key: "hoje", label: "Hoje" },
                  { key: "ontem", label: "Ontem" },
                  { key: "semana", label: "Semana" },
                  { key: "mes", label: "Mês" },
                  { key: "mes_passado", label: "Mês Passado" },
                ].map((p) => (
                  <button
                    key={p.key}
                    onClick={() => applyPreset(p.key)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      datePreset === p.key
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        datePreset === "custom"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {datePreset === "custom"
                        ? `${formatDayMonth(dateFrom)} — ${formatDayMonth(dateTo)}`
                        : "Personalizado"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="range"
                      selected={{
                        from: parseDateStringLocal(dateFrom),
                        to: parseDateStringLocal(dateTo),
                      }}
                       onSelect={(range) => {
                         if (range?.from) {
                           setPanelState((current) => ({
                             ...current,
                             datePreset: "custom",
                             dateFrom: formatDateString(range.from),
                             dateTo: formatDateString(range.to || range.from),
                             dateLabel: range.to
                               ? `${formatDayMonth(formatDateString(range.from))} — ${formatDayMonth(formatDateString(range.to))}`
                               : formatDayMonth(formatDateString(range.from)),
                           }));
                         }
                       }}
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              {renderClients()}
            </TabsContent>
            <TabsContent value="usuarios">
              <CreateUserTab />
            </TabsContent>
            <TabsContent value="acessos">
              <AssignAccessTab />
            </TabsContent>
          </Tabs>
        ) : (
          <>
            {/* Date filter for non-super-admin */}
            <div className="flex items-center gap-2 flex-wrap">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              {[
                { key: "hoje", label: "Hoje" },
                { key: "ontem", label: "Ontem" },
                { key: "semana", label: "Semana" },
                { key: "mes", label: "Mês" },
                { key: "mes_passado", label: "Mês Passado" },
              ].map((p) => (
                <button
                  key={p.key}
                  onClick={() => applyPreset(p.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    datePreset === p.key
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      datePreset === "custom"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {datePreset === "custom"
                      ? `${formatDayMonth(dateFrom)} — ${formatDayMonth(dateTo)}`
                      : "Personalizado"}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="range"
                    selected={{
                      from: parseDateStringLocal(dateFrom),
                      to: parseDateStringLocal(dateTo),
                    }}
                     onSelect={(range) => {
                       if (range?.from) {
                         setPanelState((current) => ({
                           ...current,
                           datePreset: "custom",
                           dateFrom: formatDateString(range.from),
                           dateTo: formatDateString(range.to || range.from),
                           dateLabel: range.to
                             ? `${formatDayMonth(formatDateString(range.from))} — ${formatDayMonth(formatDateString(range.to))}`
                             : formatDayMonth(formatDateString(range.from)),
                         }));
                       }
                     }}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            {renderClients()}
          </>
        )}
      </div>
    </div>
  );

  function renderClients() {
    if (loading) return <div className="text-center py-12 text-muted-foreground">Carregando...</div>;
    if (clients.length === 0) return <div className="text-center py-12 text-muted-foreground">Nenhum cliente cadastrado.</div>;
    return (
      <div className="space-y-8">
        {clients.map((client) => (
          <div key={client.id} className="rounded-2xl border border-border bg-card/50 p-5 md:p-6 space-y-4">
            <ClientCard client={client} isAdmin={isAdmin} isGestor={isGestor} clientView={effectiveClientView} dateFrom={dateFrom} dateTo={dateTo} dateLabel={dateLabel} />
          </div>
        ))}
        <UnpaidAccountsTable />
      </div>
    );
  }
}
