import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useSummary } from "@/hooks/use-dashboard";
import { formatDateString } from "@/lib/date-utils";
import { BarChart3, LogOut, ExternalLink } from "lucide-react";

interface CampaignAccess {
  offer_slug: string;
  label: string | null;
}

export default function Panel() {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<CampaignAccess[]>([]);

  const today = formatDateString(new Date());
  const { data: summary, isLoading } = useSummary(today, today);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_campaign_access")
      .select("offer_slug, label")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (data) setCampaigns(data);
      });
  }, [user]);

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const vendasHoje = summary?.sales?.vendas_aprovadas ?? 0;
  const receitaHoje = summary?.sales?.receita_bruta ?? 0;
  const gastoHoje = summary?.traffic?.total_gasto ?? 0;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-display text-foreground">Painel</h1>
              <p className="text-sm text-muted-foreground">Bem-vindo, {user?.email}</p>
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

        {/* KPI Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="kpi-card">
            <p className="kpi-label">Vendas Hoje</p>
            <p className="kpi-value">{isLoading ? "..." : vendasHoje}</p>
          </div>
          <div className="kpi-card">
            <p className="kpi-label">Receita Hoje</p>
            <p className="kpi-value">
              {isLoading ? "..." : receitaHoje.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
          </div>
          <div className="kpi-card">
            <p className="kpi-label">Gasto Hoje</p>
            <p className="kpi-value">
              {isLoading ? "..." : gastoHoje.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
          </div>
        </div>

        {/* Campaign buttons */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold font-display text-foreground">Seus Relatórios</h2>

          {isAdmin && (
            <a
              href="/interno/uelicon/checkup-performance"
              className="flex items-center justify-between w-full px-5 py-4 rounded-xl border border-border bg-card hover:border-primary/50 transition-colors group"
            >
              <div>
                <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                  Dashboard Interno (Admin)
                </p>
                <p className="text-sm text-muted-foreground">Visão completa com todas as métricas</p>
              </div>
              <ExternalLink className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </a>
          )}

          {campaigns.length > 0 ? (
            campaigns.map((c) => (
              <a
                key={c.offer_slug}
                href={`/cliente/${c.offer_slug}/checkup-performance`}
                className="flex items-center justify-between w-full px-5 py-4 rounded-xl border border-border bg-card hover:border-primary/50 transition-colors group"
              >
                <div>
                  <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                    {c.label || c.offer_slug}
                  </p>
                  <p className="text-sm text-muted-foreground">Relatório de performance</p>
                </div>
                <ExternalLink className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </a>
            ))
          ) : (
            !isAdmin && (
              <div className="px-5 py-8 rounded-xl border border-border bg-card text-center">
                <p className="text-muted-foreground">Nenhuma campanha disponível no momento.</p>
                <p className="text-sm text-muted-foreground mt-1">Entre em contato com o administrador.</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
