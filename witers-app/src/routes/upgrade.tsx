import { createFileRoute, Link } from "@tanstack/react-router";

import { WitersLogo } from "../components/witers/brand";
import { MembershipPlanCards } from "../components/witers/membership-cards";
import { useMe } from "../lib/witers-client";

export const Route = createFileRoute("/upgrade")({
  head: () => ({
    meta: [
      { title: "Mejora tu plan. WITERS" },
      { name: "description", content: "Compara y cambia entre los planes de membresía WITERS." },
    ],
  }),
  component: Upgrade,
});

// Deliberately just the 3 fichas — no hero, no testimonios, no FAQ. A
// member who already knows WITERS and wants to see the plans side by side
// shouldn't have to scroll through the homepage's marketing pitch again.
function Upgrade() {
  const me = useMe();

  if (me.isLoading) {
    return (
      <div className="wit-page flex min-h-dvh items-center justify-center">
        <div className="h-40 w-full max-w-md animate-pulse rounded-3xl bg-wit-mist/40" />
      </div>
    );
  }

  if (!me.data?.ok) {
    return (
      <div className="wit-page flex min-h-dvh flex-col items-center justify-center gap-5 px-5 text-center">
        <WitersLogo />
        <p className="max-w-sm text-base text-wit-gray">
          Ingresa a tu cuenta para ver y cambiar tu plan.
        </p>
        <Link
          to="/ingresar"
          className="rounded-full bg-wit-blue px-6 py-3 text-sm font-bold text-white hover:bg-wit-blue-deep"
        >
          Ingresar
        </Link>
      </div>
    );
  }

  const currentPlanId = me.data.membership?.status === "active" ? me.data.membership.plan : null;

  return (
    <div className="wit-page min-h-dvh bg-wit-navy">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6">
        <Link to="/">
          <WitersLogo />
        </Link>
        <Link to="/panel" className="wit-navlink text-sm font-medium text-white/80">
          Volver a mi panel
        </Link>
      </div>

      <main className="px-5 pb-24 pt-8 md:px-[110px]">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-extrabold tracking-tighter text-white md:text-5xl">
            {currentPlanId ? "Mejora tu plan" : "Elige tu plan"}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-white/70">
            {currentPlanId
              ? "Más solicitudes, más carruseles y videos, más campañas — cambia cuando quieras, sin perder lo que ya tienes usado este mes."
              : "Elige el nivel de acompañamiento que tu marca necesita."}
          </p>
        </div>

        <MembershipPlanCards
          ctaFor={(m) => {
            if (m.id === currentPlanId) {
              return { to: "", label: "Tu plan actual", disabled: true };
            }
            return {
              to: "/checkout",
              search: { plan: m.id },
              label: currentPlanId ? `Cambiar a ${m.nombre}` : `Quiero ${m.nombre}`,
            };
          }}
        />
      </main>
    </div>
  );
}
