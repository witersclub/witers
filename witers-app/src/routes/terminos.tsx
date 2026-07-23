import { createFileRoute } from "@tanstack/react-router";

import { SiteFooter, SiteHeader } from "../components/witers/chrome";
import { useLanguage } from "../lib/i18n";

export const Route = createFileRoute("/terminos")({
  head: () => ({
    meta: [
      { title: "Términos y condiciones. WITERS" },
      {
        name: "description",
        content: "Términos y condiciones de las membresías y servicios de WITERS.",
      },
    ],
  }),
  component: Terminos,
});

type Seccion = {
  title: { es: string; en: string };
  body: { es: React.ReactNode; en: React.ReactNode };
};

const SECCIONES: Seccion[] = [
  {
    title: { es: "1. Vigencia de la promoción", en: "1. Promotion validity" },
    body: {
      es: (
        <ul className="list-disc space-y-2 pl-5">
          <li>
            El 30% de descuento aplica únicamente durante los primeros 3 meses consecutivos de
            suscripción.
          </li>
          <li>
            A partir del cuarto mes, la mensualidad se cobrará al precio regular vigente del paquete
            contratado.
          </li>
        </ul>
      ),
      en: (
        <ul className="list-disc space-y-2 pl-5">
          <li>
            The 30% discount applies only during the first 3 consecutive months of the subscription.
          </li>
          <li>
            Starting the fourth month, the monthly fee will be charged at the regular price
            currently in effect for the contracted package.
          </li>
        </ul>
      ),
    },
  },
  {
    title: { es: "2. Precios", en: "2. Pricing" },
    body: {
      es: <p>Todos los precios publicados son más IVA.</p>,
      en: <p>All published prices are subject to applicable taxes (VAT).</p>,
    },
  },
  {
    title: { es: "3. Contratación por marca", en: "3. Contracting per brand" },
    body: {
      es: (
        <>
          <p>Cada paquete incluye servicios para una sola marca o empresa.</p>
          <p className="mt-3">
            Si el cliente desea trabajar una segunda marca, será necesario contratar un paquete
            adicional o solicitar una cotización personalizada.
          </p>
        </>
      ),
      en: (
        <>
          <p>Each package includes services for a single brand or company.</p>
          <p className="mt-3">
            If the client wishes to work with a second brand, an additional package must be
            contracted or a personalized quote requested.
          </p>
        </>
      ),
    },
  },
  {
    title: {
      es: "4. Material proporcionado por el cliente",
      en: "4. Material provided by the client",
    },
    body: {
      es: (
        <>
          <p>Antes de iniciar el proyecto, el cliente deberá proporcionar:</p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Logotipo en formato editable o alta resolución.</li>
            <li>Manual de identidad (si cuenta con él).</li>
            <li>Colores y tipografías corporativas (si existen).</li>
            <li>Información de contacto.</li>
            <li>Redes sociales.</li>
            <li>Página web (si aplica).</li>
            <li>Fotografías, videos o material propio que desee utilizar.</li>
          </ul>
        </>
      ),
      en: (
        <>
          <p>Before starting the project, the client must provide:</p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Logo in editable format or high resolution.</li>
            <li>Brand identity manual (if available).</li>
            <li>Corporate colors and typefaces (if any).</li>
            <li>Contact information.</li>
            <li>Social media accounts.</li>
            <li>Website (if applicable).</li>
            <li>Photographs, videos, or other own material to be used.</li>
          </ul>
        </>
      ),
    },
  },
  {
    title: { es: "5. Solicitudes de diseño", en: "5. Design requests" },
    body: {
      es: (
        <>
          <p>Todas las solicitudes deberán realizarse a través del panel de clientes de WITERS.</p>
          <p className="mt-3">
            Cada solicitud deberá incluir la información necesaria para su correcta ejecución, como:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Objetivo de la pieza.</li>
            <li>Texto o copy.</li>
            <li>Fecha de publicación.</li>
            <li>Referencias (opcional).</li>
            <li>Medidas o formato requerido.</li>
          </ul>
        </>
      ),
      en: (
        <>
          <p>All requests must be made through the WITERS client panel.</p>
          <p className="mt-3">
            Each request must include the information necessary for its correct execution, such as:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Objective of the piece.</li>
            <li>Text or copy.</li>
            <li>Publication date.</li>
            <li>References (optional).</li>
            <li>Required dimensions or format.</li>
          </ul>
        </>
      ),
    },
  },
  {
    title: { es: "6. Revisión de diseños", en: "6. Design revisions" },
    body: {
      es: (
        <>
          <p>Cada diseño incluye el número de revisiones indicado en el paquete contratado.</p>
          <p className="mt-3">
            Las modificaciones adicionales podrán generar un costo extra (descuento de 1 solicitud).
          </p>
        </>
      ),
      en: (
        <>
          <p>Each design includes the number of revisions specified in the contracted package.</p>
          <p className="mt-3">
            Additional modifications may incur an extra cost (deducted as 1 request).
          </p>
        </>
      ),
    },
  },
  {
    title: { es: "7. Solicitudes mensuales", en: "7. Monthly requests" },
    body: {
      es: (
        <>
          <p>Las solicitudes incluidas en cada plan son mensuales.</p>
          <p className="mt-3">
            Las solicitudes no utilizadas durante el mes no son acumulables para meses posteriores.
          </p>
        </>
      ),
      en: (
        <>
          <p>The requests included in each plan are monthly.</p>
          <p className="mt-3">
            Requests not used during the month cannot be carried over to subsequent months.
          </p>
        </>
      ),
    },
  },
  {
    title: { es: "8. Tiempo de respuesta", en: "8. Response time" },
    body: {
      es: (
        <>
          <p>
            Los tiempos de entrega comienzan una vez que el cliente proporciona toda la información
            necesaria.
          </p>
          <p className="mt-3">Las solicitudes incompletas pueden retrasar la entrega.</p>
        </>
      ),
      en: (
        <>
          <p>Delivery times begin once the client has provided all the necessary information.</p>
          <p className="mt-3">Incomplete requests may delay delivery.</p>
        </>
      ),
    },
  },
  {
    title: { es: "9. Campañas publicitarias", en: "9. Advertising campaigns" },
    body: {
      es: (
        <>
          <p>
            La creación y configuración de campañas está incluida de acuerdo con el paquete
            contratado.
          </p>
          <p className="mt-3">
            El presupuesto destinado a Meta Ads, Google Ads u otras plataformas publicitarias no
            está incluido y será cubierto directamente por el cliente.
          </p>
        </>
      ),
      en: (
        <>
          <p>
            The creation and setup of campaigns is included according to the contracted package.
          </p>
          <p className="mt-3">
            The budget allocated to Meta Ads, Google Ads, or other advertising platforms is not
            included and will be covered directly by the client.
          </p>
        </>
      ),
    },
  },
  {
    title: { es: "10. Propiedad del contenido", en: "10. Content ownership" },
    body: {
      es: (
        <>
          <p>
            Una vez liquidados los servicios correspondientes, el cliente podrá utilizar los diseños
            desarrollados para su marca.
          </p>
          <p className="mt-3">
            WITERS podrá mostrar los proyectos realizados dentro de su portafolio, redes sociales y
            materiales promocionales, salvo que ambas partes acuerden por escrito lo contrario.
          </p>
        </>
      ),
      en: (
        <>
          <p>
            Once the corresponding services have been paid in full, the client may use the designs
            developed for its brand.
          </p>
          <p className="mt-3">
            WITERS may showcase completed projects within its portfolio, social media, and
            promotional materials, unless both parties agree otherwise in writing.
          </p>
        </>
      ),
    },
  },
  {
    title: { es: "11. Cancelaciones", en: "11. Cancellations" },
    body: {
      es: (
        <>
          <p>
            Los planes de WITERS funcionan bajo un esquema de suscripción mensual con renovación
            automática.
          </p>
          <p className="mt-3">
            El cliente podrá solicitar la cancelación de su suscripción en cualquier momento, sin
            penalización.
          </p>
          <p className="mt-3">
            La cancelación será efectiva al finalizar el periodo mensual ya pagado, por lo que no se
            realizarán reembolsos totales ni parciales de mensualidades ya cobradas,
            independientemente del uso que se haya dado al servicio.
          </p>
          <p className="mt-3">
            Una vez concluido el periodo vigente, la suscripción quedará cancelada y no se
            realizarán cargos adicionales.
          </p>
        </>
      ),
      en: (
        <>
          <p>WITERS plans operate under a monthly subscription scheme with automatic renewal.</p>
          <p className="mt-3">
            The client may request cancellation of their subscription at any time, without penalty.
          </p>
          <p className="mt-3">
            Cancellation will take effect at the end of the already-paid monthly period, so no full
            or partial refunds will be issued for monthly fees already charged, regardless of how
            much the service was used.
          </p>
          <p className="mt-3">
            Once the current period ends, the subscription will be cancelled and no additional
            charges will be made.
          </p>
        </>
      ),
    },
  },
  {
    title: { es: "12. Renovación automática", en: "12. Automatic renewal" },
    body: {
      es: (
        <>
          <p>
            La suscripción se renovará automáticamente al finalizar cada periodo mensual, utilizando
            el método de pago registrado por el cliente.
          </p>
          <p className="mt-3">
            Si el cliente no desea continuar con el servicio, deberá solicitar la cancelación antes
            de la fecha de renovación para evitar el cargo correspondiente al siguiente periodo.
          </p>
        </>
      ),
      en: (
        <>
          <p>
            The subscription will renew automatically at the end of each monthly period, using the
            payment method on file for the client.
          </p>
          <p className="mt-3">
            If the client does not wish to continue with the service, cancellation must be requested
            before the renewal date to avoid the charge for the following period.
          </p>
        </>
      ),
    },
  },
  {
    title: { es: "13. Suspensión del servicio", en: "13. Service suspension" },
    body: {
      es: (
        <p>
          Si el cliente no envía solicitudes o información durante el periodo contratado, el
          servicio continuará vigente y el mes se considerará consumido.
        </p>
      ),
      en: (
        <p>
          If the client does not submit requests or information during the contracted period, the
          service will remain active and the month will be considered used.
        </p>
      ),
    },
  },
  {
    title: { es: "14. Comunicación", en: "14. Communication" },
    body: {
      es: (
        <p>
          Toda la comunicación oficial se realizará mediante los canales autorizados por WITERS y/o
          a través del panel de clientes.
        </p>
      ),
      en: (
        <p>
          All official communication will take place through the channels authorized by WITERS
          and/or through the client panel.
        </p>
      ),
    },
  },
];

