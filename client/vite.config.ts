import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const backendTarget =
  process.env.VITE_PROXY_TARGET || "http://localhost:5000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    allowedHosts: [
      "localhost",
      "127.0.0.1",
      "100.120.169.123",
      "dev-jegs.buru-degree.ts.net",
      ".buru-degree.ts.net",
    ],
    proxy: {
      "/api": {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
      },
      "/uploads": {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
