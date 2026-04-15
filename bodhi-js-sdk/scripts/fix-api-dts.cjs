#!/usr/bin/env node
/**
 * Post-build script to fix .d.ts files for /api subpath exports
 * The vite-plugin-dts resolves aliases incorrectly for re-exported packages,
 * so we manually fix them to preserve the external package references.
 */

const fs = require('fs');
const path = require('path');

const fixes = [
  {
    file: 'core/dist/api/index.d.ts',
    content: `/**
 * Re-export BodhiApp management API types.
 * For OpenAI-compatible types use '@bodhiapp/bodhi-js-core/api/openai'.
 */
export * from '@bodhiapp/ts-client';
`,
  },
  {
    file: 'core/dist/api/openai.d.ts',
    content: `/**
 * Re-export OpenAI-compatible API types.
 */
export * from '@bodhiapp/ts-client/openai';
`,
  },
  {
    file: 'react-core/dist/api/index.d.ts',
    content: `/**
 * Re-export management API types from @bodhiapp/bodhi-js-core/api.
 */
export * from '@bodhiapp/bodhi-js-core/api';
`,
  },
  {
    file: 'react-core/dist/api/openai.d.ts',
    content: `/**
 * Re-export OpenAI API types from @bodhiapp/bodhi-js-core/api/openai.
 */
export * from '@bodhiapp/bodhi-js-core/api/openai';
`,
  },
  {
    file: 'react/dist/api/index.d.ts',
    content: `/**
 * Re-export management API types from @bodhiapp/bodhi-js-core/api.
 */
export * from '@bodhiapp/bodhi-js-core/api';
`,
  },
  {
    file: 'react/dist/api/openai.d.ts',
    content: `/**
 * Re-export OpenAI API types from @bodhiapp/bodhi-js-core/api/openai.
 */
export * from '@bodhiapp/bodhi-js-core/api/openai';
`,
  },
  {
    file: 'react-ext/dist/api/index.d.ts',
    content: `/**
 * Re-export management API types from @bodhiapp/bodhi-js-core/api.
 */
export * from '@bodhiapp/bodhi-js-core/api';
`,
  },
  {
    file: 'react-ext/dist/api/openai.d.ts',
    content: `/**
 * Re-export OpenAI API types from @bodhiapp/bodhi-js-core/api/openai.
 */
export * from '@bodhiapp/bodhi-js-core/api/openai';
`,
  },
];

fixes.forEach(({ file, content }) => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✓ Fixed ${file}`);
  } else {
    console.warn(`⚠ File not found: ${file}`);
  }
});

console.log('\nAPI .d.ts files fixed successfully');
