// WITERS brand primitives: logo, thin-line icon set, bespoke CTAs.
import { Link } from "@tanstack/react-router";
import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base(props: IconProps) {
  const { size = 28, ...rest } = props;
  return {
    width: size,
    height: size,
    viewBox: "0 0 32 32",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...rest,
  };
}

export function IconIngenio(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M16 4v2M6 8l1.5 1.5M26 8l-1.5 1.5M4 16h2M26 16h2" />
      <path d="M11 20a6.5 6.5 0 1 1 10 0c-1 1.2-1.6 2-1.6 3.4h-6.8c0-1.4-.6-2.2-1.6-3.4Z" />
      <path d="M13 26h6M14 28.5h4" />
    </svg>
  );
}

export function IconEstrategia(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="15" cy="17" r="10" />
      <circle cx="15" cy="17" r="5.5" />
      <circle cx="15" cy="17" r="1.4" fill="currentColor" stroke="none" />
      <path d="M15 17 24 8M24 8v-4M24 8h4" />
    </svg>
  );
}

export function IconInnovacion(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M18 4c4 1.5 8 5.5 9.5 9.5-2.5 4-6 7-11 8.5L11 16c1.5-5 4-8.5 7-12Z" />
      <circle cx="19.5" cy="12.5" r="2" />
      <path d="M11 16l-4.5 1.5L9 21l-3 6 6-3 3.5 2.5L17 22" />
    </svg>
  );
}

export function IconComunidad(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="10" cy="12" r="3.4" />
      <circle cx="22" cy="12" r="3.4" />
      <path d="M4 25c0-3.6 2.6-6 6-6s6 2.4 6 6M16 25c0-3.6 2.6-6 6-6s6 2.4 6 6" />
    </svg>
  );
}

export function IconCrecimiento(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 27h22" />
      <path d="M8 23v-5M14 23v-9M20 23V10M26 23V6" />
      <path d="M8 14l6-5 6 3 6-6M26 6h-4M26 6v4" />
    </svg>
  );
}

export function IconExcelencia(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M16 4.5l3.4 7 7.6 1-5.5 5.3 1.3 7.7L16 21.8l-6.8 3.7 1.3-7.7L5 12.5l7.6-1Z" />
    </svg>
  );
}

export function IconCerebro(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M13 5a4 4 0 0 0-4 4c-2.5.5-4 2.3-4 4.8 0 1.7.8 3.2 2 4.1-.4 3 1.6 5.6 4.6 5.6 1 1.6 3.4 2 4.4.6V7.4C16 5.9 14.7 5 13 5Z" />
      <path d="M19 5a4 4 0 0 1 4 4c2.5.5 4 2.3 4 4.8 0 1.7-.8 3.2-2 4.1.4 3-1.6 5.6-4.6 5.6-1 1.6-3.4 2-4.4.6V7.4C16 5.9 17.3 5 19 5Z" />
      <path d="M11 12h3M18 16h3M11 19h3" />
    </svg>
  );
}

export function IconEvolucion(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 27h22" />
      <path d="M7 23c6 0 5-12 11-12" />
      <path d="M18 11h5M23 11v5" />
      <path d="M13 27v-4M19 27v-7M25 27V16" />
    </svg>
  );
}

export function IconColaboracion(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M9 16a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5" />
      <circle cx="16" cy="7.5" r="3" />
      <path d="M4 26l4.5-4.5M28 26l-4.5-4.5M16 28v-6" />
      <circle cx="4.5" cy="27" r="1.6" />
      <circle cx="27.5" cy="27" r="1.6" />
      <circle cx="16" cy="29" r="1.6" />
    </svg>
  );
}

export function IconMision(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7 28V6l5 3 5-3 5 3 4-2.5V21" />
      <path d="M7 28h18" />
      <path d="M12 15l4 4 8-8" />
    </svg>
  );
}

export function IconVision(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 16s5-8 13-8 13 8 13 8-5 8-13 8-13-8-13-8Z" />
      <circle cx="16" cy="16" r="4" />
    </svg>
  );
}

export function IconProposito(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 27l7-14 5 8 3-5 5 11" />
      <path d="M13 7V3M13 3h6l-1.5 2L19 7h-6" />
      <path d="M4 27h24" />
    </svg>
  );
}

// ---------- logo ----------
// Original WITERS brand mark (user-provided asset, black background removed).
export function WMark({ size = 34 }: { size?: number }) {
  return (
    <img
      src="/assets/logo_w.png"
      alt=""
      aria-hidden="true"
      style={{ height: size, width: "auto" }}
      draggable={false}
    />
  );
}

export function WitersLogo({
  dark = false,
  compact = false,
}: {
  dark?: boolean;
  compact?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <WMark size={compact ? 28 : 34} />
      <span
        className={`font-wit font-extrabold tracking-[0.28em] ${compact ? "text-lg" : "text-xl"} ${dark ? "text-white" : "text-wit-ink"}`}
      >
        WITERS
      </span>
    </span>
  );
}

// ---------- bespoke CTAs ----------

// Header CTA: solid blue pill, arrow slides on hover.
export function CtaPill({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="group inline-flex items-center gap-2 rounded-full bg-wit-blue px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-wit-blue-deep active:scale-[0.98]"
    >
      {children}
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-transform duration-200 group-hover:translate-x-1 group-hover:-translate-y-1"
      >
        <path d="M3 13 13 3M13 3H6M13 3v7" />
      </svg>
    </Link>
  );
}


