import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json';

let commitHash = 'dev';
try {
  commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
} catch {
  // fallback
}
const buildDate = new Date().toISOString().slice(0, 10);

export default defineConfig({
  // The deployed GitHub Pages project site lives at /EventHub/. CI sets
  // VITE_BASE=/EventHub/ for the production build; local dev, preview and the
  // test suite stay at the root ('/').
  base: process.env.VITE_BASE || '/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __COMMIT_HASH__: JSON.stringify(commitHash),
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
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
