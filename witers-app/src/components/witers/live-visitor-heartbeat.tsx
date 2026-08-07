import { useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";

// Fires a lightweight "still here" ping on mount, on every client-side
// route change, and every 5s in between — from every page (public site or
// panel, logged in or not; see /api/visitor-heartbeat) — powering the
// admin "Indicadores" panel's near-real-time visitor list, session
// duration, and (since the path itself is what /api/visitor-heartbeat
// diffs to log a page view) the "Páginas principales" list. Mounted once
// at the root (see __root.tsx), not tied to any single route, so it
// covers the whole site without every page needing its own copy. Keyed
// on the router's pathname (not read fresh inside the interval) so a
// navigation pings immediately instead of waiting up to 5s for the next
// tick — otherwise a quick click-through between pages could go
// uncounted as its own page view.
//
// Skips the ping while the tab is hidden (backgrounded, minimized, or
// another tab is focused) — a setInterval keeps firing even for a tab
// nobody is looking at, and without this an admin tab left open for
// hours reads as one continuous multi-hour "session" instead of the
// gap it actually was. Pinging immediately on becoming visible again
// keeps the "hace" column from lagging behind a long background stint.
export function LiveVisitorHeartbeat() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    function ping() {
      if (document.visibilityState !== "visible") return;
      void fetch("/api/visitor-heartbeat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: pathname }),
        credentials: "include",
        keepalive: true,
      }).catch(() => {});
    }
    ping();
    const interval = setInterval(ping, 5_000);
    document.addEventListener("visibilitychange", ping);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", ping);
    };
  }, [pathname]);

  return null;
}
