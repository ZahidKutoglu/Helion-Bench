import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "../lib/api";

export function useReadyHealth() {
  return useQuery({
    queryKey: ["health", "ready"],
    queryFn: () => fetchJson("/health/ready"),
    refetchInterval: 10000,
    retry: 1,
  });
}

export function useApiHealth() {
  return useQuery({
    queryKey: ["health", "api"],
    queryFn: () => fetchJson("/health"),
    refetchInterval: 10000,
    retry: 1,
  });
}

export function useDatabaseHealth() {
  return useQuery({
    queryKey: ["health", "database"],
    queryFn: () => fetchJson("/health/database"),
    refetchInterval: 10000,
    retry: 1,
  });
}

export function useQdrantHealth() {
  return useQuery({
    queryKey: ["health", "qdrant"],
    queryFn: () => fetchJson("/health/qdrant"),
    refetchInterval: 10000,
    retry: 1,
  });
}

export function useSystemInfo() {
  return useQuery({
    queryKey: ["system", "info"],
    queryFn: () => fetchJson("/api/v1/system/info"),
    retry: 1,
  });
}

export function summarizeReady(result) {
  if (result.isPending) {
    return { label: "Checking systems", tone: "neutral" };
  }
  if (result.isError || !result.data) {
    return { label: "API unreachable", tone: "bad" };
  }
  if (result.data.ok && result.data.data?.status === "ok") {
    return { label: "Systems ready", tone: "ok" };
  }
  return { label: "Degraded", tone: "warn" };
}
