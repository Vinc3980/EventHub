import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // The deployed GitHub Pages project site lives at /EventHub/. CI sets
  // VITE_BASE=/EventHub/ for the production build; local dev, preview and the
  // test suite stay at the root ('/').
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: { port: 5173 },
  build: {
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          icons: ['iconsax-react'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Deterministic dates: the app formats with the Africa/Accra zone, so pin
    // the host timezone instead of relying on the machine that runs the suite.
    env: { TZ: 'Africa/Accra' },
  },
} as Parameters<typeof defineConfig>[0]);
