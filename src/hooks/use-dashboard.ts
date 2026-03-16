import { useQuery } from "@tanstack/react-query";
import { fetchSummary, fetchTrafficDaily, fetchSalesDaily, fetchCampaigns, fetchAds } from "@/lib/dashboard-api";
import { formatDateString } from "@/lib/date-utils";

export function useSummary(dateFrom?: string, dateTo?: string, offer?: string) {
  return useQuery({
    queryKey: ['summary', dateFrom, dateTo, offer],
    queryFn: () => fetchSummary(dateFrom, dateTo, offer),
    staleTime: 1000 * 60 * 5,
  });
}

export function useComparison7d(dateFrom?: string, dateTo?: string, offer?: string) {
  const enabled = !!dateFrom && !!dateTo;
  const to7 = new Date();
  to7.setDate(to7.getDate() - 7);
  const from7 = new Date();
  from7.setDate(from7.getDate() - 14);

  return useQuery({
    queryKey: ['summary_7d_prev', formatDateString(from7), formatDateString(to7), offer],
    queryFn: () => fetchSummary(formatDateString(from7), formatDateString(to7), offer),
    staleTime: 1000 * 60 * 10,
    enabled,
  });
}

export function useComparison14d(dateFrom?: string, dateTo?: string, offer?: string) {
  const enabled = !!dateFrom && !!dateTo;
  const to14 = new Date();
  to14.setDate(to14.getDate() - 14);
  const from14 = new Date();
  from14.setDate(from14.getDate() - 28);

  return useQuery({
    queryKey: ['summary_14d_prev', formatDateString(from14), formatDateString(to14), offer],
    queryFn: () => fetchSummary(formatDateString(from14), formatDateString(to14), offer),
    staleTime: 1000 * 60 * 10,
    enabled,
  });
}

export function useSparklineTraffic(dateFrom?: string, offer?: string) {
  const enabled = !!dateFrom;
  const end = new Date(dateFrom || '');
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - 29);

  return useQuery({
    queryKey: ['sparkline_traffic', formatDateString(start), formatDateString(end), offer],
    queryFn: () => fetchTrafficDaily(formatDateString(start), formatDateString(end), offer),
    staleTime: 1000 * 60 * 10,
    enabled,
  });
}

export function useTrafficDaily(dateFrom?: string, dateTo?: string, offer?: string) {
  return useQuery({
    queryKey: ['traffic_daily', dateFrom, dateTo, offer],
    queryFn: () => fetchTrafficDaily(dateFrom, dateTo, offer),
    staleTime: 1000 * 60 * 5,
  });
}

export function useSalesDaily(dateFrom?: string, dateTo?: string, offer?: string) {
  return useQuery({
    queryKey: ['sales_daily', dateFrom, dateTo, offer],
    queryFn: () => fetchSalesDaily(dateFrom, dateTo, offer),
    staleTime: 1000 * 60 * 5,
  });
}

export function useCampaigns(dateFrom?: string, dateTo?: string, offer?: string) {
  return useQuery({
    queryKey: ['campaigns', dateFrom, dateTo, offer],
    queryFn: () => fetchCampaigns(dateFrom, dateTo, offer),
    staleTime: 1000 * 60 * 5,
  });
}
