import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so the built app works from any folder or static host (e.g. GitHub Pages).
export default defineConfig({
  base: './',
  plugins: [react()],
});
