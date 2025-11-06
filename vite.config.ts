// Di dalam file vite.config.ts

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa' // <-- Impor plugin

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate', // Otomatis update service worker
      injectRegister: 'auto',
      manifest: {
        // Ini adalah konfigurasi untuk 'manifest.json' Anda
        name: 'EasyWork',
        short_name: 'EasyWork',
        description: 'Deskripsi singkat tentang aplikasi Anda',
        theme_color: '#ffffff', // Sesuaikan dengan warna tema aplikasi Anda
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait',
        icons: [
          // Anda WAJIB membuat ikon-ikon ini
          // dan meletakkannya di folder /public
          {
            src: '/pwa-192x192.png', // path ke ikon di folder public
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png', // path ke ikon di folder public
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png', // ikon untuk di-mask
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable', // <-- penting untuk PWA
          },
        ],
      },
    }),
  ],
})