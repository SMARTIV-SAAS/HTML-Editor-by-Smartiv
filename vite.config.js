import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
import { createReadStream } from 'node:fs';

// Dev-only: serve the bundled .ttf files (which live under the Android module)
// at /bundled-fonts/ so the demo can inject @font-face and preview real faces in
// the font picker. In the CMS the host serves these itself.
function serveBundledFonts() {
  const dir = fileURLToPath(new URL('./android/htmleditor/src/main/assets/fonts/', import.meta.url));
  return {
    name: 'serve-bundled-fonts',
    configureServer(server) {
      server.middlewares.use('/bundled-fonts', (req, res, next) => {
        const name = decodeURIComponent(req.url.split('?')[0].replace(/^\//, ''));
        if (!name || name.includes('..')) return next();
        const stream = createReadStream(dir + name);
        stream.on('error', next);
        res.setHeader('Content-Type', 'font/ttf');
        stream.pipe(res);
      });
    }
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [vue(), serveBundledFonts()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  // `npm run dev` serves the demo; `npm run build` emits the library.
  root: mode === 'development' ? 'demo' : '.',
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/index.js', import.meta.url)),
      name: 'SmartivEditor',
      fileName: 'smartiv-editor'
    },
    rollupOptions: {
      external: ['vue'],
      output: { globals: { vue: 'Vue' }, exports: 'named' }
    }
  }
}));
