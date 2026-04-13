import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['informed-hedgehog-randomly.ngrok-free.app', 'localhost'],
    proxy: {
      // Express BFF
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // FastAPI — strip /fastapi prefix before forwarding
      '/fastapi': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/fastapi/, ''),
      },
    },
  },
});