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
        name: 'BodhiReactCore',
        formats: ['es', 'cjs'],
        fileName: (format) => {
          if (format === 'es') return 'bodhi-react-core.esm.js';
          if (format === 'cjs') return 'bodhi-react-core.cjs.js';
          return `bodhi-react-core.${format}.js`;
        },
      },
      sourcemap: isDev,
      minify: isDev ? false : 'esbuild',
      rollupOptions: {
        external: [
          'react',
          'react/jsx-runtime',
          'react-dom',
          '@bodhiapp/bodhi-js-core',
          '@bodhiapp/ts-client',
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
    resolve: {
      alias: {
        '@bodhiapp/bodhi-js-core': resolve(__dirname, '../core/src/index.ts'),
        '@bodhiapp/bodhi-browser/types': resolve(__dirname, '../../bodhi-browser-ext/src/types'),
        '@bodhiapp/setup-modal/types': resolve(__dirname, '../../setup-modal/src/types'),
      },
    },
    esbuild: {
      jsx: 'automatic',
    },
  };
});
