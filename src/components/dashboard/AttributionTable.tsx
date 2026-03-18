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
      acc.gasto += r.gasto;
      acc.leads += r.leads;
      acc.vendas += r.vendas;
      acc.receita_liquida += r.receita_liquida;
      acc.lucro += r.lucro;
      return acc;
    },
    { gasto: 0, leads: 0, vendas: 0, receita_liquida: 0, lucro: 0 }
  );
  const totalCpl = totals.leads > 0 ? totals.gasto / totals.leads : 0;
  const totalCpa = totals.vendas > 0 ? totals.gasto / totals.vendas : 0;
  const totalRoi = totals.gasto > 0 ? totals.receita_liquida / totals.gasto : 0;

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
              <th className="text-right">Valor Gasto</th>
              <th className="text-right">Leads</th>
              <th className="text-right">CPL</th>
              <th className="text-right">Vendas</th>
              <th className="text-right">CPA</th>
              <th className="text-right">ROI</th>
              <th className="text-right">Lucro</th>
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
                <td className="text-right font-display font-semibold">{formatCurrency(r.gasto)}</td>
                <td className="text-right">{formatNumber(r.leads)}</td>
                <td className="text-right">{r.leads > 0 ? formatCurrency(r.cpl) : '—'}</td>
                <td className="text-right">{formatNumber(r.vendas)}</td>
                <td className="text-right">{r.vendas > 0 ? formatCurrency(r.cpa) : '—'}</td>
                <td className={`text-right font-display font-semibold ${r.roi >= 1 ? 'text-primary' : r.gasto > 0 ? 'text-destructive' : ''}`}>
                  {r.gasto > 0 ? r.roi.toFixed(2) : '—'}
                </td>
                <td className={`text-right font-display font-semibold ${r.lucro >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {r.gasto > 0 || r.lucro !== 0 ? formatCurrency(r.lucro) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-border">
            <tr className="font-semibold bg-muted/30">
              <td>Total</td>
              <td className="text-right font-display">{formatCurrency(totals.gasto)}</td>
              <td className="text-right">{formatNumber(totals.leads)}</td>
              <td className="text-right">{formatCurrency(totalCpl)}</td>
              <td className="text-right">{formatNumber(totals.vendas)}</td>
              <td className="text-right">{formatCurrency(totalCpa)}</td>
              <td className={`text-right font-display ${totalRoi >= 1 ? 'text-primary' : 'text-destructive'}`}>{totalRoi.toFixed(2)}</td>
              <td className={`text-right font-display ${totals.lucro >= 0 ? 'text-primary' : 'text-destructive'}`}>{formatCurrency(totals.lucro)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
