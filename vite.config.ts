import { defineConfig, loadEnv, type Plugin } from 'vite';
import { createApi } from './server/api.mjs';
import { openStore } from './server/database.mjs';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

function sqliteBackend(): Plugin {
  let databasePath: string | undefined;
  const attach = (server: { middlewares: { use: (handler: ReturnType<typeof createApi>) => void }; httpServer: { once: (event: string, listener: () => void) => unknown } | null }) => {
    const store = openStore(databasePath);
    server.middlewares.use(createApi({ store }));
    server.httpServer?.once('close', () => store.close());
  };
  return {
    name: 'sqlite-backend',
    configResolved(config) { databasePath = loadEnv(config.mode, config.envDir, '').SQLITE_PATH; },
    configureServer: attach,
    configurePreviewServer: attach,
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    sqliteBackend(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      devOptions: {
        enabled: true,
        // Keep Vite routes live so the dev worker doesn't serve stale pages during HMR.
        navigateFallbackAllowlist: [],
        suppressWarnings: true,
      },
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api(?:\/|$)/],
        // Only the app shell is cached. Private SQLite API responses stay on the server.
        runtimeCaching: [],
      },
      // The API serves a manifest with the current business name.
      manifest: false,
    }),
  ],
});
