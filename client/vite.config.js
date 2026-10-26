import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In development the browser talks to Vite; requests to /api are forwarded to the Express server.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:3001' } },
});
