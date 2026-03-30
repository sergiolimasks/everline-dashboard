import { useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSummary, useTrafficDaily, useSalesDaily, useCampaigns, useAds, useComparison7d, useComparison14d, useSparklineTraffic, useSparklineSales, useAttribution } from "@/hooks/use-dashboard";
import { usePageScroll, usePageState } from "@/hooks/use-page-state";
import { formatDateString, getWeekStart } from "@/lib/date-utils";
import { KPICards } from "@/components/dashboard/KPICards";
import { TrafficChart } from "@/components/dashboard/TrafficChart";
import { SalesChart } from "@/components/dashboard/SalesChart";
import { RevenueVsSpendChart } from "@/components/dashboard/RevenueVsSpendChart";
import { ProductsTable } from "@/components/dashboard/ProductsTable";
import { CampaignsTable } from "@/components/dashboard/CampaignsTable";
import { CreativesTable } from "@/components/dashboard/CreativesTable";
import { AttributionTable } from "@/components/dashboard/AttributionTable";
import { DateFilter } from "@/components/dashboard/DateFilter";
import { OfferFilter, type OfferType } from "@/components/dashboard/OfferFilter";
import { ArrowLeft, BarChart3, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

export interface ProjectDashboardConfig {
  project: string;
  title: string;
  showOfferFilter: boolean;
  showCustoConsultas: boolean;
  showManychat: boolean;
  showLeads: boolean;
  weekStartDay: number; // 0=Sun, 3=Wed, etc.
  offerOptions?: { value: string; label: string }[];
}

const PROJECT_CONFIGS: Record<string, ProjectDashboardConfig> = {
  checkup: {
    project: 'checkup',
    title: 'Checkup da Vida Financeira',
    showOfferFilter: true,
    showCustoConsultas: true,
    showManychat: true,
    showLeads: false,
    weekStartDay: 0, // Sunday
  },
  'formacao-consultor': {
    project: 'formacao-consultor',
    title: 'Formação Consultor 360',
    showOfferFilter: true,
    showCustoConsultas: false,
    showManychat: false,
    showLeads: true,
    weekStartDay: 3, // Wednesday
    offerOptions: [
      { value: 'all', label: 'Todas Campanhas' },
      { value: 'aplicacao', label: 'Aplicação' },
      { value: '50k', label: 'Lançamento 50K' },
      { value: 'presencial', label: 'Presencial' },
      { value: 'rmkt', label: 'RMKT Formação' },
    ],
  },
};

interface IndexProps {
  clientView?: boolean;
  projectKey?: string;
}

const Index = ({ clientView = false, projectKey = 'checkup' }: IndexProps) => {
  const { isGestor } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { slug } = useParams();
  const hideCoProdutor = isGestor && !clientView;
  const config = PROJECT_CONFIGS[projectKey] || PROJECT_CONFIGS['checkup'];
  const today = new Date();
  const stateKey = `report:${location.pathname}`;

  const defaultDateFrom = clientView
    ? formatDateString(new Date(today.getFullYear(), today.getMonth(), 1))
    : formatDateString(getWeekStart(today, config.weekStartDay));
  const defaultPreset = clientView ? 'Este mês' : 'Esta semana';

  const [filters, setFilters] = usePageState(stateKey, {
    dateFrom: defaultDateFrom,
    dateTo: formatDateString(today),
    offer: 'all' as OfferType,
    activePreset: defaultPreset as string | null,
  });
  const { dateFrom, dateTo, offer, activePreset } = filters;

  const queryClient = useQueryClient();

  const periodDays = Math.round((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const chartDateFrom = periodDays <= 3
    ? formatDateString(new Date(new Date(dateTo).getTime() - 6 * 24 * 60 * 60 * 1000))
    : dateFrom;

  const offerParam = config.showOfferFilter ? offer : undefined;

  const { data: summary, isLoading: loadingSummary } = useSummary(dateFrom, dateTo, offerParam, config.project);
  const { data: comparison7d } = useComparison7d(dateFrom, dateTo, offerParam, config.project);
  const { data: comparison14d } = useComparison14d(dateFrom, dateTo, offerParam, config.project);
  const { data: sparklineTraffic } = useSparklineTraffic(dateTo, offerParam, config.project);
  const { data: sparklineSales } = useSparklineSales(dateTo, offerParam, config.project);
  const { data: trafficDaily, isLoading: loadingTraffic } = useTrafficDaily(chartDateFrom, dateTo, offerParam, config.project);
  const { data: salesDaily, isLoading: loadingSales } = useSalesDaily(chartDateFrom, dateTo, offerParam, config.project);
  const { data: campaigns, isLoading: loadingCampaigns } = useCampaigns(dateFrom, dateTo, offerParam, config.project);
  const { data: ads, isLoading: loadingAds } = useAds(dateFrom, dateTo, offerParam, config.project);
  const { data: attribution, isLoading: loadingAttribution } = useAttribution(dateFrom, dateTo, offerParam, config.project, config.showLeads);
  const sparklineData = periodDays > 30 ? trafficDaily : sparklineTraffic;
  const sparklineSalesData = periodDays > 30 ? salesDaily : sparklineSales;

  const handleDateChange = (from: string, to: string) => {
    setFilters((current) => ({ ...current, dateFrom: from, dateTo: to }));
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries();
  };

  usePageScroll(stateKey, !loadingSummary && !loadingTraffic && !loadingSales && !loadingCampaigns && !loadingAds && !loadingAttribution);

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Back Button + Page Title */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(clientView && slug ? `/cliente/${slug}/painel` : '/painel')} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl md:text-4xl font-bold font-display text-primary tracking-tight">
            {config.title}
          </h1>
        </div>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-display text-foreground">Dashboard de Performance</h2>
              <p className="text-sm text-muted-foreground">Tráfego Meta Ads × Vendas</p>
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
        {config.showOfferFilter && (
          <OfferFilter
            selected={offer}
            onChange={(nextOffer) => setFilters((current) => ({ ...current, offer: nextOffer }))}
            options={config.offerOptions}
          />
        )}

        {/* Date Filter */}
        <DateFilter
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateChange={handleDateChange}
          weekStartDay={config.weekStartDay}
          activePreset={activePreset}
          onActivePresetChange={(preset) => setFilters((current) => ({ ...current, activePreset: preset }))}
        />

        {/* KPIs */}
        <KPICards
          data={summary}
          isLoading={loadingSummary}
          comparison7d={comparison7d}
          comparison14d={comparison14d}
          trafficDaily={sparklineData}
          salesDaily={sparklineSalesData}
          isSingleDay={periodDays === 1}
          dateFrom={dateFrom}
          dateTo={dateTo}
          clientView={clientView}
          showLeads={config.showLeads}
          hideCoProdutor={hideCoProdutor}
        />

        {/* Charts Row */}
        {!clientView && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TrafficChart data={trafficDaily} salesData={salesDaily} isLoading={loadingTraffic} summaryData={summary} showLeads={config.showLeads} dateFrom={dateFrom} dateTo={dateTo} />
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
          showLeads={config.showLeads}
          hideCoProdutor={hideCoProdutor}
        />

        {!clientView && (
          <>
            {/* Attribution Table (leads projects only) */}
            {config.showLeads && (
              <AttributionTable data={attribution} isLoading={loadingAttribution} />
            )}

            {/* Products Table */}
            <ProductsTable data={summary} isLoading={loadingSummary} allPrincipal={config.showLeads} />

            {/* Campaigns Table */}
            <CampaignsTable data={campaigns} isLoading={loadingCampaigns} showLeads={config.showLeads} />

            {/* Creatives Table */}
            <CreativesTable data={ads} isLoading={loadingAds} showLeads={config.showLeads} />
          </>
        )}
      </div>
    </div>
  );
};

export default Index;
