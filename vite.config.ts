import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'MOTION//DNA',
        short_name: 'MOTION//DNA',
        description: 'Upload a video. See the movement hidden inside it.',
        theme_color: '#05070d',
        background_color: '#05070d',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Cache the pose model + wasm so repeat visits / offline sessions work.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/storage\.googleapis\.com\/mediapipe-models\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mediapipe-models',
              expiration: { maxEntries: 8, maxAgeSeconds: 30 * 24 * 3600 },
            },
          },
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/@mediapipe\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mediapipe-wasm',
              expiration: { maxEntries: 8, maxAgeSeconds: 30 * 24 * 3600 },
            },
          },
        ],
      },
    }),
  ],
  worker: { format: 'es' },
  build: {
    chunkSizeWarningLimit: 1600,
  },
});
