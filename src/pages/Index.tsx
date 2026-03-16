import { useState } from "react";
import { useSummary, useTrafficDaily, useSalesDaily, useCampaigns, useAds, useComparison7d, useComparison14d, useSparklineTraffic } from "@/hooks/use-dashboard";
import { formatDateString } from "@/lib/date-utils";
import { KPICards } from "@/components/dashboard/KPICards";
import { TrafficChart } from "@/components/dashboard/TrafficChart";
import { SalesChart } from "@/components/dashboard/SalesChart";
import { RevenueVsSpendChart } from "@/components/dashboard/RevenueVsSpendChart";
import { ProductsTable } from "@/components/dashboard/ProductsTable";
import { CampaignsTable } from "@/components/dashboard/CampaignsTable";
import { CreativesTable } from "@/components/dashboard/CreativesTable";
import { DateFilter } from "@/components/dashboard/DateFilter";
import { OfferFilter, type OfferType } from "@/components/dashboard/OfferFilter";
import { BarChart3, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface IndexProps {
  clientView?: boolean;
}

const Index = ({ clientView = false }: IndexProps) => {
  const today = new Date();

  const [dateFrom, setDateFrom] = useState(formatDateString(today));
  const [dateTo, setDateTo] = useState(formatDateString(today));
  const [offer, setOffer] = useState<OfferType>('all');

  const queryClient = useQueryClient();

  const periodDays = Math.round((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const chartDateFrom = periodDays <= 3
    ? formatDateString(new Date(new Date(dateTo).getTime() - 6 * 24 * 60 * 60 * 1000))
    : dateFrom;

  const { data: summary, isLoading: loadingSummary } = useSummary(dateFrom, dateTo, offer);
  const { data: comparison7d } = useComparison7d(dateFrom, dateTo, offer);
  const { data: comparison14d } = useComparison14d(dateFrom, dateTo, offer);
  const { data: sparklineTraffic } = useSparklineTraffic(dateTo, offer);
  const { data: trafficDaily, isLoading: loadingTraffic } = useTrafficDaily(chartDateFrom, dateTo, offer);
  const { data: salesDaily, isLoading: loadingSales } = useSalesDaily(chartDateFrom, dateTo, offer);
  const { data: campaigns, isLoading: loadingCampaigns } = useCampaigns(dateFrom, dateTo, offer);
  const { data: ads, isLoading: loadingAds } = useAds(dateFrom, dateTo, offer);

  const sparklineData = periodDays > 30 ? trafficDaily : sparklineTraffic;

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
        {/* Page Title */}
        <h1 className="text-3xl md:text-4xl font-bold font-display text-center text-primary tracking-tight">
          Checkup da Vida Financeira
        </h1>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-display text-foreground">Dashboard de Performance</h2>
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

        {/* Offer Filter */}
        <OfferFilter selected={offer} onChange={setOffer} />

        {/* Date Filter */}
        <DateFilter dateFrom={dateFrom} dateTo={dateTo} onDateChange={handleDateChange} />

        {/* KPIs */}
        <KPICards
          data={summary}
          isLoading={loadingSummary}
          comparison7d={comparison7d}
          comparison14d={comparison14d}
          trafficDaily={sparklineData}
          salesDaily={sparklineData === trafficDaily ? salesDaily : undefined}
          clientView={clientView}
        />

        {/* Charts Row */}
        {!clientView && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TrafficChart data={trafficDaily} salesData={salesDaily} isLoading={loadingTraffic} summaryData={summary} />
            <SalesChart data={salesDaily} isLoading={loadingSales} />
          </div>
        )}
        {clientView && (
          <SalesChart data={salesDaily} isLoading={loadingSales} />
        )}

        {/* Revenue vs Spend */}
        <RevenueVsSpendChart
          trafficData={trafficDaily}
          salesData={salesDaily}
          isLoading={loadingTraffic || loadingSales}
          clientView={clientView}
        />

        {!clientView && (
          <>
            {/* Products Table */}
            <ProductsTable data={summary} isLoading={loadingSummary} />

            {/* Campaigns Table */}
            <CampaignsTable data={campaigns} isLoading={loadingCampaigns} />

            {/* Creatives Table */}
            <CreativesTable data={ads} isLoading={loadingAds} />
          </>
        )}
      </div>
    </div>
  );
};

export default Index;
