import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'esnext',
    assetsInlineLimit: 100000000, // Inline all assets
    minify: 'terser', // Use terser for better compression
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log statements in production
        drop_debugger: true, // Remove debugger statements
      },
    },
    rollupOptions: {
      output: {
        // Ensure everything is inlined for srcdoc usage
        inlineDynamicImports: true,
      },
    },
  },
});
