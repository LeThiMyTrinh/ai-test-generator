import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1000
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8386',
      '/evidence': 'http://localhost:8386',
      '/reports': { target: 'http://localhost:8386', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:8386', ws: true }
    }
  }
})
