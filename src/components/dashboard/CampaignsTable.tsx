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
  if (isLoading) {
    return (
      <div className="chart-container">
        <h3 className="dashboard-section-title mb-4">Performance por Campanha</h3>
        <div className="h-32 flex items-center justify-center text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  const campaigns = data || [];

  return (
    <div className="chart-container">
      <h3 className="dashboard-section-title mb-4">Performance por Campanha</h3>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
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
            {campaigns.map((c, i) => {
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
    </div>
  );
}
