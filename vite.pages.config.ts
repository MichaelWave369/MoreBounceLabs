import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * GitHub Pages is static hosting. This build deliberately excludes
 * TanStack Start/Nitro, Grok preview middleware, server auth and PGLite.
 *
 * Deployment URL: https://michaelwave369.github.io/MoreBounceLabs/
 */
export default defineConfig({
  root: "pages",
  publicDir: "../public",
  base: "/MoreBounceLabs/",
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [tailwindcss(), react()],
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./pages/index.html", import.meta.url)),
        backspin: fileURLToPath(new URL("./pages/backspin.html", import.meta.url)),
      },
    },
    outDir: "../dist-pages",
    emptyOutDir: true,
    target: "es2022",
  },
});
