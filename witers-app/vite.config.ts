import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(() => {
  return {
    // The server bundle runs as a Cloudflare Worker — there is no node_modules
    // at runtime. Bundle all npm deps into the SSR output.
    ssr: {
      noExternal: true,
      external: ["cloudflare:workers"],
    },
    build: {
      rollupOptions: { external: [/^cloudflare:/] },
    },
    plugins: [
      // TanStack Start plugin must run before React's plugin.
      tanstackStart({
        server: { entry: "server" },
      }),
      react(),
      tailwindcss(),
      tsconfigPaths(),
    ],
  };
});
