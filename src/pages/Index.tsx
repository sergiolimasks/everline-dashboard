import { useState } from "react";
import { useSummary, useTrafficDaily, useSalesDaily, useCampaigns, useComparison7d, useComparison14d } from "@/hooks/use-dashboard";
import { formatDateString } from "@/lib/date-utils";
import { KPICards } from "@/components/dashboard/KPICards";
import { TrafficChart } from "@/components/dashboard/TrafficChart";
import { SalesChart } from "@/components/dashboard/SalesChart";
import { RevenueVsSpendChart } from "@/components/dashboard/RevenueVsSpendChart";
import { ProductsTable } from "@/components/dashboard/ProductsTable";
import { CampaignsTable } from "@/components/dashboard/CampaignsTable";
import { Insights } from "@/components/dashboard/Insights";
import { DateFilter } from "@/components/dashboard/DateFilter";
import { BarChart3, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

const Index = () => {
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const [dateFrom, setDateFrom] = useState(formatDateString(thirtyDaysAgo));
  const [dateTo, setDateTo] = useState(formatDateString(today));

  const queryClient = useQueryClient();

  const { data: summary, isLoading: loadingSummary } = useSummary(dateFrom, dateTo);
  const { data: comparison7d } = useComparison7d(dateFrom, dateTo);
  const { data: comparison14d } = useComparison14d(dateFrom, dateTo);
  const { data: trafficDaily, isLoading: loadingTraffic } = useTrafficDaily(dateFrom, dateTo);
  const { data: salesDaily, isLoading: loadingSales } = useSalesDaily(dateFrom, dateTo);
  const { data: campaigns, isLoading: loadingCampaigns } = useCampaigns(dateFrom, dateTo);

  const handleDateChange = (from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries();
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-display text-foreground">Dashboard de Performance</h1>
              <p className="text-sm text-muted-foreground">Tráfego Meta Ads × Vendas Greenn</p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-border bg-card text-secondary-foreground hover:border-primary/50 hover:text-primary transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
        </div>

        {/* Date Filter */}
        <DateFilter dateFrom={dateFrom} dateTo={dateTo} onDateChange={handleDateChange} />

        {/* KPIs */}
        <KPICards data={summary} isLoading={loadingSummary} comparison7d={comparison7d} comparison14d={comparison14d} />

        {/* Insights */}
        <Insights
          summary={summary}
          trafficDaily={trafficDaily}
          salesDaily={salesDaily}
          isLoading={loadingSummary || loadingSales}
        />

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TrafficChart data={trafficDaily} isLoading={loadingTraffic} />
          <SalesChart data={salesDaily} isLoading={loadingSales} />
        </div>

        {/* Revenue vs Spend */}
        <RevenueVsSpendChart
          trafficData={trafficDaily}
          salesData={salesDaily}
          isLoading={loadingTraffic || loadingSales}
        />

        {/* Products Table */}
        <ProductsTable data={summary} isLoading={loadingSummary} />

        {/* Campaigns Table */}
        <CampaignsTable data={campaigns} isLoading={loadingCampaigns} />
      </div>
    </div>
  );
};

export default Index;
