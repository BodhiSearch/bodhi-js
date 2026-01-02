#!/usr/bin/env node

/**
 * Update versions and dependencies for bodhi-js-sdk packages
 * Usage:
 *   node update-versions.js 0.1.0 release  - set version X.Y.Z, deps = X.Y.Z
 *   node update-versions.js 0.1.1-dev dev  - set version X.Y.Z-dev, deps = file:../core
 */

import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const packages = ['core', 'web', 'ext', 'react'];
const dependentPackages = ['web', 'ext', 'react'];

async function updatePackage(packageName, version, mode) {
  const packagePath = join(rootDir, packageName, 'package.json');
  const content = await readFile(packagePath, 'utf-8');
  const pkg = JSON.parse(content);

  // Update version
  pkg.version = version;

  // Update dependencies for dependent packages
  if (dependentPackages.includes(packageName)) {
    if (mode === 'release') {
      // Use exact version
      pkg.dependencies['@bodhiapp/bodhi-js-core'] = version;
    } else {
      // Restore file: protocol
      pkg.dependencies['@bodhiapp/bodhi-js-core'] = 'file:../core';
    }
  }

  await writeFile(packagePath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`Updated ${packageName}: version=${version}, mode=${mode}`);
}

async function main() {
  const version = process.argv[2];
  const mode = process.argv[3];

  if (!version || !mode) {
    console.error('Usage: node update-versions.js <version> <mode>');
    console.error('Example: node update-versions.js 0.1.0 release');
    console.error('Example: node update-versions.js 0.1.1-dev dev');
    process.exit(1);
  }

  if (!['release', 'dev'].includes(mode)) {
    console.error('Mode must be either "release" or "dev"');
    process.exit(1);
  }

  // Validate version format
  const versionRegex = mode === 'release' ? /^\d+\.\d+\.\d+$/ : /^\d+\.\d+\.\d+-dev$/;
  if (!versionRegex.test(version)) {
    console.error(`Invalid version format for ${mode} mode: ${version}`);
    console.error(mode === 'release' ? 'Expected format: X.Y.Z' : 'Expected format: X.Y.Z-dev');
    process.exit(1);
  }

  console.log(`Updating all packages to version ${version} (${mode} mode)...`);

  // Update all packages
  for (const pkg of packages) {
    await updatePackage(pkg, version, mode);
  }

  // Run npm install to update package-lock.json
  console.log('Running npm install...');
  try {
    execSync('npm install', { cwd: rootDir, stdio: 'inherit' });
    console.log('Version update complete!');
  } catch (error) {
    console.error('npm install failed:', error.message);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
