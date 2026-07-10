import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";
import type { ReactNode } from "react";

// Set right before we auto-reload once for a stale-chunk error, cleared as
// soon as the app mounts cleanly — so a real, persistent error doesn't loop
// reloads forever, but a fresh deploy can trigger the recovery again later.
const RELOAD_GUARD_KEY = "wit_reload_once";

function isStaleChunkError(error: Error | undefined | null): boolean {
  const msg = error?.message ?? "";
  return /dynamically imported module|failed to fetch|loading chunk|importing a module script failed|module script failed/i.test(
    msg,
  );
}

import appCss from "../styles.css?url";

const TITLE = "WITERS. La comunidad del ingenio";
const DESCRIPTION =
  "Somos una comunidad impulsada por el ingenio, la estrategia y la innovación. Branding, marketing, IA y tecnología para hacer crecer tu marca.";

function buildHead() {
  return {
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/assets/og.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "/assets/og.jpg" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  };
}

function NotFoundComponent() {
  return (
    <div className="wit-page flex min-h-dvh items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="text-6xl font-extrabold tracking-tight text-wit-blue">404</p>
        <h1 className="mt-3 text-2xl font-bold text-wit-ink">Página no encontrada</h1>
        <p className="mt-2 text-base text-wit-gray">
          La página que buscas no existe o fue movida.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center rounded-full bg-wit-blue px-6 py-3 font-semibold text-white transition hover:bg-wit-blue-deep"
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const staleChunk = isStaleChunkError(error);

  useEffect(() => {
    // Most common real-world cause: the tab was left open across a new
    // deploy, so it's still holding references to JS chunk files that no
    // longer exist on the server. A single reload fetches the current
    // build and resolves it — the guard just stops a genuine, repeating
    // error from reload-looping forever.
    if (staleChunk && !sessionStorage.getItem(RELOAD_GUARD_KEY)) {
      sessionStorage.setItem(RELOAD_GUARD_KEY, "1");
      window.location.reload();
    }
  }, [staleChunk]);

  if (staleChunk) {
    return (
      <div className="wit-page flex min-h-dvh items-center justify-center px-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-wit-blue border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="wit-page flex min-h-dvh items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold text-wit-ink">Esta página no cargó</h1>
        <p className="mt-2 text-base text-wit-gray">
          Algo salió mal de nuestro lado. Intenta refrescar o vuelve al inicio.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center rounded-full bg-wit-blue px-6 py-3 font-semibold text-white transition hover:bg-wit-blue-deep"
          >
            Reintentar
          </button>
          <a
            href="/"
            className="inline-flex items-center rounded-full border border-wit-ink/20 px-6 py-3 font-semibold text-wit-ink transition hover:border-wit-blue hover:text-wit-blue"
          >
            Ir al inicio
          </a>
        </div>
        <p className="mt-6 break-words font-wit-mono text-[11px] text-wit-gray/70">{error.message}</p>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: buildHead,
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <HeadContent />
      </head>
      <body>
        <div className="wit-bg-fixed" aria-hidden="true" />
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    sessionStorage.removeItem(RELOAD_GUARD_KEY);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
