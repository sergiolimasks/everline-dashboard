import { useQuery } from "@tanstack/react-query";
import { fetchSummary, fetchTrafficDaily, fetchSalesDaily, fetchCampaigns } from "@/lib/dashboard-api";

export function useSummary(dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['summary', dateFrom, dateTo],
    queryFn: () => fetchSummary(dateFrom, dateTo),
    staleTime: 1000 * 60 * 5,
  });
}

export function useTrafficDaily(dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['traffic_daily', dateFrom, dateTo],
    queryFn: () => fetchTrafficDaily(dateFrom, dateTo),
    staleTime: 1000 * 60 * 5,
  });
}

export function useSalesDaily(dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['sales_daily', dateFrom, dateTo],
    queryFn: () => fetchSalesDaily(dateFrom, dateTo),
    staleTime: 1000 * 60 * 5,
  });
}

export function useCampaigns(dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['campaigns', dateFrom, dateTo],
    queryFn: () => fetchCampaigns(dateFrom, dateTo),
    staleTime: 1000 * 60 * 5,
  });
}
