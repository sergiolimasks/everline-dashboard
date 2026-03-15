import { useState } from "react";
import type { CampaignData } from "@/lib/dashboard-api";

interface CampaignsTableProps {
  data: CampaignData[] | undefined;
  isLoading: boolean;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatNumber(value: number) {
  return value.toLocaleString('pt-BR');
}

export function CampaignsTable({ data, isLoading }: CampaignsTableProps) {
  const [showAll, setShowAll] = useState(false);
  const INITIAL_SHOW = 10;

  if (isLoading) {
    return (
      <div className="chart-container">
        <h3 className="dashboard-section-title mb-4">Performance por Campanha</h3>
        <div className="h-32 flex items-center justify-center text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  const campaigns = data || [];
  const visible = showAll ? campaigns : campaigns.slice(0, INITIAL_SHOW);
  const hasMore = campaigns.length > INITIAL_SHOW;

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
              <th className="text-right">Vendas</th>
              <th className="text-right">CPA</th>
              <th className="text-right">Valor Compras</th>
              <th className="text-right">ROAS</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((c, i) => {
              const gasto = Number(c.gasto);
              const compras = Number(c.compras);
              const valorCompras = Number(c.valor_compras);
              const cpa = compras > 0 ? gasto / compras : 0;
              const roas = gasto > 0 ? valorCompras / gasto : 0;
              return (
                <tr key={i}>
                  <td className="font-medium max-w-xs truncate">
                    <span className="truncate">{c.campanha}</span>
                  </td>
                  <td className="text-right font-display font-semibold">{formatCurrency(gasto)}</td>
                  <td className="text-right">{formatNumber(compras)}</td>
                  <td className="text-right">{formatCurrency(cpa)}</td>
                  <td className="text-right">{formatCurrency(valorCompras)}</td>
                  <td className="text-right font-display font-semibold">{roas.toFixed(2)}x</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-3 w-full py-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors border border-border rounded-lg hover:border-primary/50"
        >
          {showAll ? `Mostrar apenas ${INITIAL_SHOW}` : `Ver todas ${campaigns.length} campanhas`}
        </button>
      )}
    </div>
  );
}
