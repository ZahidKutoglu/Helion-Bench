import { useQuery } from "@tanstack/react-query";
import { getHealth } from "../lib/api";

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
    refetchInterval: 10000,
    retry: 1,
  });
}

export function summarizeReady(result) {
  if (result.isPending) {
    return { label: "Checking systems", tone: "neutral" };
  }
  if (result.isError || !result.data) {
    return { label: "Store unavailable", tone: "bad" };
  }
  if (result.data.ready) {
    return { label: "Browser index ready", tone: "ok" };
  }
  return { label: "Degraded", tone: "warn" };
}
