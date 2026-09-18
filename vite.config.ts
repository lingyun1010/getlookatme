import { defineConfig } from 'vite'

export default defineConfig({
  base: '/',
  plugins: [{
    name: 'landing-page-root',
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        const path = request.url?.split('?')[0]
        if (path === '/') request.url = '/landing.html'
        if (path === '/login' || path === '/signup' || path === '/auth') request.url = `/auth.html${request.url?.includes('?') ? request.url.slice(request.url.indexOf('?')) : ''}`
        if (path === '/dashboard' || path === '/dashboard/create' || path === '/dashboard/profile' || path === '/dashboard/avatar' || path === '/dashboard/pages') request.url = '/dashboard.html'
        if (path === '/create' || path === '/edit') { _response.statusCode = 302; _response.setHeader('Location','/dashboard/create'); _response.end(); return }
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
        dashboard: 'dashboard.html',
      },
    },
  },
})