function Terminos() {
  const { t, lang } = useLanguage();

  return (
    <div className="wit-page min-h-dvh overflow-x-clip">
      <SiteHeader />

      <section className="relative pb-16 pt-32 md:pb-20 md:pt-40">
        <div className="mx-auto max-w-3xl px-5 md:px-[110px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-wit-blue/25 bg-wit-mist/40 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.22em] text-wit-blue">
            {t("Paquetes WITERS", "WITERS Packages")}
          </span>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tighter text-wit-ink md:text-5xl">
            {t("Términos y", "Terms and")}{" "}
            <span className="wit-underline text-wit-blue">{t("condiciones", "conditions")}</span>
          </h1>
          <p className="mt-5 text-base leading-relaxed text-wit-gray">
            {t(
              "Estos términos aplican a la promoción de julio 2026 y a las membresías Essential, Grow y Scale de WITERS. Al aceptar los términos y condiciones al registrarte, confirmas que los leíste y estás de acuerdo con ellos.",
              "These terms apply to the July 2026 promotion and to the WITERS Essential, Grow, and Scale memberships. By accepting the terms and conditions when you sign up, you confirm that you have read them and agree to them.",
            )}
          </p>
        </div>
      </section>

      <section className="relative bg-white pb-24">
        <div className="mx-auto max-w-3xl divide-y divide-wit-ink/10 border-y border-wit-ink/10 px-5 md:px-[110px]">
          {SECCIONES.map((s) => (
            <div key={s.title.es} className="py-8">
              <h2 className="text-lg font-bold text-wit-ink">{t(s.title.es, s.title.en)}</h2>
              <div className="mt-3 space-y-1 text-[15px] leading-relaxed text-wit-gray">
                {lang === "en" ? s.body.en : s.body.es}
              </div>
            </div>
          ))}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
