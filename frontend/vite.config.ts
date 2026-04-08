import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { createLogger, defineConfig } from 'vite';

// Silence noisy "ws proxy socket error" logs caused by the browser dropping
// the WebSocket connection on HMR reload / StrictMode double-mount. These
// errors are benign — useWebSocket reconnects automatically.
const logger = createLogger();
const originalError = logger.error.bind(logger);
logger.error = (msg, options) => {
  if (typeof msg === 'string' && msg.includes('ws proxy socket error')) return;
  originalError(msg, options);
};

export default defineConfig({
  customLogger: logger,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:9001',
      '/ws': {
        target: 'ws://localhost:9001',
        ws: true,
      },
    },
  },
  build: {
    outDir: '../dist/client',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Heavy libraries that deserve their own chunk so the main
          // entry stays lean. Mermaid is lazy-loaded via dynamic import
          // and ends up in its own auto-named chunk regardless — listing
          // it here is not needed.
          react: ['react', 'react-dom'],
          markdown: ['react-markdown', 'remark-gfm'],
          syntax: ['react-syntax-highlighter'],
        },
      },
    },
  },
});
