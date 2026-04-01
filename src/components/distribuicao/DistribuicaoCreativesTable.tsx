import { useState } from "react";
import { ExternalLink } from "lucide-react";
import type { AdData } from "@/lib/dashboard-api";

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

export function DistribuicaoCreativesTable({ data, isLoading }: { data: AdData[] | undefined; isLoading: boolean }) {
  const [showAll, setShowAll] = useState(false);
  const INITIAL = 5;

  if (isLoading) {
    return (
      <div className="chart-container">
        <h3 className="dashboard-section-title mb-4">Performance por Criativo</h3>
        <div className="h-32 flex items-center justify-center text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  const ads = data || [];
  const visible = showAll ? ads : ads.slice(0, INITIAL);
  const hasMore = ads.length > INITIAL;

  const totals = ads.reduce((acc, a) => {
    acc.gasto += Number(a.gasto);
    acc.impressoes += Number(a.impressoes);
    acc.alcance += Number(a.alcance);
    acc.cliques += Number(a.cliques);
    acc.views3s += Number(a.views_3s);
    return acc;
  }, { gasto: 0, impressoes: 0, alcance: 0, cliques: 0, views3s: 0 });

  const totalCpc = totals.cliques > 0 ? totals.gasto / totals.cliques : 0;
  const totalCpm = totals.impressoes > 0 ? (totals.gasto / totals.impressoes) * 1000 : 0;
  const totalTsr = totals.impressoes > 0 ? (totals.views3s / totals.impressoes) * 100 : 0;

  return (
    <div className="chart-container">
      <div className="flex items-center justify-between mb-4">
        <h3 className="dashboard-section-title">Performance por Criativo</h3>
        <span className="text-xs text-muted-foreground">{ads.length} criativos</span>
      </div>
      <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
        <table className="data-table">
          <thead className="sticky top-0 bg-card z-10">
            <tr>
              <th>Criativo</th>
              <th className="text-right">Gasto</th>
              <th className="text-right">Impressões</th>
              <th className="text-right">CPC</th>
              <th className="text-right">CPM</th>
              <th className="text-right">TSR</th>
              <th className="text-right">CTR</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((a, i) => {
              const gasto = Number(a.gasto);
              const impressoes = Number(a.impressoes);
              const cpc = Number(a.cpc);
              const cpm = Number(a.cpm);
              const tsr = Number(a.thumb_stop_rate) * 100;
              const ctr = Number(a.ctr) * 100;
              return (
                <tr key={i}>
                  <td className="font-medium max-w-xs">
                    <div className="flex items-center gap-1.5">
                      <StatusIndicator status={a.status} />
                      {a.link ? (
                        <a href={a.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-primary hover:text-primary/80 transition-colors">
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{a.anuncio}</span>
                        </a>
                      ) : (
                        <span className="truncate">{a.anuncio}</span>
                      )}
                    </div>
                  </td>
                  <td className="text-right font-display font-semibold">{formatCurrency(gasto)}</td>
                  <td className="text-right">{formatNumber(impressoes)}</td>
                  <td className="text-right">{formatCurrency(cpc)}</td>
                  <td className="text-right">{formatCurrency(cpm)}</td>
                  <td className="text-right">{tsr.toFixed(2)}%</td>
                  <td className="text-right">{ctr.toFixed(2)}%</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-border">
            <tr className="font-semibold bg-muted/30">
              <td className="font-medium">Total ({ads.length})</td>
              <td className="text-right font-display">{formatCurrency(totals.gasto)}</td>
              <td className="text-right">{formatNumber(totals.impressoes)}</td>
              <td className="text-right">{formatCurrency(totalCpc)}</td>
              <td className="text-right">{formatCurrency(totalCpm)}</td>
              <td className="text-right">{totalTsr.toFixed(2)}%</td>
              <td className="text-right">—</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-3 w-full py-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors border border-border rounded-lg hover:border-primary/50"
        >
          {showAll ? `Mostrar apenas ${INITIAL}` : `Ver todos ${ads.length} criativos`}
        </button>
      )}
    </div>
  );
}
