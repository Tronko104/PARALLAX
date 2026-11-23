/**
 * PARALLAX — Self-Contained Standalone HTML Bundler
 * Bundles the modular ES codebase and CSS into a single zero-dependency HTML file
 * that runs offline and inside CSP-restricted preview containers.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/home/antigravity/Tronko104/PARALLAX';

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
  // Remove top-level import statements anchored at start of line
  let cleaned = code.replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '');
  // Replace top-level `export const/function/class` with `const/function/class`
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

  // Remove external Google Fonts links in standalone bundle so strict CSP never complains,
  // and inline the CSS & JS directly.
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

  const distDir = path.join(ROOT, 'dist');
  fs.mkdirSync(distDir, { recursive: true });
  const distFile = path.join(distDir, 'index.html');
  fs.writeFileSync(distFile, outHtml, 'utf8');
  console.log(`Bundled standalone HTML -> ${distFile} (${outHtml.length} bytes)`);
}

buildStandaloneHtml();
