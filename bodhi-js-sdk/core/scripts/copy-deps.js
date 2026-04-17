import fs from 'fs';

const files = [
  {
    source: '../../setup-modal/dist/index.html',
    target: 'src/onboarding/modal.html',
    description: 'Setup modal HTML',
  },
  {
    source: '../../setup-modal-v2/dist/index.html',
    target: 'src/onboarding/modal-v2.html',
    description: 'Setup modal v2 HTML',
  },
];

// Ensure target directories exist
const targetDirs = ['src/onboarding'];
for (const targetDir of targetDirs) {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
}

// Copy files
for (const file of files) {
  // Check if source exists
  if (!fs.existsSync(file.source)) {
    console.error(`❌ Source file not found: ${file.source}`);
    if (file.source.includes('/dist/')) {
      console.error('Please build setup-modal first: cd ../../setup-modal && npm run build');
    }
    process.exit(1);
  }

  // Copy file
  fs.copyFileSync(file.source, file.target);
  console.log(`✅ Copied ${file.description}: ${file.source} → ${file.target}`);
}
