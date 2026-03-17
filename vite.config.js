import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['informed-hedgehog-randomly.ngrok-free.app', 'localhost'],
    proxy: {
      // All /api/* requests → express BFF on port 3001
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});