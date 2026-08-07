// Fire-and-forget CTA click tracking for the admin "Indicadores" panel's
// "Clics principales" list — writes to the same site_events log the
// WhatsApp button already uses (see /api/track-event), just with type
// 'cta_click' and a human label instead of a fixed type per button.
export function trackCtaClick(label: string) {
  fetch("/api/track-event", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "cta_click", label, path: window.location.pathname }),
    keepalive: true,
  }).catch(() => {});
}
