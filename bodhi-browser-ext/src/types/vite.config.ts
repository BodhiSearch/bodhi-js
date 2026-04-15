import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'index.ts'),
      name: 'BodhiBrowserTypes',
      formats: ['es'],
      fileName: () => 'index.js',
    },
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      external: [/^@bodhiapp\/ts-client(\/.*)?$/],
    },
  },
  plugins: [
    dts({
      outDir: 'dist',
      rollupTypes: false,
      insertTypesEntry: true,
      copyDtsFiles: true,
    }),
  ],
});
