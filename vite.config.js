import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import modelPagesPlugin from './scripts/vite-plugin-model-pages.js';

const ngrokHost = process.env.NGROK_HOST || null;

export default defineConfig(({ command }) => ({
  root: '.',
  plugins: [
    react(),
    modelPagesPlugin(),
    // Copy assets into dist for production. In dev this middleware would
    // serve raw /assets/js/*.tsx and skip Vite's transform, blanking Lab pages.
    ...(command === 'build'
      ? [
          viteStaticCopy({
            targets: [
              {
                src: 'assets',
                dest: '.',
              },
            ],
          }),
        ]
      : []),
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
}));
