import { createFileRoute } from "@tanstack/react-router";

import { SiteFooter, SiteHeader } from "../components/witers/chrome";

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
  title: string;
  body: React.ReactNode;
};

const SECCIONES: Seccion[] = [
  {
    title: "1. Vigencia de la promoción",
    body: (
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
  },
  {
    title: "2. Precios",
    body: <p>Todos los precios publicados son más IVA.</p>,
  },
  {
    title: "3. Contratación por marca",
    body: (
      <>
        <p>Cada paquete incluye servicios para una sola marca o empresa.</p>
        <p className="mt-3">
          Si el cliente desea trabajar una segunda marca, será necesario contratar un paquete
          adicional o solicitar una cotización personalizada.
        </p>
      </>
    ),
  },
  {
    title: "4. Material proporcionado por el cliente",
    body: (
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
  },
  {
    title: "5. Solicitudes de diseño",
    body: (
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
  },
  {
    title: "6. Revisión de diseños",
    body: (
      <>
        <p>Cada diseño incluye el número de revisiones indicado en el paquete contratado.</p>
        <p className="mt-3">
          Las modificaciones adicionales podrán generar un costo extra (descuento de 1 solicitud).
        </p>
      </>
    ),
  },
  {
    title: "7. Solicitudes mensuales",
    body: (
      <>
        <p>Las solicitudes incluidas en cada plan son mensuales.</p>
        <p className="mt-3">
          Las solicitudes no utilizadas durante el mes no son acumulables para meses posteriores.
        </p>
      </>
    ),
  },
  {
    title: "8. Tiempo de respuesta",
    body: (
      <>
        <p>
          Los tiempos de entrega comienzan una vez que el cliente proporciona toda la información
          necesaria.
        </p>
        <p className="mt-3">Las solicitudes incompletas pueden retrasar la entrega.</p>
      </>
    ),
  },
  {
    title: "9. Campañas publicitarias",
    body: (
      <>
        <p>
          La creación y configuración de campañas está incluida de acuerdo con el paquete
          contratado.
        </p>
        <p className="mt-3">
          El presupuesto destinado a Meta Ads, Google Ads u otras plataformas publicitarias no está
          incluido y será cubierto directamente por el cliente.
        </p>
      </>
    ),
  },
  {
    title: "10. Propiedad del contenido",
    body: (
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
  },
  {
    title: "11. Cancelaciones",
    body: (
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
          Una vez concluido el periodo vigente, la suscripción quedará cancelada y no se realizarán
          cargos adicionales.
        </p>
      </>
    ),
  },
  {
    title: "12. Renovación automática",
    body: (
      <>
        <p>
          La suscripción se renovará automáticamente al finalizar cada periodo mensual, utilizando
          el método de pago registrado por el cliente.
        </p>
        <p className="mt-3">
          Si el cliente no desea continuar con el servicio, deberá solicitar la cancelación antes de
          la fecha de renovación para evitar el cargo correspondiente al siguiente periodo.
        </p>
      </>
    ),
  },
  {
    title: "13. Suspensión del servicio",
    body: (
      <p>
        Si el cliente no envía solicitudes o información durante el periodo contratado, el servicio
        continuará vigente y el mes se considerará consumido.
      </p>
    ),
  },
  {
    title: "14. Comunicación",
    body: (
      <p>
        Toda la comunicación oficial se realizará mediante los canales autorizados por WITERS y/o a
        través del panel de clientes.
      </p>
    ),
  },
];

function Terminos() {
  return (
    <div className="wit-page min-h-dvh overflow-x-clip">
      <SiteHeader />

      <section className="relative pb-16 pt-32 md:pb-20 md:pt-40">
        <div className="mx-auto max-w-3xl px-5 md:px-[110px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-wit-blue/25 bg-wit-mist/40 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.22em] text-wit-blue">
            Paquetes WITERS
          </span>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tighter text-wit-ink md:text-5xl">
            Términos y <span className="wit-underline text-wit-blue">condiciones</span>
          </h1>
          <p className="mt-5 text-base leading-relaxed text-wit-gray">
            Estos términos aplican a la promoción de julio 2026 y a las membresías Essential, Grow y
            Scale de WITERS. Al aceptar los términos y condiciones al registrarte, confirmas que los
            leíste y estás de acuerdo con ellos.
          </p>
        </div>
      </section>

      <section className="relative bg-white pb-24">
        <div className="mx-auto max-w-3xl divide-y divide-wit-ink/10 border-y border-wit-ink/10 px-5 md:px-[110px]">
          {SECCIONES.map((s) => (
            <div key={s.title} className="py-8">
              <h2 className="text-lg font-bold text-wit-ink">{s.title}</h2>
              <div className="mt-3 space-y-1 text-[15px] leading-relaxed text-wit-gray">
                {s.body}
              </div>
            </div>
          ))}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
