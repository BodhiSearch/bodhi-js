import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';
import svgr from 'vite-plugin-svgr';

export default defineConfig(({ mode }) => {
  const isDev = mode !== 'production';
  return {
    define: {
      __BODHI_BUILD_MODE__: JSON.stringify(isDev ? 'development' : 'production'),
    },
    build: {
      lib: {
        entry: {
          index: resolve(__dirname, 'src/index.ts'),
          'api/index': resolve(__dirname, 'src/api/index.ts'),
        },
        name: 'BodhiReactCore',
        formats: ['es', 'cjs'],
        fileName: (format, entryName) => {
          if (entryName === 'index') {
            if (format === 'es') return 'bodhi-react-core.esm.js';
            if (format === 'cjs') return 'bodhi-react-core.cjs.js';
            return `bodhi-react-core.${format}.js`;
          }
          const ext = format === 'es' ? 'esm.js' : 'cjs.js';
          return `${entryName}.${ext}`;
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
          '@bodhiapp/bodhi-js-core/api',
          '@bodhiapp/bodhi-js-core/types',
          '@bodhiapp/ts-client',
        ],
      },
    },
    plugins: [
      svgr(),
      dts({
        outDir: 'dist',
        rollupTypes: false,
        insertTypesEntry: true,
        copyDtsFiles: true,
        pathsToAliases: false,
        staticImport: true,
        entryRoot: 'src',
      }),
    ],
    resolve: {
      alias: {
        '@bodhiapp/bodhi-js-core/api': resolve(__dirname, '../core/src/api/index.ts'),
        '@bodhiapp/bodhi-js-core/types': resolve(__dirname, '../core/src/types/index.ts'),
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
