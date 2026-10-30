import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // The proxy runs on the same machine as the dev server, so localhost reaches
  // the API whatever network you're on. Set OGOD_API_URL (env or .env.local)
  // only when the API lives on another host.
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.OGOD_API_URL || `http://localhost:${env.PORT || 4000}`

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
