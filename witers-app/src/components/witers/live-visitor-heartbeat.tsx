import { useEffect } from "react";

// Fires a lightweight "still here" ping on mount and every 5s, from every
// page — public site or panel, logged in or not (see
// /api/visitor-heartbeat) — powering the admin "Indicadores" panel's
// near-real-time visitor list and session-duration numbers. Mounted once
// at the root (see __root.tsx), not tied to any single route, so it
// covers the whole site without every page needing its own copy. Reads
// window.location.pathname fresh on every tick rather than once, so it
// still reflects the current page after a client-side route change.
//
// Skips the ping while the tab is hidden (backgrounded, minimized, or
// another tab is focused) — a setInterval keeps firing even for a tab
// nobody is looking at, and without this an admin tab left open for
// hours reads as one continuous multi-hour "session" instead of the
// gap it actually was. Pinging immediately on becoming visible again
// keeps the "hace" column from lagging behind a long background stint.
export function LiveVisitorHeartbeat() {
  useEffect(() => {
    function ping() {
      if (document.visibilityState !== "visible") return;
      void fetch("/api/visitor-heartbeat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: window.location.pathname }),
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
  }, []);

  return null;
}
