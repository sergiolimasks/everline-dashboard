import type { AttributionData } from "@/lib/dashboard-api";

interface AttributionTableProps {
  data: AttributionData[] | undefined;
  isLoading: boolean;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatNumber(value: number) {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

export function AttributionTable({ data, isLoading }: AttributionTableProps) {
  if (isLoading) {
    return (
      <div className="chart-container">
        <h3 className="dashboard-section-title mb-4">Atribuição de Vendas por Fonte de Lead</h3>
        <div className="h-32 flex items-center justify-center text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  const rows = data || [];
  if (rows.length === 0) {
    return (
      <div className="chart-container">
        <h3 className="dashboard-section-title mb-4">Atribuição de Vendas por Fonte de Lead</h3>
        <div className="h-20 flex items-center justify-center text-muted-foreground text-sm">Sem dados de atribuição no período</div>
      </div>
    );
  }

  const totals = rows.reduce(
    (acc, r) => {
      acc.leads += r.leads;
      acc.vendas += r.vendas;
      acc.receita_bruta += r.receita_bruta;
      acc.receita_liquida += r.receita_liquida;
      return acc;
    },
    { leads: 0, vendas: 0, receita_bruta: 0, receita_liquida: 0 }
  );
  const totalTxConv = totals.leads > 0 ? totals.vendas / totals.leads : 0;

  return (
    <div className="chart-container">
      <div className="flex items-center justify-between mb-4">
        <h3 className="dashboard-section-title">Atribuição de Vendas por Fonte de Lead</h3>
        <span className="text-[10px] text-muted-foreground bg-muted/50 rounded px-2 py-1">
          Cruzamento por telefone · Distribuição proporcional
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fonte</th>
              <th className="text-right">Leads</th>
              <th className="text-right">Vendas Atribuídas</th>
              <th className="text-right">Tx Conv.</th>
              <th className="text-right">Receita Bruta</th>
              <th className="text-right">Receita Líquida</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="font-medium">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${
                      r.source === 'Não identificado' ? 'bg-muted-foreground/40' : 'bg-primary'
                    }`} />
                    {r.source}
                  </div>
                </td>
                <td className="text-right">{formatNumber(r.leads)}</td>
                <td className="text-right font-display font-semibold">{formatNumber(r.vendas)}</td>
                <td className="text-right">{r.leads > 0 ? formatPercent(r.taxa_conversao) : '—'}</td>
                <td className="text-right">{formatCurrency(r.receita_bruta)}</td>
                <td className="text-right">{formatCurrency(r.receita_liquida)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-border">
            <tr className="font-semibold bg-muted/30">
              <td>Total</td>
              <td className="text-right">{formatNumber(totals.leads)}</td>
              <td className="text-right font-display">{formatNumber(totals.vendas)}</td>
              <td className="text-right">{formatPercent(totalTxConv)}</td>
              <td className="text-right">{formatCurrency(totals.receita_bruta)}</td>
              <td className="text-right">{formatCurrency(totals.receita_liquida)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
