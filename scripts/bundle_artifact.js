/**
 * PARALLAX — Self-Contained Standalone HTML & Mobile Asset Bundler
 * Bundles all ES modules and CSS into a single zero-dependency HTML build
 * for offline web, Electron desktop (Windows/Linux), and Android WebView APK.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const MODULE_ORDER = [
  'src/math/prng.js',
  'src/universe/generator.js',
  'src/simulation/engine.js',
  'src/renderer/shaders.js',
  'src/renderer/webgl_renderer.js',
  'src/audio/soundscape.js',
  'src/ui/hud.js',
  'src/main.js'
];

function stripImportsAndExports(code) {
  let cleaned = code.replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '');
  cleaned = cleaned.replace(/^export\s+(const|let|var|function|class)\s+/gm, '$1 ');
  return cleaned.trim();
}

function buildStandaloneHtml() {
  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'src/styles/index.css'), 'utf8');

  const jsChunks = MODULE_ORDER.map((relPath) => {
    const raw = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
    return `// === MODULE: ${relPath} ===\n${stripImportsAndExports(raw)}`;
  });

  const bundledJs = `(function() {\n"use strict";\n\n${jsChunks.join('\n\n')}\n\n})();`;

  let outHtml = indexHtml
    .replace(/<link[^>]*fonts\.googleapis\.com[^>]*>/g, '')
    .replace(/<link[^>]*fonts\.gstatic\.com[^>]*>/g, '')
    .replace(
      '<link rel="stylesheet" href="./src/styles/index.css" />',
      () => `<style>\n${css}\n</style>`
    )
    .replace(
      '<script type="module" src="./src/main.js"></script>',
      () => `<script>\n${bundledJs}\n</script>`
    );

  // Write dist/index.html (Standalone Web + Electron target)
  const distDir = path.join(ROOT, 'dist');
  fs.mkdirSync(distDir, { recursive: true });
  const distFile = path.join(distDir, 'index.html');
  fs.writeFileSync(distFile, outHtml, 'utf8');

  // Sync directly into Android WebView local assets
  const androidAssetsDir = path.join(ROOT, 'android', 'app', 'src', 'main', 'assets', 'www');
  fs.mkdirSync(androidAssetsDir, { recursive: true });
  const androidHtml = path.join(androidAssetsDir, 'index.html');
  fs.writeFileSync(androidHtml, outHtml, 'utf8');

  console.log(`Bundled PARALLAX standalone HTML -> ${distFile} (${outHtml.length} bytes)`);
  console.log(`Synced Android WebView bundle   -> ${androidHtml}`);
}

buildStandaloneHtml();
