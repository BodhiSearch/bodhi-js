/**
 * Setup modal CLI for @bodhiapp/bodhi-js-core
 *
 * Installs both v1 and v2 modal HTML files into an extension's
 * src/bodhi-js-core/ directory and registers them in manifest.json
 * (web_accessible_resources + sandbox.pages).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';

// Vite embeds both modal HTML files at build time via the ?raw suffix.
import modalHtml from '../src/onboarding/modal.html?raw';
import modalV2Html from '../src/onboarding/modal-v2.html?raw';
import packageJson from '../package.json';

const VERSION = packageJson.version;
const TARGET_DIR = 'src/bodhi-js-core';
const TARGET_VERSION = resolve(TARGET_DIR, 'version.json');
const MANIFEST_PATH = 'manifest.json';

interface ModalVariant {
  filename: string;
  html: string;
}

const VARIANTS: ModalVariant[] = [
  { filename: 'setup-modal.html', html: modalHtml },
  { filename: 'setup-modal-v2.html', html: modalV2Html },
];

function setupModal() {
  let filesWritten = false;
  let manifestUpdated = false;

  mkdirSync(TARGET_DIR, { recursive: true });

  // 1. Decide whether to write HTML files based on version tracking
  let shouldWriteHtml = true;
  if (existsSync(TARGET_VERSION)) {
    const versionData = JSON.parse(readFileSync(TARGET_VERSION, 'utf-8'));
    if (versionData.version === VERSION) {
      console.log(`✓ Modal HTML already at version ${VERSION}, skipping copy`);
      shouldWriteHtml = false;
    } else {
      console.log(`⬆ Upgrading modal from ${versionData.version} to ${VERSION}`);
    }
  }

  // 2. Write each variant's HTML plus a shared version.json
  if (shouldWriteHtml) {
    for (const variant of VARIANTS) {
      const target = resolve(TARGET_DIR, variant.filename);
      writeFileSync(target, variant.html, 'utf-8');
      console.log(`✓ Created ${target}`);
    }
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
    console.log(`✓ Created ${TARGET_VERSION}`);
    filesWritten = true;
  }

  // 3. Update manifest.json (smart merge across both variants)
  if (existsSync(MANIFEST_PATH)) {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
    const modalPaths = VARIANTS.map((v) => `${TARGET_DIR}/${v.filename}`);

    // web_accessible_resources
    if (!manifest.web_accessible_resources) {
      manifest.web_accessible_resources = [
        {
          resources: [...modalPaths, 'assets/*'],
          matches: ['<all_urls>'],
        },
      ];
      writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
      console.log(`✓ Added web_accessible_resources to manifest.json`);
      manifestUpdated = true;
    } else {
      for (const modalPath of modalPaths) {
        const hasPath = manifest.web_accessible_resources.some(
          (entry: any) => entry.resources && entry.resources.includes(modalPath)
        );
        if (!hasPath) {
          if (manifest.web_accessible_resources[0].resources) {
            manifest.web_accessible_resources[0].resources.push(modalPath);
          } else {
            manifest.web_accessible_resources[0].resources = [modalPath];
          }
          writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
          console.log(`✓ Added ${modalPath} to web_accessible_resources`);
          manifestUpdated = true;
        }
      }
    }

    // sandbox.pages
    for (const modalPath of modalPaths) {
      const hasSandbox =
        manifest.sandbox && manifest.sandbox.pages && manifest.sandbox.pages.includes(modalPath);
      if (!hasSandbox) {
        if (!manifest.sandbox) {
          manifest.sandbox = { pages: [modalPath] };
        } else if (!manifest.sandbox.pages) {
          manifest.sandbox.pages = [modalPath];
        } else {
          manifest.sandbox.pages.push(modalPath);
        }
        writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
        console.log(`✓ Added ${modalPath} to sandbox.pages`);
        manifestUpdated = true;
      }
    }
  } else {
    console.warn('⚠ manifest.json not found, skipping manifest update');
  }

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
