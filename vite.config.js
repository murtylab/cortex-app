import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const ngrokHost = process.env.NGROK_HOST || null;

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
        vssSatellite: 'vss-satellite/index.html',
        vss2026: 'vss-2026/index.html',
        vssSymposiumMurty: 'vss-symposium-murty/index.html',
        vssTalkCortex: 'vss-talk-cortex/index.html',
        ccnSatellite: 'ccn-satellite/index.html',
        chiPoster: 'chi-poster/index.html',
        walkthrough: 'walkthrough/index.html',
      

      },
    },
  },
  server: {
    open: '/index.html',
    allowedHosts: ngrokHost ? [ngrokHost, 'localhost'] : ['localhost'],
    host: true,
    strictPort: true,
    port: 5173,
    ...(ngrokHost ? { hmr: { host: ngrokHost, clientPort: 443 } } : {}),
  },
  resolve: {
    alias: {
     '@js': '/assets/js',
      '@assets': '/assets'
    },
  },
});
