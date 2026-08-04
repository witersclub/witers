import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteFooter, SiteHeader } from "../components/witers/chrome";
import { useLanguage } from "../lib/i18n";

export const Route = createFileRoute("/privacidad")({
  head: () => ({
    meta: [
      { title: "Aviso de privacidad. WITERS" },
      {
        name: "description",
        content: "Cómo WITERS recopila, usa y protege los datos de sus miembros.",
      },
    ],
  }),
  component: Privacidad,
});

type Seccion = {
  title: { es: string; en: string };
  body: { es: React.ReactNode; en: React.ReactNode };
};

const SECCIONES: Seccion[] = [
  {
    title: { es: "1. Quién trata tus datos", en: "1. Who processes your data" },
    body: {
      es: (
        <p>
          WITERS es responsable del tratamiento de los datos personales que recabamos a través de
          este sitio y del panel de clientes. Para cualquier duda sobre este aviso o tus datos,
          escríbenos a{" "}
          <a href="mailto:hola@witers.com" className="font-semibold text-wit-blue">
            hola@witers.com
          </a>
          .
        </p>
      ),
      en: (
        <p>
          WITERS is responsible for processing the personal data we collect through this site and
          the client panel. For any question about this notice or your data, write to us at{" "}
          <a href="mailto:hola@witers.com" className="font-semibold text-wit-blue">
            hola@witers.com
          </a>
          .
        </p>
      ),
    },
  },
  {
    title: { es: "2. Qué datos recopilamos", en: "2. What data we collect" },
    body: {
      es: (
        <ul className="list-disc space-y-2 pl-5">
          <li>Datos de cuenta: nombre, correo electrónico y contraseña (almacenada cifrada).</li>
          <li>
            Datos de marca: nombre de tu empresa, categoría de negocio, colores, logotipo, manual de
            marca y tipografías que subas o elijas de nuestra librería.
          </li>
          <li>
            Datos de tus solicitudes: brief, textos, fotos de referencia y demás material que nos
            proporciones para crear tus piezas.
          </li>
          <li>
            Si inicias sesión con Google o Facebook: tu nombre, correo y foto de perfil público
            asociados a esa cuenta.
          </li>
          <li>
            Si nos das el ID de tu cuenta publicitaria de Meta: los resultados de tus campañas
            (alcance, gasto, resultados) que consultamos a través de la API de Meta para
            mostrártelos en tu panel.
          </li>
          <li>
            Datos de pago: procesados directamente por Stripe — WITERS no almacena tu tarjeta.
          </li>
        </ul>
      ),
      en: (
        <ul className="list-disc space-y-2 pl-5">
          <li>Account data: name, email address, and password (stored encrypted).</li>
          <li>
            Brand data: your company name, business category, colors, logo, brand manual, and any
            fonts you upload or pick from our library.
          </li>
          <li>
            Data from your requests: brief, copy, reference photos, and any other material you give
            us to create your pieces.
          </li>
          <li>
            If you sign in with Google or Facebook: the name, email, and public profile photo tied
            to that account.
          </li>
          <li>
            If you give us your Meta ad account ID: your campaign results (reach, spend, results)
            that we pull via the Meta API to show in your panel.
          </li>
          <li>Payment data: handled directly by Stripe — WITERS never stores your card.</li>
        </ul>
      ),
    },
  },
  {
    title: { es: "3. Para qué usamos tus datos", en: "3. What we use your data for" },
    body: {
      es: (
        <ul className="list-disc space-y-2 pl-5">
          <li>Crear y entregar las piezas y campañas que solicitas.</li>
          <li>Procesar el cobro de tu membresía.</li>
          <li>Darte acceso y mantener tu sesión iniciada en el panel de clientes.</li>
          <li>Mostrarte los resultados de tus propias campañas publicitarias.</li>
          <li>Comunicarnos contigo sobre tus solicitudes, tu cuenta o tu membresía.</li>
        </ul>
      ),
      en: (
        <ul className="list-disc space-y-2 pl-5">
          <li>Create and deliver the pieces and campaigns you request.</li>
          <li>Process your membership payment.</li>
          <li>Give you access to and keep you signed in to the client panel.</li>
          <li>Show you the results of your own advertising campaigns.</li>
          <li>Communicate with you about your requests, account, or membership.</li>
        </ul>
      ),
    },
  },
  {
    title: { es: "4. Con quién compartimos datos", en: "4. Who we share data with" },
    body: {
      es: (
        <p>
          No vendemos tus datos. Los compartimos únicamente con los proveedores que necesitamos para
          operar el servicio: Stripe (pagos), Meta (inicio de sesión con Facebook y consulta de
          resultados de campañas cuando nos das acceso a tu cuenta publicitaria), Google (inicio de
          sesión con Google) y Cloudflare (alojamiento, base de datos y almacenamiento de archivos).
          Cada uno trata tus datos bajo su propia política de privacidad.
        </p>
      ),
      en: (
        <p>
          We don't sell your data. We only share it with the providers we need to run the service:
          Stripe (payments), Meta (Facebook Login and pulling campaign results once you grant us
          access to your ad account), Google (Google Login), and Cloudflare (hosting, database, and
          file storage). Each of them processes your data under its own privacy policy.
        </p>
      ),
    },
  },
  {
    title: { es: "5. Cuánto tiempo conservamos tus datos", en: "5. How long we keep your data" },
    body: {
      es: (
        <p>
          Conservamos tus datos mientras tu cuenta esté activa. Si cancelas tu membresía o pides que
          eliminemos tu cuenta, borramos tus datos salvo los que debamos conservar por obligaciones
          legales o fiscales (por ejemplo, registros de facturación).
        </p>
      ),
      en: (
        <p>
          We keep your data for as long as your account is active. If you cancel your membership or
          ask us to delete your account, we erase your data except what we're legally or fiscally
          required to keep (e.g. billing records).
        </p>
      ),
    },
  },
  {
    title: { es: "6. Tus derechos", en: "6. Your rights" },
    body: {
      es: (
        <p>
          Puedes pedirnos acceder, corregir o eliminar tus datos personales en cualquier momento
          escribiendo a{" "}
          <a href="mailto:hola@witers.com" className="font-semibold text-wit-blue">
            hola@witers.com
          </a>
          . Para instrucciones específicas sobre cómo eliminar tus datos, consulta nuestra página de{" "}
          <Link to="/eliminar-datos" className="font-semibold text-wit-blue underline">
            eliminación de datos
          </Link>
          .
        </p>
      ),
      en: (
        <p>
          You can ask us to access, correct, or delete your personal data at any time by writing to{" "}
          <a href="mailto:hola@witers.com" className="font-semibold text-wit-blue">
            hola@witers.com
          </a>
          . For specific instructions on deleting your data, see our{" "}
          <Link to="/eliminar-datos" className="font-semibold text-wit-blue underline">
            data deletion
          </Link>{" "}
          page.
        </p>
      ),
    },
  },
  {
    title: { es: "7. Cookies", en: "7. Cookies" },
    body: {
      es: (
        <p>
          Usamos una cookie de sesión, necesaria para mantenerte con la sesión iniciada en el panel
          de clientes. No usamos cookies de publicidad ni de rastreo de terceros.
        </p>
      ),
      en: (
        <p>
          We use a session cookie, needed to keep you signed in to the client panel. We don't use
          advertising or third-party tracking cookies.
        </p>
      ),
    },
  },
  {
    title: { es: "8. Cambios a este aviso", en: "8. Changes to this notice" },
    body: {
      es: (
        <p>
          Podemos actualizar este aviso de privacidad de vez en cuando. Cualquier cambio se
          publicará en esta misma página.
        </p>
      ),
      en: (
        <p>
          We may update this privacy notice from time to time. Any changes will be posted on this
          same page.
        </p>
      ),
    },
  },
];

function Privacidad() {
  const { t, lang } = useLanguage();

  return (
    <div className="wit-page min-h-dvh overflow-x-clip">
      <SiteHeader />

      <section className="relative pb-16 pt-32 md:pb-20 md:pt-40">
        <div className="mx-auto max-w-3xl px-5 md:px-[110px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-wit-blue/25 bg-wit-mist/40 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.22em] text-wit-blue">
            {t("WITERS", "WITERS")}
          </span>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tighter text-wit-ink md:text-5xl">
            {t("Aviso de", "Privacy")}{" "}
            <span className="wit-underline text-wit-blue">{t("privacidad", "notice")}</span>
          </h1>
          <p className="mt-5 text-base leading-relaxed text-wit-gray">
            {t(
              "Así recopilamos, usamos y protegemos tus datos personales dentro de WITERS.",
              "This is how we collect, use, and protect your personal data within WITERS.",
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
