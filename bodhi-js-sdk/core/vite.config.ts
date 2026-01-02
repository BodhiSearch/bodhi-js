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
        name: 'BodhiCore',
        formats: ['es', 'cjs'],
        fileName: (format) => {
          if (format === 'es') return 'bodhi-core.esm.js';
          if (format === 'cjs') return 'bodhi-core.cjs.js';
          return `bodhi-core.${format}.js`;
        },
      },
      sourcemap: isDev,
      minify: isDev ? false : 'esbuild',
      emptyOutDir: false, // Don't clear dist/ - preserves dist/cli/ from build-cli
      rollupOptions: {
        external: ['@bodhiapp/ts-client', 'ua-parser-js'],
      },
    },
    plugins: [
      dts({
        outDir: 'dist',
        rollupTypes: false,
        exclude: ['**/*.html'],
        insertTypesEntry: true,
        copyDtsFiles: true,
      }),
    ],
    resolve: {
      alias: {
        '@bodhiapp/bodhi-browser/types': resolve(__dirname, '../../bodhi-browser-ext/src/types'),
        '@bodhiapp/setup-modal/types': resolve(__dirname, '../../setup-modal/src/types'),
      },
    },
  };
});
