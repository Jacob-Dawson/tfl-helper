import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/tfl": {
        target: "https://api.tfl.gov.uk",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tfl/, ""),
      },
    },
  },
});