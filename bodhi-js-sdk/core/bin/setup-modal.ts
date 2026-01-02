/**
 * Setup modal CLI for @bodhiapp/bodhi-js-core
 * Configures extension manifest and copies modal HTML for extension mode
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';

// Vite embeds these at build time
import modalHtml from '../src/onboarding/modal.html?raw';
import packageJson from '../package.json';

const VERSION = packageJson.version;
const TARGET_DIR = 'src/bodhi-js-core';
const TARGET_HTML = resolve(TARGET_DIR, 'setup-modal.html');
const TARGET_VERSION = resolve(TARGET_DIR, 'version.json');
const MANIFEST_PATH = 'manifest.json';

function setupModal() {
  let filesWritten = false;
  let manifestUpdated = false;

  // 1. Check if HTML file needs update
  mkdirSync(TARGET_DIR, { recursive: true });

  let shouldWriteHtml = true;
  if (existsSync(TARGET_HTML)) {
    // Check version
    if (existsSync(TARGET_VERSION)) {
      const versionData = JSON.parse(readFileSync(TARGET_VERSION, 'utf-8'));
      if (versionData.version === VERSION) {
        console.log(`✓ Modal HTML already at version ${VERSION}, skipping copy`);
        shouldWriteHtml = false;
      } else {
        console.log(`⬆ Upgrading modal from ${versionData.version} to ${VERSION}`);
      }
    }
  }

  // 2. Write HTML and version if needed
  if (shouldWriteHtml) {
    writeFileSync(TARGET_HTML, modalHtml, 'utf-8');
    writeFileSync(
      TARGET_VERSION,
      JSON.stringify(
        {
          version: VERSION,
          updatedAt: new Date().toISOString(),
        },
        null,
        2
      ),
      'utf-8'
    );
    console.log(`✓ Created ${TARGET_HTML}`);
    console.log(`✓ Created ${TARGET_VERSION}`);
    filesWritten = true;
  }

  // 3. Update manifest.json (smart merge)
  if (existsSync(MANIFEST_PATH)) {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
    const modalPath = 'src/bodhi-js-core/setup-modal.html';

    // Check if web_accessible_resources exists
    if (!manifest.web_accessible_resources) {
      // Create new entry
      manifest.web_accessible_resources = [
        {
          resources: [modalPath, 'assets/*'],
          matches: ['<all_urls>'],
        },
      ];
      writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
      console.log(`✓ Added web_accessible_resources to manifest.json`);
      manifestUpdated = true;
    } else {
      // Check if modal path already in resources
      const hasModalPath = manifest.web_accessible_resources.some(
        (entry: any) => entry.resources && entry.resources.includes(modalPath)
      );

      if (!hasModalPath) {
        // Add to first web_accessible_resources entry
        if (manifest.web_accessible_resources[0].resources) {
          manifest.web_accessible_resources[0].resources.push(modalPath);
        } else {
          manifest.web_accessible_resources[0].resources = [modalPath];
        }
        writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
        console.log(`✓ Added setup-modal.html to web_accessible_resources`);
        manifestUpdated = true;
      } else {
        console.log(`✓ Modal already in web_accessible_resources, skipping`);
      }
    }

    // 4. Update sandbox.pages
    const hasSandboxPages =
      manifest.sandbox && manifest.sandbox.pages && manifest.sandbox.pages.includes(modalPath);

    if (!hasSandboxPages) {
      if (!manifest.sandbox) {
        manifest.sandbox = { pages: [modalPath] };
      } else if (!manifest.sandbox.pages) {
        manifest.sandbox.pages = [modalPath];
      } else if (!manifest.sandbox.pages.includes(modalPath)) {
        manifest.sandbox.pages.push(modalPath);
      }
      writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
      console.log(`✓ Added setup-modal.html to sandbox.pages`);
      manifestUpdated = true;
    } else {
      console.log(`✓ Modal already in sandbox.pages, skipping`);
    }
  } else {
    console.warn('⚠ manifest.json not found, skipping manifest update');
  }

  // Summary
  console.log('');
  if (filesWritten || manifestUpdated) {
    console.log('✅ Setup complete!');
    console.log('');
    console.log('Add to .gitignore:');
    console.log('  src/bodhi-js-core/');
  } else {
    console.log('✅ Already configured - no changes needed');
  }
}

setupModal();
