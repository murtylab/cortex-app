import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  root: '.',
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: 'assets',
          dest: '.'
        },
        {
          src: 'cortex-web-app/model-pages',
          dest: '.'
        }
      ]
    })
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html',
        lab: 'lab/index.html',
        labWholeBrain: 'lab-whole-brain/index.html',
        scoreboardQuantitative: 'scoreboardQuantitative/index.html',
        scoredboardQuality: 'scoreboardQualitative/index.html',
        scoreboardLanding: 'scoreboardLanding/index.html',
        labLanding: 'labLanding/index.html',
        latestNews: 'latest-news/index.html',
        vss2026: 'vss-2026/index.html',
        walkthrough: 'walkthrough/index.html',
      

      },
    },
  },
  server: {
    open: '/index.html',
    allowedHosts: ['sunny-weasel-grossly.ngrok-free.app', 'localhost'],
    host: true,
    strictPort: true,
    port: 5173,
    hmr: { host: 'sunny-weasel-grossly.ngrok-free.app', clientPort: 443 },
  },
  resolve: {
    alias: {
     '@js': '/assets/js',
      '@assets': '/assets'
    },
  },
});
