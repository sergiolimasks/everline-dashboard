import type { SummaryData } from "@/lib/dashboard-api";

interface ProductsTableProps {
  data: SummaryData | undefined;
  isLoading: boolean;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function ProductsTable({ data, isLoading }: ProductsTableProps) {
  if (isLoading) {
    return (
      <div className="chart-container">
        <h3 className="dashboard-section-title mb-4">Vendas por Produto</h3>
        <div className="h-32 flex items-center justify-center text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  const products = data?.products || [];
  const checkupProduct = products.find(
    (p) => (p.produto || '').toLowerCase().includes('checkup') || (p.produto || '').toLowerCase().includes('vida financeira')
  );
  const orderBumps = products.filter(
    (p) => !(p.produto || '').toLowerCase().includes('checkup') && !(p.produto || '').toLowerCase().includes('vida financeira')
  );

  return (
    <div className="chart-container">
      <div className="flex items-center gap-3 mb-4">
        <h3 className="dashboard-section-title">Vendas por Produto</h3>
        {checkupProduct && (
          <span className="insight-badge">
            Produto principal: {Number(checkupProduct.vendas_aprovadas)} vendas
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Produto</th>
              <th>Tipo</th>
              <th className="text-right">Vendas</th>
              <th className="text-right">Receita Bruta</th>
              <th className="text-right">Receita Líquida</th>
              <th className="text-right">Ticket Médio</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, i) => {
              const isCheckup = (p.produto || '').toLowerCase().includes('checkup') || (p.produto || '').toLowerCase().includes('vida financeira');
              const ticketMedio = Number(p.vendas_aprovadas) > 0 ? Number(p.receita_bruta) / Number(p.vendas_aprovadas) : 0;
              return (
                <tr key={i}>
                  <td className="font-medium">{p.produto || 'Sem nome'}</td>
                  <td>
                    <span className={`text-xs px-2 py-1 rounded-full ${isCheckup ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'}`}>
                      {isCheckup ? 'Principal' : 'Order Bump'}
                    </span>
                  </td>
                  <td className="text-right font-display font-semibold">{Number(p.vendas_aprovadas)}</td>
                  <td className="text-right">{formatCurrency(Number(p.receita_bruta))}</td>
                  <td className="text-right">{formatCurrency(Number(p.receita_liquida))}</td>
                  <td className="text-right">{formatCurrency(ticketMedio)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
