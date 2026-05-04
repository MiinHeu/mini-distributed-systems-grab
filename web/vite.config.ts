import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth': 'http://localhost:3000',
      '/trips': 'http://localhost:3000',
      '/drivers': 'http://localhost:3000',
      '/messages': 'http://localhost:3000',
      '/ratings': 'http://localhost:3000',
      '/payments': 'http://localhost:3000',
      '/admin': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
      '/reports': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000',
    },
  },
})
