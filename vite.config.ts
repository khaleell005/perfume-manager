import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const protectedPaths = ['**/.env', '**/.env.*', '**/*.{crt,pem}', '**/.git/**', '**/*adminsdk*.json', '**/*service-account*.json', '**/serviceAccount*.json', '**/data/**', '**/*.sqlite*', '**/*.db*'];

export default defineConfig(async ({ mode }) => {
  // npm run dev and the SQLite preview use the existing local database.
  // Production Firebase stays separate from the local SQLite app.
  const local = mode !== 'production';
  const { createApi } = local ? await import('./server/api.mjs') : await import('./server/firebase-api.mjs');
  const backend: Plugin = {
    name: local ? 'sqlite-backend' : 'firebase-backend',
    configureServer(server) { server.middlewares.use(createApi()); },
    configurePreviewServer(server) { server.middlewares.use(createApi()); },
  };
  return {
    resolve: { alias: { '@backend': resolve('src/backends', local ? 'sqlite' : 'firebase') } },
    server: { fs: { deny: protectedPaths } },
    plugins: [
      react(), tailwindcss(), backend,
      VitePWA({
        registerType: 'prompt', injectRegister: false,
        devOptions: { enabled: true, navigateFallbackAllowlist: [], suppressWarnings: true },
        includeAssets: ['brand-logo.jpg', 'icon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
        workbox: {
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api(?:\/|$)/],
          runtimeCaching: [],
        },
        manifest: false,
      }),
    ],
  };
});
