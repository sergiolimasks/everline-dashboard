import { useState } from "react";
import { ExternalLink } from "lucide-react";
import type { AdData } from "@/lib/dashboard-api";

interface CreativesTableProps {
  data: AdData[] | undefined;
  isLoading: boolean;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatNumber(value: number) {
  return value.toLocaleString('pt-BR');
}

function formatPercent(value: number) {
  return (value * 100).toFixed(2) + '%';
}

export function CreativesTable({ data, isLoading }: CreativesTableProps) {
  const [showAll, setShowAll] = useState(false);
  const INITIAL_SHOW = 5;

  if (isLoading) {
    return (
      <div className="chart-container">
        <h3 className="dashboard-section-title mb-4">Performance por Criativo</h3>
        <div className="h-32 flex items-center justify-center text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  const ads = data || [];
  const visible = showAll ? ads : ads.slice(0, INITIAL_SHOW);
  const hasMore = ads.length > INITIAL_SHOW;

  const totals = ads.reduce(
    (acc, a) => {
      acc.impressoes += Number(a.impressoes);
      acc.cliques += Number(a.cliques);
      acc.gasto += Number(a.gasto);
      acc.views_3s += Number(a.views_3s);
      return acc;
    },
    { impressoes: 0, cliques: 0, gasto: 0, views_3s: 0 }
  );
  const totalCtr = totals.impressoes > 0 ? totals.cliques / totals.impressoes : 0;
  const totalTsr = totals.impressoes > 0 ? totals.views_3s / totals.impressoes : 0;

  return (
    <div className="chart-container">
      <div className="flex items-center justify-between mb-4">
        <h3 className="dashboard-section-title">Performance por Criativo</h3>
        <span className="text-xs text-muted-foreground">{ads.length} anúncios</span>
      </div>
      <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
        <table className="data-table">
          <thead className="sticky top-0 bg-card z-10">
            <tr>
              <th>Anúncio</th>
              <th className="text-right">Gasto</th>
              <th className="text-right">Impressões</th>
              <th className="text-right">Cliques</th>
              <th className="text-right">CTR</th>
              <th className="text-right">Thumb Stop Rate</th>
              <th className="text-right">CPC</th>
              <th className="text-right">CPM</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((a, i) => (
              <tr key={i}>
                <td className="font-medium max-w-xs">
                  {a.link ? (
                    <a
                      href={a.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-primary hover:text-primary/80 transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{a.anuncio}</span>
                    </a>
                  ) : (
                    <span className="truncate">{a.anuncio}</span>
                  )}
                </td>
                <td className="text-right font-display font-semibold">{formatCurrency(Number(a.gasto))}</td>
                <td className="text-right">{formatNumber(Number(a.impressoes))}</td>
                <td className="text-right">{formatNumber(Number(a.cliques))}</td>
                <td className="text-right font-display font-semibold">{formatPercent(Number(a.ctr))}</td>
                <td className="text-right font-display font-semibold">{formatPercent(Number(a.thumb_stop_rate))}</td>
                <td className="text-right">{formatCurrency(Number(a.cpc))}</td>
                <td className="text-right">{formatCurrency(Number(a.cpm))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-border">
            <tr className="font-semibold bg-muted/30">
              <td className="font-medium">Total ({ads.length} anúncios)</td>
              <td className="text-right font-display">{formatCurrency(totals.gasto)}</td>
              <td className="text-right">{formatNumber(totals.impressoes)}</td>
              <td className="text-right">{formatNumber(totals.cliques)}</td>
              <td className="text-right font-display">{formatPercent(totalCtr)}</td>
              <td className="text-right font-display">{formatPercent(totalTsr)}</td>
              <td className="text-right">—</td>
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
          {showAll ? `Mostrar apenas ${INITIAL_SHOW}` : `Ver todos ${ads.length} anúncios`}
        </button>
      )}
    </div>
  );
}
