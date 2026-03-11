import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig(() => {
  const hmrHost = process.env.VITE_HMR_HOST;
  const hmrClientPort = process.env.VITE_HMR_CLIENT_PORT
    ? Number(process.env.VITE_HMR_CLIENT_PORT)
    : undefined;

  const hmr = hmrHost
    ? {
        host: hmrHost,
        clientPort: hmrClientPort ?? 443,
      }
    : undefined;

  return {
  root: '.',
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          // Only copy non-code static assets; JS/TS/TSX/JSX are handled by Vite.
          // This avoids serving React source files (like the scoreboard) as raw text.
          src: [
            'assets/**/*.{png,jpg,jpeg,gif,webp,svg,ico}',
            'assets/**/*.{css,scss}',
            'assets/**/*.{json,txt,csv}',
            'assets/**/*.{woff,woff2,ttf,eot,otf}',
          ],
          dest: '.',
        },
        {
          src: 'assets/js/chatbot/chatbot-widget.js',
          dest: 'assets/js/chatbot',
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
        scoreboardQuantitative: 'scoreboardQuantitative/index.html',
        scoredboardQuality: 'scoreboardQualitative/index.html',
        scoreboardLanding: 'scoreboardLanding/index.html',
        labLanding: 'labLanding/index.html',
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
    hmr,
  },
  resolve: {
    alias: {
     '@js': '/assets/js',
      '@assets': '/assets'
    },
  },
};
});
