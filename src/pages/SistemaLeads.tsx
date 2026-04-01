import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTrafficDaily, useCampaigns, useAds } from "@/hooks/use-dashboard";
import { usePageScroll, usePageState } from "@/hooks/use-page-state";
import { formatDateString, getWeekStart } from "@/lib/date-utils";
import { DateFilter } from "@/components/dashboard/DateFilter";
import { ArrowLeft, BarChart3, RefreshCw, Users, DollarSign, MousePointerClick, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import type { CampaignData, AdData, TrafficDaily } from "@/lib/dashboard-api";
import { SistemaKPICards } from "@/components/sistema/SistemaKPICards";
import { SistemaLeadsChart } from "@/components/sistema/SistemaLeadsChart";
import { SistemaCampaignsTable } from "@/components/sistema/SistemaCampaignsTable";
import { SistemaCreativesTable } from "@/components/sistema/SistemaCreativesTable";

const SUB_FILTERS = [
  { key: 'consulta-form', label: 'Consulta Form' },
  { key: 'consulta-quiz', label: 'Consulta Quiz' },
  { key: 'rating', label: 'Rating' },
  { key: 'limpa-nome', label: 'Limpa Nome' },
] as const;

const SistemaLeads = ({ clientView = false }: { clientView?: boolean }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const today = new Date();
  const stateKey = 'report:sistema-leads';

  const defaultDateFrom = formatDateString(getWeekStart(today, 0));

  const [filters, setFilters] = usePageState(stateKey, {
    dateFrom: defaultDateFrom,
    dateTo: formatDateString(today),
    activePreset: 'Esta semana' as string | null,
    selectedFilters: [] as string[],
  });

  const { dateFrom, dateTo, activePreset, selectedFilters } = filters;

  // Build offer param: if sub-filters selected, pass comma-separated; otherwise 'all'
  const offerParam = selectedFilters.length > 0 ? selectedFilters.join(',') : undefined;

  const periodDays = Math.round((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const chartDateFrom = periodDays <= 3
    ? formatDateString(new Date(new Date(dateTo).getTime() - 6 * 24 * 60 * 60 * 1000))
    : dateFrom;

  const { data: trafficDaily, isLoading: loadingTraffic } = useTrafficDaily(chartDateFrom, dateTo, offerParam, 'sistema-leads');
  const { data: campaigns, isLoading: loadingCampaigns } = useCampaigns(dateFrom, dateTo, offerParam, 'sistema-leads');
  const { data: ads, isLoading: loadingAds } = useAds(dateFrom, dateTo, offerParam, 'sistema-leads');

  // Compute KPIs from traffic daily data (filtered to selected period)
  const kpis = useMemo(() => {
    if (!trafficDaily) return null;
    const filtered = trafficDaily.filter(d => d.dia >= dateFrom && d.dia <= dateTo);
    return {
      totalLeads: filtered.reduce((s, d) => s + Number(d.leads || 0), 0),
      totalGasto: filtered.reduce((s, d) => s + Number(d.gasto || 0), 0),
      totalCliquesLink: filtered.reduce((s, d) => s + Number(d.cliques_link || 0), 0),
      totalImpressoes: filtered.reduce((s, d) => s + Number(d.impressoes || 0), 0),
      totalViewsPagina: filtered.reduce((s, d) => s + Number(d.views_pagina || 0), 0),
      totalCheckouts: filtered.reduce((s, d) => s + Number(d.checkouts || 0), 0),
    };
  }, [trafficDaily, dateFrom, dateTo]);

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
            Sistema — Venda de Leads
          </h1>
        </div>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-display text-foreground">Dashboard de Leads</h2>
              <p className="text-sm text-muted-foreground">Métricas de captação • Campanhas SISTEMA</p>
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

        {/* Sub-Filters (multi-select) */}
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
        <SistemaKPICards data={kpis} isLoading={loadingTraffic} />

        {/* Chart */}
        <SistemaLeadsChart data={trafficDaily} isLoading={loadingTraffic} dateFrom={dateFrom} dateTo={dateTo} />

        {/* Campaigns Table */}
        <SistemaCampaignsTable data={campaigns} isLoading={loadingCampaigns} />

        {/* Creatives Table */}
        <SistemaCreativesTable data={ads} isLoading={loadingAds} />
      </div>
    </div>
  );
};

export default SistemaLeads;
