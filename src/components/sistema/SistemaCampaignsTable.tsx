import { useState } from "react";
import type { CampaignData } from "@/lib/dashboard-api";

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}
function formatNumber(v: number) {
  return v.toLocaleString('pt-BR');
}

function StatusIndicator({ status }: { status?: string }) {
  const isActive = status?.toUpperCase() === 'ACTIVE';
  return <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${isActive ? 'bg-primary' : 'bg-muted-foreground/40'}`} title={isActive ? 'Ativa' : 'Inativa'} />;
}

export function SistemaCampaignsTable({ data, isLoading }: { data: CampaignData[] | undefined; isLoading: boolean }) {
  const [showAll, setShowAll] = useState(false);
  const INITIAL = 5;

  if (isLoading) {
    return (
      <div className="chart-container">
        <h3 className="dashboard-section-title mb-4">Performance por Campanha</h3>
        <div className="h-32 flex items-center justify-center text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  const campaigns = data || [];
  const visible = showAll ? campaigns : campaigns.slice(0, INITIAL);
  const hasMore = campaigns.length > INITIAL;

  // Use "compras" from Meta as lead count for SISTEMA campaigns
  const getLeads = (c: CampaignData) => Number(c.compras || 0) + Number(c.endform || 0);

  const totals = campaigns.reduce((acc, c) => {
    acc.gasto += Number(c.gasto);
    acc.leads += getLeads(c);
    acc.cliquesLink += Number(c.cliques_link);
    acc.impressoes += Number(c.impressoes);
    return acc;
  }, { gasto: 0, leads: 0, cliquesLink: 0, impressoes: 0 });

  const totalCpl = totals.leads > 0 ? totals.gasto / totals.leads : 0;

  return (
    <div className="chart-container">
      <div className="flex items-center justify-between mb-4">
        <h3 className="dashboard-section-title">Performance por Campanha</h3>
        <span className="text-xs text-muted-foreground">{campaigns.length} campanhas</span>
      </div>
      <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
        <table className="data-table">
          <thead className="sticky top-0 bg-card z-10">
            <tr>
              <th>Campanha</th>
              <th className="text-right">Gasto</th>
              <th className="text-right">Leads</th>
              <th className="text-right">CPL</th>
              <th className="text-right">Cliques</th>
              <th className="text-right">Impressões</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((c, i) => {
              const gasto = Number(c.gasto);
              const leads = getLeads(c);
              const cpl = leads > 0 ? gasto / leads : 0;
              return (
                <tr key={i}>
                  <td className="font-medium max-w-xs">
                    <div className="flex items-center gap-2">
                      <StatusIndicator status={c.status} />
                      <span className="truncate">{c.campanha}</span>
                    </div>
                  </td>
                  <td className="text-right font-display font-semibold">{formatCurrency(gasto)}</td>
                  <td className="text-right">{formatNumber(leads)}</td>
                  <td className="text-right">{formatCurrency(cpl)}</td>
                  <td className="text-right">{formatNumber(Number(c.cliques_link))}</td>
                  <td className="text-right">{formatNumber(Number(c.impressoes))}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-border">
            <tr className="font-semibold bg-muted/30">
              <td className="font-medium">Total ({campaigns.length})</td>
              <td className="text-right font-display">{formatCurrency(totals.gasto)}</td>
              <td className="text-right">{formatNumber(totals.leads)}</td>
              <td className="text-right">{formatCurrency(totalCpl)}</td>
              <td className="text-right">{formatNumber(totals.cliquesLink)}</td>
              <td className="text-right">{formatNumber(totals.impressoes)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-3 w-full py-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors border border-border rounded-lg hover:border-primary/50"
        >
          {showAll ? `Mostrar apenas ${INITIAL}` : `Ver todas ${campaigns.length} campanhas`}
        </button>
      )}
    </div>
  );
}
