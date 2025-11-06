import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa' // <-- 1. Import plugin

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // 2. Tambahkan VitePWA
    VitePWA({
      registerType: 'autoUpdate', // Otomatis update service worker
      injectRegister: 'auto',

      // Opsi untuk cache (Workbox)
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.example\.com\/.*/, // Ganti dengan URL API Anda
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 // 1 hari
              }
            }
          }
        ]
      },

      // Konfigurasi untuk file manifest.webmanifest
      manifest: {
        name: 'Easywork', // Ganti dengan nama aplikasi Anda
        short_name: 'Easywork', // Ganti dengan nama pendek
        description: 'Deskripsi singkat aplikasi Easywork Anda',
        theme_color: '#ffffff', // Ganti dengan warna tema Anda
        background_color: '#ffffff',
        start_url: '/',
        display: 'standalone',
        icons: [
          {
            src: 'icons/icon-192x192.png', // Path relatif dari folder 'public'
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable', // Icon "maskable" penting untuk PWA
          },
        ],
      },
    }),
  ],
})