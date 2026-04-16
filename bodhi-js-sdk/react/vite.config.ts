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
          'api/openai': resolve(__dirname, 'src/api/openai.ts'),
          'api/anthropic': resolve(__dirname, 'src/api/anthropic.ts'),
          'api/gemini': resolve(__dirname, 'src/api/gemini.ts'),
          mcp: resolve(__dirname, 'src/mcp.ts'),
        },
        name: 'BodhiReact',
        formats: ['es', 'cjs'],
        fileName: (format, entryName) => {
          if (entryName === 'index') {
            if (format === 'es') return 'bodhi-react.esm.js';
            if (format === 'cjs') return 'bodhi-react.cjs.js';
            return `bodhi-react.${format}.js`;
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
          '@bodhiapp/bodhi-js-react-core',
          '@bodhiapp/bodhi-js-react-core/api',
          '@bodhiapp/bodhi-js-react-core/api/openai',
          '@bodhiapp/bodhi-js-react-core/api/anthropic',
          '@bodhiapp/bodhi-js-react-core/api/gemini',
          '@bodhiapp/bodhi-js',
          '@bodhiapp/bodhi-js-core',
          '@bodhiapp/bodhi-js-core/api',
          '@bodhiapp/bodhi-js-core/api/openai',
          '@bodhiapp/bodhi-js-core/api/anthropic',
          '@bodhiapp/bodhi-js-core/api/gemini',
          '@bodhiapp/bodhi-js-core/types',
          '@bodhiapp/bodhi-js-core/mcp',
          /^@bodhiapp\/ts-client(\/.*)?$/,
          '@modelcontextprotocol/sdk',
          /^@modelcontextprotocol\/sdk\//,
          '@bodhiapp/bodhi-browser-types',
          '@bodhiapp/setup-modal-types',
        ],
      },
    },
    plugins: [
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
    esbuild: {
      jsx: 'automatic',
    },
  };
});
