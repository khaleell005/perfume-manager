import { defineConfig, type Plugin } from 'vite';
import { createApi } from './server/firebase-api.mjs';
// SQLite backend retained in server/api.mjs and server/database.mjs for later use.
// import { createApi } from './server/api.mjs';
// import { openStore } from './server/database.mjs';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

function firebaseBackend(): Plugin {
  const attach = (server: { middlewares: { use: (handler: ReturnType<typeof createApi>) => void } }) => {
    server.middlewares.use(createApi());
  };
  return { name: 'firebase-backend', configureServer: attach, configurePreviewServer: attach };
}

export default defineConfig({
  server: {
    fs: {
      deny: ['**/.env', '**/.env.*', '**/*.{crt,pem}', '**/.git/**', '**/*adminsdk*.json', '**/*service-account*.json', '**/serviceAccount*.json', '**/data/**', '**/*.sqlite*', '**/*.db*'],
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    // sqliteBackend() is disabled while Firebase is active.
    firebaseBackend(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      devOptions: {
        enabled: true,
        // Keep Vite routes live so the dev worker doesn't serve stale pages during HMR.
        navigateFallbackAllowlist: [],
        suppressWarnings: true,
      },
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api(?:\/|$)/],
        // Only the app shell is cached. Private Firebase API responses are never cached.
        runtimeCaching: [],
      },
      // The API serves a manifest with the current business name.
      manifest: false,
    }),
  ],
});
