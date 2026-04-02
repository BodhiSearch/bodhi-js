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
        entry: {
          index: resolve(__dirname, 'src/index.ts'),
          'api/index': resolve(__dirname, 'src/api/index.ts'),
          'types/index': resolve(__dirname, 'src/types/index.ts'),
          mcp: resolve(__dirname, 'src/mcp.ts'),
        },
        name: 'BodhiCore',
        formats: ['es', 'cjs'],
        fileName: (format, entryName) => {
          if (entryName === 'index') {
            if (format === 'es') return 'bodhi-core.esm.js';
            if (format === 'cjs') return 'bodhi-core.cjs.js';
            return `bodhi-core.${format}.js`;
          }
          const ext = format === 'es' ? 'esm.js' : 'cjs.js';
          return `${entryName}.${ext}`;
        },
      },
      sourcemap: isDev,
      minify: isDev ? false : 'esbuild',
      emptyOutDir: false, // Don't clear dist/ - preserves dist/cli/ from build-cli
      rollupOptions: {
        external: [
          '@bodhiapp/ts-client',
          'ua-parser-js',
          '@bodhiapp/bodhi-browser-types',
          '@bodhiapp/setup-modal-types',
          '@modelcontextprotocol/sdk',
          /^@modelcontextprotocol\/sdk\//,
        ],
      },
    },
    plugins: [
      dts({
        outDir: 'dist',
        rollupTypes: false,
        exclude: ['**/*.html', '**/*.test.ts', '**/*.spec.ts'],
        insertTypesEntry: true,
        copyDtsFiles: true,
        pathsToAliases: false,
        staticImport: true,
        entryRoot: 'src',
      }),
    ],
  };
});
