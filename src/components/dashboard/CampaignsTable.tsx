import { useState } from "react";
import type { CampaignData } from "@/lib/dashboard-api";

interface CampaignsTableProps {
  data: CampaignData[] | undefined;
  isLoading: boolean;
  showLeads?: boolean;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatNumber(value: number) {
  return value.toLocaleString('pt-BR');
}

function StatusIndicator({ status }: { status?: string }) {
  const isActive = status?.toUpperCase() === 'ACTIVE';
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${isActive ? 'bg-primary' : 'bg-muted-foreground/40'}`}
      title={isActive ? 'Ativa' : 'Inativa'}
    />
  );
}

export function CampaignsTable({ data, isLoading, showLeads = false }: CampaignsTableProps) {
  const [showAll, setShowAll] = useState(false);
  const INITIAL_SHOW = 5;

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

  const getLeads = (c: any) => Number(c.endform || 0) + Number(c.lead_aplicacao || 0) + Number(c.lead_presencial || 0);

  // Calculate totals
  const totals = campaigns.reduce(
    (acc, c) => {
      acc.gasto += Number(c.gasto);
      acc.compras += Number(c.compras);
      acc.valorCompras += Number(c.valor_compras);
      acc.leads += getLeads(c);
      return acc;
    },
    { gasto: 0, compras: 0, valorCompras: 0, leads: 0 }
  );
  const countCol = showLeads ? totals.leads : totals.compras;
  const totalCpa = countCol > 0 ? totals.gasto / countCol : 0;

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
              <th className="text-right">{showLeads ? 'Leads' : 'Vendas'}</th>
              <th className="text-right">{showLeads ? 'CPL' : 'CPA'}</th>
              {!showLeads && <th className="text-right">Valor Compras</th>}
            </tr>
          </thead>
          <tbody>
            {visible.map((c, i) => {
              const gasto = Number(c.gasto);
              const count = showLeads ? getLeads(c) : Number(c.compras);
              const valorCompras = Number(c.valor_compras);
              const cpaVal = count > 0 ? gasto / count : 0;
              return (
                <tr key={i}>
                  <td className="font-medium max-w-xs">
                    <div className="flex items-center gap-2">
                      <StatusIndicator status={c.status} />
                      <span className="truncate">{c.campanha}</span>
                    </div>
                  </td>
                  <td className="text-right font-display font-semibold">{formatCurrency(gasto)}</td>
                  <td className="text-right">{formatNumber(count)}</td>
                  <td className="text-right">{formatCurrency(cpaVal)}</td>
                  {!showLeads && <td className="text-right">{formatCurrency(valorCompras)}</td>}
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-border">
            <tr className="font-semibold bg-muted/30">
              <td className="font-medium">Total ({campaigns.length} campanhas)</td>
              <td className="text-right font-display">{formatCurrency(totals.gasto)}</td>
              <td className="text-right">{formatNumber(countCol)}</td>
              <td className="text-right">{formatCurrency(totalCpa)}</td>
              {!showLeads && <td className="text-right">{formatCurrency(totals.valorCompras)}</td>}
            </tr>
          </tfoot>
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
