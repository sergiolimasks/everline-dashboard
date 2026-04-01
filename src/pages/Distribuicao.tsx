import { useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTrafficDaily, useCampaigns, useAds } from "@/hooks/use-dashboard";
import { usePageScroll, usePageState } from "@/hooks/use-page-state";
import { formatDateString, getWeekStart } from "@/lib/date-utils";
import { DateFilter } from "@/components/dashboard/DateFilter";
import { ArrowLeft, Radio, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { DistribuicaoKPICards } from "@/components/distribuicao/DistribuicaoKPICards";
import { DistribuicaoChart } from "@/components/distribuicao/DistribuicaoChart";
import { DistribuicaoCampaignsTable } from "@/components/distribuicao/DistribuicaoCampaignsTable";
import { DistribuicaoCreativesTable } from "@/components/distribuicao/DistribuicaoCreativesTable";

const SUB_FILTERS = [
  { key: 'c1', label: 'C1 — Seguidores', description: 'Cliques e CPC' },
  { key: 'c2', label: 'C2 — Engajamento', description: 'TSR, Freq e CPM' },
  { key: 'c3', label: 'C3 — Depoimentos', description: 'TSR, Freq e CPM' },
] as const;

const Distribuicao = ({ clientView = false }: { clientView?: boolean }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const today = new Date();
  const stateKey = 'report:distribuicao';

  const defaultDateFrom = formatDateString(getWeekStart(today, 0));

  const [filters, setFilters] = usePageState(stateKey, {
    dateFrom: defaultDateFrom,
    dateTo: formatDateString(today),
    activePreset: 'Esta semana' as string | null,
    selectedFilters: [] as string[],
  });

  const { dateFrom, dateTo, activePreset, selectedFilters } = filters;

  const offerParam = selectedFilters.length > 0 ? selectedFilters.join(',') : undefined;

  const periodDays = Math.round((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const chartDateFrom = periodDays <= 3
    ? formatDateString(new Date(new Date(dateTo).getTime() - 6 * 24 * 60 * 60 * 1000))
    : dateFrom;

  const { data: trafficDaily, isLoading: loadingTraffic } = useTrafficDaily(chartDateFrom, dateTo, offerParam, 'distribuicao');
  const { data: campaigns, isLoading: loadingCampaigns } = useCampaigns(dateFrom, dateTo, offerParam, 'distribuicao');
  const { data: ads, isLoading: loadingAds } = useAds(dateFrom, dateTo, offerParam, 'distribuicao');

  const kpis = useMemo(() => {
    if (!campaigns || campaigns.length === 0) return null;
    return {
      totalGasto: campaigns.reduce((s, c) => s + Number(c.gasto || 0), 0),
      totalImpressoes: campaigns.reduce((s, c) => s + Number(c.impressoes || 0), 0),
      totalAlcance: campaigns.reduce((s, c) => s + Number(c.alcance || 0), 0),
      totalCliquesLink: campaigns.reduce((s, c) => s + Number(c.cliques || 0), 0),
      totalViews3s: campaigns.reduce((s, c) => s + Number(c.views_3s || 0), 0),
    };
  }, [campaigns]);

  const toggleFilter = (key: string) => {
    setFilters(current => {
      const current_ = current.selectedFilters || [];
      const next = current_.includes(key)
        ? current_.filter((k: string) => k !== key)
        : [...current_, key];
      return { ...current, selectedFilters: next };
    });
  };

  const handleDateChange = (from: string, to: string) => {
    setFilters(current => ({ ...current, dateFrom: from, dateTo: to }));
  };

  const handleRefresh = () => queryClient.invalidateQueries();

  usePageScroll(stateKey, !loadingTraffic && !loadingCampaigns && !loadingAds);

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Back + Title */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/painel')} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl md:text-4xl font-bold font-display text-primary tracking-tight">
            Distribuição
          </h1>
        </div>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Radio className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-display text-foreground">Dashboard de Distribuição</h2>
              <p className="text-sm text-muted-foreground">Campanhas Instagram • C1, C2 e C3</p>
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

        {/* Sub-Filters */}
        <div className="flex flex-wrap gap-2">
          {SUB_FILTERS.map(f => {
            const active = selectedFilters.includes(f.key);
            return (
              <button
                key={f.key}
                onClick={() => toggleFilter(f.key)}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all duration-200 ${
                  active
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                }`}
                title={f.description}
              >
                {f.label}
              </button>
            );
          })}
          {selectedFilters.length > 0 && (
            <button
              onClick={() => setFilters(c => ({ ...c, selectedFilters: [] }))}
              className="px-3 py-2 text-xs font-medium rounded-lg text-muted-foreground hover:text-foreground transition-colors"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {/* Date Filter */}
        <DateFilter
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateChange={handleDateChange}
          weekStartDay={0}
          activePreset={activePreset}
          onActivePresetChange={preset => setFilters(c => ({ ...c, activePreset: preset }))}
        />

        {/* KPIs */}
        <DistribuicaoKPICards data={kpis} isLoading={loadingCampaigns} clientView={clientView} campaigns={campaigns} />

        {/* Chart */}
        <DistribuicaoChart data={trafficDaily} isLoading={loadingTraffic} dateFrom={dateFrom} dateTo={dateTo} />

        {/* Campaigns Table */}
        {!clientView && <DistribuicaoCampaignsTable data={campaigns} isLoading={loadingCampaigns} />}

        {/* Creatives Table */}
        {!clientView && <DistribuicaoCreativesTable data={ads} isLoading={loadingAds} />}
      </div>
    </div>
  );
};

export default Distribuicao;
