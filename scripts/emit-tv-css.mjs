/**
 * Emit the player-side stylesheets as plain .css files.
 *
 * The Android app cannot import an ES module, so the same sources that style
 * the editor are written out for `app/src/main/assets/smartiv/`:
 *
 *   tv.css     layout + field lists + panels (from src/styles/tvCss.js)
 *   fonts.css  @font-face + .ql-font-* classes (from src/fonts.js)
 *
 * Adding a font is a one-line change in src/fonts.js: rerun this and copy
 * fonts.css over. The .ttf files themselves still go in assets/fonts/.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { TV_CSS } from '../src/styles/tvCss.js';
import { FONTS, fontFaceCss, legacyFontClassCss } from '../src/fonts.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(root, 'dist');

// Where the player reads the .ttf files from.
const ANDROID_FONT_BASE = process.argv[2] ?? 'file:///android_asset/fonts/';

const banner = (from) =>
  `/* Generated from ${from} — do not edit by hand.\n   Copy to app/src/main/assets/smartiv/ */\n`;

// fontFaceCss takes { bundledBase, remoteBase }; the bundled fonts resolve
// against the asset path. Passing a bare string here silently emitted zero
// @font-face rules, so every .ql-font-* class fell back to a system face.
const faces = fontFaceCss({ bundledBase: ANDROID_FONT_BASE });
if (!faces.trim()) {
  console.error('ERROR: fontFaceCss produced no @font-face rules — fonts would not load. Aborting.');
  process.exit(1);
}

const fontsCss = [
  banner('src/fonts.js'),
  faces,
  '',
  '/* Legacy class map. .ql-font-greatvibes is new: the original stylesheet',
  '   declared .ql-font-monsieur twice and the second rule shadowed Great Vibes. */',
  legacyFontClassCss()
].join('\n');

await mkdir(distDir, { recursive: true });
await writeFile(join(distDir, 'smartiv-tv.css'), banner('src/styles/tvCss.js') + TV_CSS, 'utf8');
await writeFile(join(distDir, 'smartiv-fonts.css'), fontsCss, 'utf8');

const bundled = FONTS.filter((f) => f.file).length;
console.log(`smartiv-tv.css written (${TV_CSS.length} bytes)`);
console.log(`smartiv-fonts.css written (${bundled} bundled fonts, base ${ANDROID_FONT_BASE})`);
