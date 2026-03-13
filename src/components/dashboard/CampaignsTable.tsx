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
              <th className="text-right">Impressões</th>
              <th className="text-right">Cliques</th>
              <th className="text-right">CTR</th>
              <th className="text-right">Checkouts</th>
              <th className="text-right">CPC</th>
              <th className="text-right">CPM</th>
              <th className="text-right">Gasto</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c, i) => {
              const ctr = Number(c.impressoes) > 0 ? (Number(c.cliques) / Number(c.impressoes)) * 100 : 0;
              const isCheckout = (c.campanha || '').toUpperCase().includes('CHECKOUT');
              return (
                <tr key={i}>
                  <td className="font-medium max-w-xs truncate">
                    <div className="flex items-center gap-2">
                      {isCheckout && (
                        <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                      )}
                      <span className="truncate">{c.campanha}</span>
                    </div>
                  </td>
                  <td className="text-right">{formatNumber(Number(c.impressoes))}</td>
                  <td className="text-right">{formatNumber(Number(c.cliques))}</td>
                  <td className="text-right">{ctr.toFixed(2)}%</td>
                  <td className="text-right">{formatNumber(Number(c.checkouts))}</td>
                  <td className="text-right">{formatCurrency(Number(c.cpc))}</td>
                  <td className="text-right">{formatCurrency(Number(c.cpm))}</td>
                  <td className="text-right font-display font-semibold">{formatCurrency(Number(c.gasto))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
