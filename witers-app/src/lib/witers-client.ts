// Client helpers for WITERS member auth state.
import { useQuery } from "@tanstack/react-query";

export type Me = {
  ok: boolean;
  user?: { id: string; email: string; name: string; role: string; created_at: string };
  membership?: {
    id: string;
    status: string;
    plan: string;
    price_mxn: number;
    requests_quota: number;
    requests_used: number;
    bonus_requests_quota: number;
    activated_at: string | null;
  } | null;
};

export async function fetchMe(): Promise<Me | null> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (res.status === 401) return null;
  if (!res.ok) return null;
  return (await res.json()) as Me;
}

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: fetchMe, staleTime: 15_000 });
}
