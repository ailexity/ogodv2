import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://172.20.10.3:4000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
