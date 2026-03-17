import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useSummary } from "@/hooks/use-dashboard";
import { formatDateString } from "@/lib/date-utils";
import { BarChart3, LogOut, ExternalLink, TrendingUp, TrendingDown, DollarSign, ShoppingCart, Wallet, PiggyBank, PercentCircle, Building2 } from "lucide-react";

interface ClientWithOffers {
  id: string;
  name: string;
  slug: string;
  offers: { offer_slug: string; label: string }[];
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function ClientCard({ client }: { client: ClientWithOffers }) {
  const today = formatDateString(new Date());
  // Fetch summary for this client's slug (aggregates all offers under this client)
  const { data: summary, isLoading } = useSummary(today, today, client.slug !== "all" ? client.slug : undefined);

  const gastoMeta = Number(summary?.traffic?.total_gasto || 0);
  const imposto = gastoMeta * 0.125;
  const vendasAprovadas = Number(summary?.sales?.vendas_aprovadas || 0);
  const custoConsultas = vendasAprovadas * 18;
  const custoManychat = vendasAprovadas * 0.35;
  const coProdutor = Number(summary?.sales?.co_produtor || 0);

  // Gasto total (sem co-produtor)
  const gastoTotal = gastoMeta + imposto + custoConsultas + custoManychat;

  // Faturamento do projeto (receita bruta completa)
  const faturamento = Number(summary?.sales?.receita_bruta || 0);

  // Lucro do cliente (faturamento - co-produtor)
  const lucroCliente = faturamento - coProdutor;

  // ROI = (faturamento - custo) / custo (sem co-produtor)
  const roi = gastoTotal > 0 ? (faturamento - gastoTotal) / gastoTotal : 0;

  // Faturamento da Agência (co-produtor)
  const faturamentoAgencia = coProdutor;

  const kpis = [
    { label: "Gasto Total Hoje", value: formatCurrency(gastoTotal), icon: Wallet, color: "text-red-400" },
    { label: "Vendas Hoje", value: isLoading ? "..." : String(vendasAprovadas), icon: ShoppingCart, color: "text-blue-400" },
    { label: "Faturamento do Projeto", value: formatCurrency(faturamento), icon: DollarSign, color: "text-emerald-400" },
    { label: "Lucro do Cliente", value: formatCurrency(lucroCliente), icon: PiggyBank, color: lucroCliente >= 0 ? "text-emerald-400" : "text-red-400" },
    { label: "ROI do Projeto", value: formatPercent(roi), icon: roi >= 0 ? TrendingUp : TrendingDown, color: roi >= 0 ? "text-emerald-400" : "text-red-400" },
    { label: "Faturamento Agência", value: formatCurrency(faturamentoAgencia), icon: Building2, color: "text-primary" },
  ];

  return (
    <div className="space-y-4">
      {/* Client Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <span className="text-lg font-bold text-primary">{client.name.charAt(0)}</span>
        </div>
        <h2 className="text-xl font-bold font-display text-foreground">{client.name}</h2>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="flex items-center gap-2">
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              <p className="text-xs text-muted-foreground truncate">{kpi.label}</p>
            </div>
            <p className={`text-lg font-bold ${kpi.color}`}>
              {isLoading ? "..." : kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Reports */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Relatórios</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {client.offers.map((offer) => (
            <a
              key={offer.offer_slug}
              href={`/interno/${client.slug}/checkup-performance`}
              className="flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-card hover:border-primary/50 transition-colors group"
            >
              <div>
                <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                  {offer.label}
                </p>
              </div>
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
      // Fetch clients and their offers
      const { data: clientsData } = await supabase
        .from("clients")
        .select("id, name, slug");

      if (!clientsData) {
        setLoading(false);
        return;
      }

      const { data: offersData } = await supabase
        .from("client_offers")
        .select("client_id, offer_slug, label");

      const clientsWithOffers: ClientWithOffers[] = clientsData.map((c) => ({
        ...c,
        offers: (offersData || []).filter((o) => o.client_id === c.id),
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
        {/* Header */}
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

        {/* Client Cards */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : clients.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Nenhum cliente cadastrado.
          </div>
        ) : (
          <div className="space-y-8">
            {clients.map((client) => (
              <div key={client.id} className="rounded-2xl border border-border bg-card/50 p-5 md:p-6 space-y-4">
                <ClientCard client={client} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
