import { createFileRoute } from "@tanstack/react-router";

import { SiteFooter, SiteHeader } from "../components/witers/chrome";
import { useLanguage } from "../lib/i18n";

// A "data deletion instructions" page, not a self-service delete button on
// purpose — a WITERS account has real business records tied to it
// (payments, delivered pieces, campaign history), so deletion is handled
// by a person, not an automatic callback that could fire from an
// unrelated action (e.g. someone just disconnecting Facebook from their
// own settings, not actually asking to lose their WITERS history).
// Meta accepts this URL as a substitute for a Data Deletion Callback URL
// in the Facebook Login product settings.
export const Route = createFileRoute("/eliminar-datos")({
  head: () => ({
    meta: [
      { title: "Eliminar mis datos. WITERS" },
      {
        name: "description",
        content: "Cómo solicitar la eliminación de tus datos personales en WITERS.",
      },
    ],
  }),
  component: EliminarDatos,
});

function EliminarDatos() {
  const { t } = useLanguage();

  return (
    <div className="wit-page min-h-dvh overflow-x-clip">
      <SiteHeader />

      <section className="relative pb-16 pt-32 md:pb-20 md:pt-40">
        <div className="mx-auto max-w-3xl px-5 md:px-[110px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-wit-blue/25 bg-wit-mist/40 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.22em] text-wit-blue">
            {t("WITERS", "WITERS")}
          </span>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tighter text-wit-ink md:text-5xl">
            {t("Eliminar mis", "Delete my")}{" "}
            <span className="wit-underline text-wit-blue">{t("datos", "data")}</span>
          </h1>
          <p className="mt-5 text-base leading-relaxed text-wit-gray">
            {t(
              "Puedes pedirnos en cualquier momento que eliminemos tus datos personales de WITERS, incluidos los que se hayan creado a partir de tu inicio de sesión con Facebook o Google.",
              "You can ask us at any time to delete your personal data from WITERS, including anything created from your Facebook or Google login.",
            )}
          </p>
        </div>
      </section>

      <section className="relative bg-white pb-24">
        <div className="mx-auto max-w-3xl divide-y divide-wit-ink/10 border-y border-wit-ink/10 px-5 md:px-[110px]">
          <div className="py-8">
            <h2 className="text-lg font-bold text-wit-ink">
              {t("1. Cómo pedirlo", "1. How to request it")}
            </h2>
            <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-wit-gray">
              <p>
                {t("Escríbenos a", "Email us at")}{" "}
                <a
                  href="mailto:hola@witers.com?subject=Eliminar%20mis%20datos"
                  className="font-semibold text-wit-blue"
                >
                  hola@witers.com
                </a>{" "}
                {t(
                  'desde el correo con el que te registraste, con el asunto "Eliminar mis datos".',
                  'from the email you registered with, using the subject "Delete my data".',
                )}
              </p>
              <p>
                {t(
                  "Si iniciaste sesión con Facebook y solo quieres desconectar esa cuenta (sin borrar tu cuenta de WITERS), puedes hacerlo directamente desde la configuración de tu cuenta de Facebook, en Aplicaciones y sitios web.",
                  "If you signed in with Facebook and only want to disconnect that account (without deleting your WITERS account), you can do that directly from your Facebook account settings, under Apps and Websites.",
                )}
              </p>
            </div>
          </div>

          <div className="py-8">
            <h2 className="text-lg font-bold text-wit-ink">
              {t("2. Qué pasa después", "2. What happens next")}
            </h2>
            <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-wit-gray">
              <p>
                {t(
                  "Confirmamos tu solicitud y eliminamos tus datos personales de nuestros sistemas en un plazo máximo de 30 días.",
                  "We confirm your request and delete your personal data from our systems within 30 days at most.",
                )}
              </p>
              <p>
                {t(
                  "Los registros que debamos conservar por obligaciones legales o fiscales (por ejemplo, facturas ya emitidas) se conservan el tiempo que exige la ley, y solo para ese fin.",
                  "Records we're legally or fiscally required to keep (e.g. invoices already issued) are kept for as long as the law requires, and only for that purpose.",
                )}
              </p>
            </div>
          </div>

          <div className="py-8">
            <h2 className="text-lg font-bold text-wit-ink">
              {t("3. Más información", "3. More information")}
            </h2>
            <div className="mt-3 space-y-1 text-[15px] leading-relaxed text-wit-gray">
              <p>
                {t("Consulta también nuestro", "You can also see our")}{" "}
                <a href="/privacidad" className="font-semibold text-wit-blue underline">
                  {t("aviso de privacidad", "privacy notice")}
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
