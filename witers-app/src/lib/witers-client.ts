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
    video_requests_quota: number;
    video_requests_used: number;
    carousel_requests_quota: number;
    carousel_requests_used: number;
    activated_at: string | null;
  } | null;
};

export async function fetchMe(): Promise<Me | null> {
  try {
    // A plain fetch() has no built-in timeout — on a weak/flaky connection
    // (bad signal, captive network) the request can just sit there forever,
    // never resolving or rejecting. Nothing about that is visible to
    // react-query, so `isLoading` never turns off and the panel is stuck on
    // its loading skeleton with no way out. Aborting after 10s turns that
    // stall into a normal failure, which falls through to the "inicia
    // sesión" screen below instead of hanging indefinitely.
    const res = await fetch("/api/auth/me", {
      credentials: "include",
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 401) return null;
    if (!res.ok) return null;
    return (await res.json()) as Me;
  } catch {
    return null;
  }
}

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: fetchMe, staleTime: 15_000 });
}
