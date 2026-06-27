/**
 * Copies Font Awesome and web fonts into assets/ for fully offline UI.
 * Run: node scripts/sync-vendor-assets.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const NODE_MODULES = path.join(ROOT, 'node_modules');

const FA_SRC = path.join(NODE_MODULES, '@fortawesome', 'fontawesome-free');
const FA_DEST = path.join(ROOT, 'assets', 'vendor', 'fontawesome');

const JAKARTA_SRC = path.join(NODE_MODULES, '@fontsource', 'plus-jakarta-sans', 'files');
const PLAYFAIR_SRC = path.join(NODE_MODULES, '@fontsource', 'playfair-display', 'files');
const FONTS_DEST = path.join(ROOT, 'assets', 'fonts');

const JAKARTA_FILES = [
  'plus-jakarta-sans-latin-400-normal.woff2',
  'plus-jakarta-sans-latin-500-normal.woff2',
  'plus-jakarta-sans-latin-600-normal.woff2',
  'plus-jakarta-sans-latin-700-normal.woff2',
  'plus-jakarta-sans-latin-800-normal.woff2',
  'plus-jakarta-sans-latin-400-italic.woff2',
  'plus-jakarta-sans-latin-ext-400-normal.woff2',
  'plus-jakarta-sans-latin-ext-500-normal.woff2',
  'plus-jakarta-sans-latin-ext-600-normal.woff2',
  'plus-jakarta-sans-latin-ext-700-normal.woff2',
  'plus-jakarta-sans-latin-ext-800-normal.woff2',
  'plus-jakarta-sans-latin-ext-400-italic.woff2',
];

const PLAYFAIR_FILES = [
  'playfair-display-latin-600-normal.woff2',
  'playfair-display-latin-700-normal.woff2',
  'playfair-display-latin-600-italic.woff2',
  'playfair-display-latin-700-italic.woff2',
  'playfair-display-latin-ext-600-normal.woff2',
  'playfair-display-latin-ext-700-normal.woff2',
  'playfair-display-latin-ext-600-italic.woff2',
  'playfair-display-latin-ext-700-italic.woff2',
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error(`Missing source file: ${src}`);
  }
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDir(srcDir, destDir) {
  ensureDir(destDir);
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function syncFontAwesome() {
  if (!fs.existsSync(FA_SRC)) {
    throw new Error('Run npm install first (@fortawesome/fontawesome-free).');
  }
  ensureDir(path.join(FA_DEST, 'css'));
  copyFile(
    path.join(FA_SRC, 'css', 'all.min.css'),
    path.join(FA_DEST, 'css', 'all.min.css')
  );
  copyDir(path.join(FA_SRC, 'webfonts'), path.join(FA_DEST, 'webfonts'));
}

function syncFonts() {
  if (!fs.existsSync(JAKARTA_SRC) || !fs.existsSync(PLAYFAIR_SRC)) {
    throw new Error('Run npm install first (@fontsource packages).');
  }

  const jakartaDest = path.join(FONTS_DEST, 'plus-jakarta-sans');
  const playfairDest = path.join(FONTS_DEST, 'playfair-display');
  ensureDir(jakartaDest);
  ensureDir(playfairDest);

  for (const file of JAKARTA_FILES) {
    copyFile(path.join(JAKARTA_SRC, file), path.join(jakartaDest, file));
  }
  for (const file of PLAYFAIR_FILES) {
    copyFile(path.join(PLAYFAIR_SRC, file), path.join(playfairDest, file));
  }
}

function syncDocxPreview() {
  const docxSrc = path.join(NODE_MODULES, 'docx-preview', 'dist', 'docx-preview.min.js');
  const jszipSrc = path.join(NODE_MODULES, 'jszip', 'dist', 'jszip.min.js');
  const docxDest = path.join(ROOT, 'assets', 'vendor', 'docx-preview');

  if (!fs.existsSync(docxSrc) || !fs.existsSync(jszipSrc)) {
    throw new Error('Run npm install first (docx-preview, jszip).');
  }

  ensureDir(docxDest);
  copyFile(jszipSrc, path.join(docxDest, 'jszip.min.js'));
  copyFile(docxSrc, path.join(docxDest, 'docx-preview.min.js'));
}

function main() {
  syncFontAwesome();
  syncFonts();
  syncDocxPreview();
  console.log('Synced offline UI assets to assets/vendor/fontawesome, assets/fonts/, and assets/vendor/docx-preview/');
}

main();
