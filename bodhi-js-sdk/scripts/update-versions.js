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

// All packages in monorepo
const packages = ['core', 'web', 'ext', 'cli', 'react-core', 'react', 'react-ext'];

// Map directory name to npm package name
const packageNameMap = {
  core: '@bodhiapp/bodhi-js-core',
  web: '@bodhiapp/bodhi-js',
  ext: '@bodhiapp/bodhi-js-ext',
  cli: '@bodhiapp/bodhi-js-cli',
  'react-core': '@bodhiapp/bodhi-js-react-core',
  react: '@bodhiapp/bodhi-js-react',
  'react-ext': '@bodhiapp/bodhi-js-react-ext',
};

// Type packages (outside bodhi-js-sdk)
const typePackages = [
  { name: '@bodhiapp/bodhi-browser-types', path: '../bodhi-browser-ext/src/types' },
  { name: '@bodhiapp/setup-modal-types', path: '../setup-modal/src/types' },
];

// Map type package name to file: path for dependency management
const typePackageMap = {
  '@bodhiapp/bodhi-browser-types': 'file:../../bodhi-browser-ext/src/types',
  '@bodhiapp/setup-modal-types': 'file:../../setup-modal/src/types',
};

async function updatePackage(packageName, version, mode) {
  const packagePath = join(rootDir, packageName, 'package.json');
  const content = await readFile(packagePath, 'utf-8');
  const pkg = JSON.parse(content);

  // Update version
  pkg.version = version;

  // Update dependencies - dynamically convert all file: references
  if (pkg.dependencies) {
    for (const [depName, depVersion] of Object.entries(pkg.dependencies)) {
      // Check if this is a type package dependency
      if (typePackageMap[depName]) {
        if (mode === 'release') {
          // Convert to npm version
          pkg.dependencies[depName] = version;
          console.log(`  ${depName}: ${depVersion} → ${version}`);
        } else {
          // Restore to file: protocol in dev mode
          pkg.dependencies[depName] = typePackageMap[depName];
          console.log(`  ${depName}: ${depVersion} → ${typePackageMap[depName]}`);
        }
      }
      // Check if this is a file: reference to a local SDK package
      else if (depVersion.startsWith('file:../')) {
        const targetDir = depVersion.replace('file:../', '');
        const targetPackageName = packageNameMap[targetDir];

        if (targetPackageName) {
          if (mode === 'release') {
            // Convert to exact version
            pkg.dependencies[depName] = version;
            console.log(`  ${depName}: ${depVersion} → ${version}`);
          } else {
            // Keep file: protocol (already in correct format)
            console.log(`  ${depName}: ${depVersion} (unchanged)`);
          }
        }
      } else if (mode === 'dev' && packageNameMap[Object.keys(packageNameMap).find(k => packageNameMap[k] === depName)]) {
        // Restore to file: protocol in dev mode
        const targetDir = Object.keys(packageNameMap).find(k => packageNameMap[k] === depName);
        if (targetDir && packages.includes(targetDir)) {
          pkg.dependencies[depName] = `file:../${targetDir}`;
          console.log(`  ${depName}: ${depVersion} → file:../${targetDir}`);
        }
      }
    }
  }

  await writeFile(packagePath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`Updated ${packageName}: version=${version}, mode=${mode}`);
}

async function updateTypePackage(typePackage, version) {
  const packagePath = join(rootDir, typePackage.path, 'package.json');
  const content = await readFile(packagePath, 'utf-8');
  const pkg = JSON.parse(content);

  pkg.version = version;

  await writeFile(packagePath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`Updated ${typePackage.name}: version=${version}`);
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

  // Update all SDK packages
  for (const pkg of packages) {
    await updatePackage(pkg, version, mode);
  }

  // Update type packages
  console.log('Updating type packages...');
  for (const typePkg of typePackages) {
    await updateTypePackage(typePkg, version);
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
