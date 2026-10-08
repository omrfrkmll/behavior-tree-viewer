import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  base: './',
  root: 'app',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './app/src'),
      'cn': path.resolve(import.meta.dirname, './app/src/lib/utils')
    }
  },
  server: {
    port: 5173,
    open: false
  },
  build: {
    outDir: '../dist-app',
    emptyOutDir: true
  }
});
