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
        // Copy entire subdirs so paths are preserved under dist/assets/
        { src: 'assets/img',    dest: 'assets' },
        { src: 'assets/data',   dest: 'assets' },
        { src: 'assets/vendor', dest: 'assets' },
        { src: 'assets/css',    dest: 'assets' },
        // Chatbot widget (vanilla JS + CSS served at original paths)
        { src: 'assets/js/chatbot/chatbot-widget.js',  dest: 'assets/js/chatbot' },
        { src: 'assets/js/chatbot/chatbot-widget.css', dest: 'assets/js/chatbot' },
        // main.js (non-module, must be served at original path)
        { src: 'assets/js/main.js', dest: 'assets/js' },
        // Model pages
        { src: 'cortex-web-app/model-pages', dest: '.' },
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
