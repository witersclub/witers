import { useEffect } from "react";

// Fires a lightweight "still here" ping on mount and every 5s, from every
// page — public site or panel, logged in or not (see
// /api/visitor-heartbeat) — powering the admin "En vivo" panel's
// near-real-time visitor list. Mounted once at the root (see
// __root.tsx), not tied to any single route, so it covers the whole
// site without every page needing its own copy. Reads
// window.location.pathname fresh on every tick rather than once, so it
// still reflects the current page after a client-side route change.
export function LiveVisitorHeartbeat() {
  useEffect(() => {
    function ping() {
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
    return () => clearInterval(interval);
  }, []);

  return null;
}
