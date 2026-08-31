import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import modelPagesPlugin from './scripts/vite-plugin-model-pages.js';

export default defineConfig(({ command, mode }) => {
  const environment = loadEnv(mode, '.', '');
  const ngrokHost = process.env.NGROK_HOST || environment.NGROK_HOST || null;
  const cortexCoreProxyTarget =
    process.env.CORTEX_CORE_PROXY_TARGET ||
    environment.CORTEX_CORE_PROXY_TARGET ||
    'http://127.0.0.1:5556';

  return {
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
      proxy: {
        // Keep browser requests same-origin when the UI is opened through VS
        // Code Remote SSH or another single-port development tunnel.
        '/cortex-core': {
          target: cortexCoreProxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/cortex-core/, ''),
        },
      },
      ...(ngrokHost ? { hmr: { host: ngrokHost, clientPort: 443 } } : {}),
    },
    resolve: {
      alias: {
        '@js': '/assets/js',
        '@assets': '/assets',
      },
    },
  };
});
