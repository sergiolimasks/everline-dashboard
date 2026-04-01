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

export function DistribuicaoCampaignsTable({ data, isLoading }: { data: CampaignData[] | undefined; isLoading: boolean }) {
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

  const totals = campaigns.reduce((acc, c) => {
    acc.gasto += Number(c.gasto);
    acc.impressoes += Number(c.impressoes);
    acc.alcance += Number(c.alcance);
    acc.cliquesLink += Number(c.cliques_link);
    acc.views3s += Number(c.views_3s || 0);
    return acc;
  }, { gasto: 0, impressoes: 0, alcance: 0, cliquesLink: 0, views3s: 0 });

  const totalCpc = totals.cliquesLink > 0 ? totals.gasto / totals.cliquesLink : 0;
  const totalCpm = totals.impressoes > 0 ? (totals.gasto / totals.impressoes) * 1000 : 0;
  const totalFreq = totals.alcance > 0 ? totals.impressoes / totals.alcance : 0;
  const totalTsr = totals.impressoes > 0 ? (totals.views3s / totals.impressoes) * 100 : 0;

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
              <th className="text-right">Impressões</th>
              <th className="text-right">Alcance</th>
              <th className="text-right">Cliques</th>
              <th className="text-right">CPC</th>
              <th className="text-right">CPM</th>
              <th className="text-right">TSR</th>
              <th className="text-right">Freq.</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((c, i) => {
              const gasto = Number(c.gasto);
              const impressoes = Number(c.impressoes);
              const alcance = Number(c.alcance);
              const cpc = Number(c.cpc);
              const cpm = Number(c.cpm);
              const freq = Number(c.frequencia || 0);
              const tsr = Number(c.tsr || 0) * 100;
              return (
                <tr key={i}>
                  <td className="font-medium max-w-xs">
                    <div className="flex items-center gap-2">
                      <StatusIndicator status={c.status} />
                      <span className="truncate">{c.campanha}</span>
                    </div>
                  </td>
                  <td className="text-right font-display font-semibold">{formatCurrency(gasto)}</td>
                  <td className="text-right">{formatNumber(impressoes)}</td>
                  <td className="text-right">{formatNumber(alcance)}</td>
                  <td className="text-right">{formatNumber(Number(c.cliques_link))}</td>
                  <td className="text-right">{formatCurrency(cpc)}</td>
                  <td className="text-right">{formatCurrency(cpm)}</td>
                  <td className="text-right">{tsr.toFixed(2)}%</td>
                  <td className="text-right">{freq.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-border">
            <tr className="font-semibold bg-muted/30">
              <td className="font-medium">Total ({campaigns.length})</td>
              <td className="text-right font-display">{formatCurrency(totals.gasto)}</td>
              <td className="text-right">{formatNumber(totals.impressoes)}</td>
              <td className="text-right">{formatNumber(totals.alcance)}</td>
              <td className="text-right">{formatNumber(totals.cliquesLink)}</td>
              <td className="text-right">{formatCurrency(totalCpc)}</td>
              <td className="text-right">{formatCurrency(totalCpm)}</td>
              <td className="text-right">{totalTsr.toFixed(2)}%</td>
              <td className="text-right">{totalFreq.toFixed(2)}</td>
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
