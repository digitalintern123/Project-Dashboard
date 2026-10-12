import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// Port can be overridden with PORT=4000 npm run dev, but it is not required.
const port = Number(process.env.PORT) || 5173;

export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        // Long-lived vendor chunks, so app deploys don't invalidate them.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          // Only React itself: a library that imports a helper from 'vendor' here would
          // make the two chunks import each other and crash at startup.
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react-vendor';
          if (/node_modules\/(recharts|d3-[^/]+|victory-vendor)\//.test(id)) return 'charts-vendor';
          if (id.includes('node_modules/@radix-ui/')) return 'radix-vendor';
          if (id.includes('node_modules/lucide-react/')) return 'icons-vendor';
          return 'vendor';
        },
      },
    },
  },
  server: {
    port,
    host: true,
    open: true,
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.API_PORT || 5000}`,
        changeOrigin: true,
      },
      '/uploads': {
        target: `http://localhost:${process.env.API_PORT || 5000}`,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: port + 1,
    host: true,
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.API_PORT || 5000}`,
        changeOrigin: true,
      },
      '/uploads': {
        target: `http://localhost:${process.env.API_PORT || 5000}`,
        changeOrigin: true,
      },
    },
  },
});
