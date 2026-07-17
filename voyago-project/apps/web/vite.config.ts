
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          maps: ['leaflet', 'react-leaflet'],
          charts: ['recharts'],
          motion: ['framer-motion'],
          qr: ['html5-qrcode'],
        },
      },
    },
  },
})
