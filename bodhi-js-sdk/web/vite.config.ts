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
        name: 'BodhiWeb',
        formats: ['es', 'cjs'],
        fileName: (format) => {
          if (format === 'es') return 'bodhi-web.esm.js';
          if (format === 'cjs') return 'bodhi-web.cjs.js';
          return `bodhi-web.${format}.js`;
        },
      },
      sourcemap: isDev,
      minify: isDev ? false : 'esbuild',
      rollupOptions: {
        external: [
          '@bodhiapp/bodhi-js-core',
          '@bodhiapp/ts-client',
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
