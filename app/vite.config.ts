import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3333',
        changeOrigin: true,
      },
      '/db': {
        target: 'http://localhost:3333',
        changeOrigin: true,
      },
      '/bounties.json': {
        target: 'http://localhost:3333',
        changeOrigin: true,
      },
      '/analysis.json': {
        target: 'http://localhost:3333',
        changeOrigin: true,
      },
    },
  },
})
