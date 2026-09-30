import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Deploy under a sub-path (GitHub Pages: https://user.github.io/sylvia/) with:
//   VITE_BASE=/sylvia/ npm run build
// The default './' works on Netlify / Vercel / any static host at the domain root.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: env.VITE_BASE || './',
    plugins: [react()],
    build: { target: 'es2020', chunkSizeWarningLimit: 1600 },
    server: { host: true },
  };
});
