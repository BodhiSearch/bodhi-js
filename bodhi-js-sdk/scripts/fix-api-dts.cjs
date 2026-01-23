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
 * Re-export all OpenAI-compatible types from @bodhiapp/ts-client
 *
 * Usage:
 * import type { CreateChatCompletionRequest, Model } from '@bodhiapp/bodhi-js-core/api';
 */
export * from '@bodhiapp/ts-client';
`,
  },
  {
    file: 'react-core/dist/api/index.d.ts',
    content: `/**
 * Re-export all OpenAI-compatible types from @bodhiapp/bodhi-js-core/api
 *
 * Usage:
 * import type { CreateChatCompletionRequest, Model } from '@bodhiapp/bodhi-js-react-core/api';
 */
export * from '@bodhiapp/bodhi-js-core/api';
`,
  },
  {
    file: 'react/dist/api/index.d.ts',
    content: `/**
 * Re-export all OpenAI-compatible types from @bodhiapp/bodhi-js-core/api
 *
 * Usage:
 * import type { CreateChatCompletionRequest, Model } from '@bodhiapp/bodhi-js-react/api';
 */
export * from '@bodhiapp/bodhi-js-core/api';
`,
  },
  {
    file: 'react-ext/dist/api/index.d.ts',
    content: `/**
 * Re-export all OpenAI-compatible types from @bodhiapp/bodhi-js-core/api
 *
 * Usage:
 * import type { CreateChatCompletionRequest, Model } from '@bodhiapp/bodhi-js-react-ext/api';
 */
export * from '@bodhiapp/bodhi-js-core/api';
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
