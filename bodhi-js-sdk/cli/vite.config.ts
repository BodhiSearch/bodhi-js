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
          mcp: resolve(__dirname, 'src/mcp.ts'),
        },
        name: 'BodhiCli',
        formats: ['es', 'cjs'],
        fileName: (format, entryName) => {
          if (entryName === 'index') {
            if (format === 'es') return 'bodhi-cli.esm.js';
            if (format === 'cjs') return 'bodhi-cli.cjs.js';
            return `bodhi-cli.${format}.js`;
          }
          const ext = format === 'es' ? 'esm.js' : 'cjs.js';
          return `${entryName}.${ext}`;
        },
      },
      sourcemap: isDev,
      minify: isDev ? false : 'esbuild',
      rollupOptions: {
        external: [
          '@bodhiapp/bodhi-js-core',
          '@bodhiapp/bodhi-js-core/mcp',
          /^@bodhiapp\/ts-client(\/.*)?$/,
          '@bodhiapp/bodhi-browser-types',
          '@modelcontextprotocol/sdk',
          /^@modelcontextprotocol\/sdk\//,
          'node:http',
          'node:url',
        ],
      },
    },
    plugins: [
      dts({
        outDir: 'dist',
        rollupTypes: false,
        exclude: ['**/*.test.ts', '**/*.spec.ts'],
        insertTypesEntry: true,
        copyDtsFiles: true,
      }),
    ],
  };
});
