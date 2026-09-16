import { defineConfig } from 'vite'

export default defineConfig({
  base: '/',
  build: {
    rollupOptions: {
      input: {
        profile: 'index.html',
        create: 'create.html',
      },
    },
  },
})
