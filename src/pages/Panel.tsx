import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useSummary } from "@/hooks/use-dashboard";
import { formatDateString } from "@/lib/date-utils";
import { BarChart3, LogOut, ExternalLink, TrendingUp, TrendingDown, DollarSign, ShoppingCart, Wallet, PiggyBank, Building2 } from "lucide-react";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";

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

function LucroTooltip({ faturamentoCliente, gastoTotal, taxaGreenn, lucro }: { faturamentoCliente: number; gastoTotal: number; taxaGreenn: number; lucro: number }) {
  return (
    <div className="space-y-1.5 text-xs">
      <p className="font-semibold text-foreground mb-2">Composição do Lucro do Cliente</p>
      <div className="flex justify-between"><span className="text-muted-foreground">Faturamento do Cliente</span><span className="text-emerald-400 font-medium">+ {formatCurrency(faturamentoCliente)}</span></div>
      <div className="flex justify-between"><span className="text-muted-foreground">Gasto Total</span><span className="text-red-400 font-medium">- {formatCurrency(gastoTotal)}</span></div>
      <div className="flex justify-between"><span className="text-muted-foreground">Taxa Greenn</span><span className="text-red-400 font-medium">- {formatCurrency(taxaGreenn)}</span></div>
      <div className="border-t border-border pt-1.5 flex justify-between font-semibold">
        <span className="text-foreground">Lucro do Cliente</span>
        <span className={lucro >= 0 ? "text-emerald-400" : "text-red-400"}>{formatCurrency(lucro)}</span>
      </div>
    </div>
  );
}

function ClientCard({ client, isAdmin }: { client: ClientWithOffers; isAdmin: boolean }) {
  const today = formatDateString(new Date());
  const { data: summary, isLoading } = useSummary(today, today, client.slug !== "all" ? client.slug : undefined);

  const gastoMeta = Number(summary?.traffic?.total_gasto || 0);
  const imposto = gastoMeta * 0.125;
  const vendasAprovadas = Number(summary?.sales?.vendas_aprovadas || 0);
  const custoConsultas = vendasAprovadas * 18;
  const custoManychat = vendasAprovadas * 0.35;
  const coProdutor = Number(summary?.sales?.co_produtor || 0);
  const gastoTotal = gastoMeta + imposto + custoConsultas + custoManychat;
  const receitaBruta = Number(summary?.sales?.receita_bruta || 0);
  const taxaGreenn = Number(summary?.sales?.taxa_green || 0);
  const faturamentoAgencia = coProdutor;
  // Faturamento do Cliente = receita bruta - co-produtor (agência)
  const faturamentoCliente = receitaBruta - faturamentoAgencia;
  // Lucro do Cliente = faturamento do cliente - gastos totais - taxa Greenn
  const lucroCliente = faturamentoCliente - gastoTotal - taxaGreenn;
  const roi = gastoTotal > 0 ? (faturamentoCliente - gastoTotal) / gastoTotal : 0;
  const products = summary?.products || [];

  const kpis = [
    {
      label: "Investimento Hoje", value: formatCurrency(gastoTotal), icon: Wallet, color: "text-red-400",
      tooltip: <GastoTooltip gastoMeta={gastoMeta} imposto={imposto} custoConsultas={custoConsultas} custoManychat={custoManychat} gastoTotal={gastoTotal} />,
    },
    {
      label: "Vendas Hoje", value: isLoading ? "..." : String(vendasAprovadas), icon: ShoppingCart, color: "text-blue-400",
      tooltip: <VendasTooltip products={products} />,
    },
    {
      label: "Faturamento do Cliente", value: formatCurrency(faturamentoCliente), icon: DollarSign, color: "text-emerald-400",
      tooltip: null,
    },
    {
      label: "Lucro do Cliente", value: formatCurrency(lucroCliente), icon: PiggyBank,
      color: lucroCliente >= 0 ? "text-emerald-400" : "text-red-400",
      tooltip: <LucroTooltip faturamentoCliente={faturamentoCliente} gastoTotal={gastoTotal} taxaGreenn={taxaGreenn} lucro={lucroCliente} />,
    },
    {
      label: "ROI do Projeto", value: roi.toFixed(2), icon: roi >= 0 ? TrendingUp : TrendingDown,
      color: roi >= 0 ? "text-emerald-400" : "text-red-400",
      tooltip: null,
    },
    ...(isAdmin ? [{
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
          {client.offers.map((offer) => (
            <a
              key={offer.offer_slug}
              href={`/interno/${client.slug}/checkup-performance`}
              className="flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors group"
            >
              <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                {offer.label}
              </p>
              <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Panel() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientWithOffers[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    async function loadClients() {
      const { data: clientsData, error: clientsError } = await (supabase as any)
        .from("clients")
        .select("id, name, slug");

      if (clientsError || !clientsData) {
        console.error("Error loading clients:", clientsError);
        setLoading(false);
        return;
      }

      const { data: offersData } = await (supabase as any)
        .from("client_offers")
        .select("client_id, offer_slug, label");

      const clientsWithOffers: ClientWithOffers[] = clientsData.map((c: any) => ({
        ...c,
        offers: (offersData || []).filter((o: any) => o.client_id === c.id),
      }));

      setClients(clientsWithOffers);
      setLoading(false);
    }

    loadClients();
  }, [user]);

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-display text-foreground">Painel de Controle</h1>
              <p className="text-sm text-muted-foreground">Visão geral dos clientes</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-border bg-card text-secondary-foreground hover:border-destructive/50 hover:text-destructive transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : clients.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">Nenhum cliente cadastrado.</div>
        ) : (
          <div className="space-y-8">
            {clients.map((client) => (
              <div key={client.id} className="rounded-2xl border border-border bg-card/50 p-5 md:p-6 space-y-4">
                <ClientCard client={client} isAdmin={isAdmin} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
