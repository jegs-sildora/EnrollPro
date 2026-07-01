import { defineConfig, createLogger } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

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

const handleProxyError = (err: any, _req: any, res: any) => {
  if (err.code !== 'ECONNREFUSED') {
    console.log('proxy error', err.message);
  }
  if (res) {
    if (typeof res.writeHead === 'function' && !res.headersSent) {
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
