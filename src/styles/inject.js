import { TV_CSS } from './tvCss.js';
import { FONTS, fontFaceCss } from '../fonts.js';

const STYLE_ID = 'smartiv-editor-content-styles';
const FONT_STYLE_ID = 'smartiv-editor-font-faces';

/**
 * Inject the shared content stylesheet once per document. The editing surface
 * and the exported TV document then render from identical rules.
 *
 * The font bases point at wherever the CMS serves the files: `bundledBase` for
 * the .ttf files that also ship in the APK, `remoteBase` for the self-hosted
 * .woff2 files. Without them the dropdown still lists every family, but the
 * editor previews them in a system fallback while the TV shows the real face —
 * the operator would be choosing blind.
 */
export function ensureContentStyles(doc = document, { bundledBase, remoteBase, catalog = FONTS } = {}) {
  if (!doc.getElementById(STYLE_ID)) {
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = TV_CSS;
    doc.head.appendChild(style);
  }

  if (!bundledBase && !remoteBase) return;

  const css = fontFaceCss({ bundledBase, remoteBase }, catalog);
  if (!css) return;

  // Re-inject when the catalogue or a base changes; GET /api/fonts may land
  // after the first render.
  const existing = doc.getElementById(FONT_STYLE_ID);
  if (existing?.textContent === css) return;
  existing?.remove();

  const style = doc.createElement('style');
  style.id = FONT_STYLE_ID;
  style.textContent = css;
  doc.head.appendChild(style);
}
