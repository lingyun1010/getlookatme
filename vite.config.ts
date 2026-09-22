import { defineConfig } from 'vite'

export default defineConfig({
  base: '/',
  plugins: [{
    name: 'landing-page-root',
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        const path = request.url?.split('?')[0]
        if (path === '/login' || path === '/signup' || path === '/auth') request.url = `/auth.html${request.url?.includes('?') ? request.url.slice(request.url.indexOf('?')) : ''}`
        if (path === '/privacy' || path === '/terms' || path === '/refunds') request.url = `/${path.slice(1)}.html`
        if (path === '/dashboard' || path === '/dashboard/create' || path === '/dashboard/profile' || path === '/dashboard/avatar' || path === '/dashboard/pages' || path === '/dashboard/pricing' || path === '/dashboard/upgrade') request.url = '/dashboard.html'
        if (/^\/[^/]+\/chat$/.test(path ?? '')) request.url = '/chat.html'
        if (path === '/create' || path === '/edit') { _response.statusCode = 302; _response.setHeader('Location','/dashboard/create'); _response.end(); return }
        if (/^\/[^/.]+$/.test(path ?? '') && !['/login', '/signup', '/auth', '/privacy', '/terms', '/refunds', '/dashboard'].includes(path ?? '')) request.url = '/profile.html'
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
        landing: 'index.html',
        profile: 'profile.html',
        chat: 'chat.html',
        create: 'create.html',
        auth: 'auth.html',
        dashboard: 'dashboard.html',
        privacy: 'privacy.html',
        terms: 'terms.html',
        refunds: 'refunds.html',
      },
    },
  },
})
