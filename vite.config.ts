import { defineConfig } from 'vite'

export default defineConfig({
  base: '/',
  plugins: [{
    name: 'landing-page-root',
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        if (request.url === '/') request.url = '/landing.html'
        next()
      })
    },
  }],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        secure: false,
      },
      '/generated': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        landing: 'landing.html',
        profile: 'index.html',
        create: 'create.html',
        auth: 'auth.html',
      },
    },
  },
})
