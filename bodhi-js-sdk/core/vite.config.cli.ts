import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    ssr: true, // Build for Node.js, not browser
    lib: {
      entry: resolve(__dirname, 'bin/setup-modal.ts'),
      formats: ['es'],
      fileName: () => 'setup-modal.js',
    },
    outDir: 'dist/cli',
    rollupOptions: {
      output: {
        banner: '#!/usr/bin/env node',
      },
    },
    target: 'node18',
    minify: false,
    emptyOutDir: true,
  },
});
