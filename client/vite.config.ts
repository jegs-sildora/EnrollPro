import { defineConfig, createLogger } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Socket } from "node:net";

const backendTarget =
  process.env.VITE_PROXY_TARGET || "http://127.0.0.1:5002";

// Custom logger to suppress ECONNREFUSED errors from Vite's internal proxy error handler
const logger = createLogger();
const originalError = logger.error;
logger.error = (msg, options) => {
  if (msg.includes('http proxy error') && msg.includes('ECONNREFUSED')) {
    return;
  }
  originalError(msg, options);
};

type ProxyError = Error & { code?: string };

const handleProxyError = (
  err: ProxyError,
  _req: IncomingMessage,
  res: Socket | ServerResponse<IncomingMessage>,
) => {
  if (err.code !== 'ECONNREFUSED') {
    console.log('proxy error', err.message);
  }
  if (res) {
    if ('writeHead' in res && typeof res.writeHead === 'function' && !res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
    }
    if (typeof res.end === 'function') {
      res.end('Proxy error: ' + err.message);
    } else if (typeof res.destroy === 'function') {
      res.destroy();
    }
  }
};

export default defineConfig({
  customLogger: logger,
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 1800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (
            id.includes("react-router") ||
            id.includes("react-dom") ||
            id.includes("/react/") ||
            id.includes("\\react\\")
          ) {
            return "react-core";
          }

          if (id.includes("@tanstack")) {
            return "tanstack";
          }

          if (id.includes("@radix-ui") || id.includes("@base-ui")) {
            return "ui-base";
          }

          if (id.includes("lucide-react") || id.includes("@tabler")) {
            return "icons";
          }

          if (id.includes("recharts")) {
            return "charts";
          }

          if (id.includes("xlsx") || id.includes("papaparse") || id.includes("html2canvas")) {
            return "document-tools";
          }

          if (id.includes("motion") || id.includes("framer-motion")) {
            return "motion";
          }

          return "vendor";
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    allowedHosts: true, // Disable host check for dev to avoid 403
    proxy: {
      "/api": {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('error', handleProxyError);
        }
      },
      "/uploads": {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('error', handleProxyError);
        }
      },
      "/smart-api": {
        target: "http://127.0.0.1:5003",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/smart-api/, ""),
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('error', handleProxyError);
        }
      },
    },
  },
});
