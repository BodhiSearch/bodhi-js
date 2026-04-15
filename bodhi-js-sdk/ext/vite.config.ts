import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig(({ mode }) => {
  const isDev = mode !== 'production';
  return {
    define: {
      __BODHI_BUILD_MODE__: JSON.stringify(isDev ? 'development' : 'production'),
    },
    build: {
      lib: {
        entry: resolve(__dirname, 'src/index.ts'),
        name: 'BodhiExt',
        formats: ['es', 'cjs'],
        fileName: (format) => {
          if (format === 'es') return 'bodhi-ext.esm.js';
          if (format === 'cjs') return 'bodhi-ext.cjs.js';
          return `bodhi-ext.${format}.js`;
        },
      },
      sourcemap: isDev,
      minify: isDev ? false : 'esbuild',
      rollupOptions: {
        external: [
          'chrome',
          '@bodhiapp/bodhi-js-core',
          /^@bodhiapp\/ts-client(\/.*)?$/,
          '@bodhiapp/bodhi-browser-types',
        ],
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
  };
});
