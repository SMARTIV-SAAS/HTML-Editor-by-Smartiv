/**
 * Font registry.
 *
 * Two tiers, on purpose:
 *
 *   bundled — shipped inside the APK under assets/fonts/. Always available,
 *             zero network, the safe default for signage.
 *   remote  — hosted by the CMS and cached on the player's disk. The CMS
 *             downloads the .woff2 from Google once at import time (OFL/Apache
 *             permit self-hosting), so the player never talks to Google and the
 *             file cannot change under us when Google updates a family.
 *
 * A remote font costs one network round trip on the *first* play only. After
 * that the player serves it from filesDir and it is exactly as fast as bundled.
 *
 * `family` must match the @font-face name exactly — that string is what ends up
 * inline in stored HTML, so renaming it orphans existing content.
 */

/** Bundled in the APK. */
export const FONTS = [
  { id: 'roboto', label: 'Roboto', family: 'Roboto', file: 'RobotoFlex.ttf' },
  { id: 'montserrat', label: 'Montserrat', family: 'Montserrat', file: 'Montserrat-VariableFont_wght.ttf' },
  { id: 'lexend', label: 'Lexend Deca', family: 'LexendDeca', file: 'LexendDeca-VariableFont_wght.ttf' },
  { id: 'funnel', label: 'Funnel Sans', family: 'FunnelSans', file: 'FunnelSans-VariableFont_wght.ttf' },
  // The comma in this filename is legal but must stay inside the quotes in url().
  { id: 'newsreader', label: 'Newsreader', family: 'Newsreader', file: 'Newsreader-VariableFont_opsz,wght.ttf', fallback: 'serif' },
  { id: 'monbaiti', label: 'Mongolian Baiti', family: 'Monbaiti', file: 'monbaiti.ttf' },
  { id: 'greatvibes', label: 'Great Vibes', family: 'GreatVibes', file: 'GreatVibes-Regular.ttf', fallback: 'cursive' },
  { id: 'monsieur', label: 'Monsieur La Doulaise', family: 'Monsieur', file: 'MonsieurLaDoulaise-Regular.ttf', fallback: 'cursive' },
  { id: 'lavishly', label: 'Lavishly Yours', family: 'Lavishly', file: 'LavishlyYours-Regular.ttf', fallback: 'cursive' },
  { id: 'luxurious', label: 'Luxurious Script', family: 'Luxurious', file: 'LuxuriousScript-Regular.ttf', fallback: 'cursive' },
  { id: 'pacifico', label: 'Pacifico', family: 'Pacifico', file: 'Pacifico-Regular.ttf', fallback: 'cursive' },
  { id: 'zap', label: 'Zap', family: 'Zap', file: 'ZAP.ttf', fallback: 'cursive' },

  // Not a file — always available, safe when an asset is missing.
  { id: 'system', label: 'System sans', stack: 'system-ui, -apple-system, sans-serif' },
  { id: 'mono', label: 'Monospace', stack: '"Courier New", monospace' }
];

/**
 * Shape of a remote entry, as returned by the CMS `GET /api/fonts`:
 *
 *   {
 *     id: 'oswald',
 *     label: 'Oswald',
 *     family: 'Oswald',          // must match what the .woff2 declares
 *     fallback: 'sans-serif',
 *     source: 'remote',
 *     faces: [
 *       { file: 'oswald-400.woff2', weight: 400 },
 *       { file: 'oswald-600.woff2', weight: 600 }
 *     ]
 *   }
 *
 * `file` is relative to the CMS font base URL so the same record works for the
 * editor preview and the player.
 */

/** Normalise `file` shorthand into the `faces` array both tiers share. */
function facesOf(font) {
  if (font.faces?.length) return font.faces;
  if (font.file) return [{ file: font.file, weight: font.weight ?? null, style: font.style ?? null }];
  return [];
}

/** Fonts that need a download of some kind (i.e. not a pure system stack). */
export function fileFonts(fonts) {
  return fonts.filter((f) => facesOf(f).length > 0);
}

/** The CSS font-family value written into the document. */
export function fontStack(font) {
  if (font.stack) return font.stack;
  return `"${font.family}", ${font.fallback ?? 'sans-serif'}`;
}

/** Options for the editor's Font select. */
export function fontOptions(fonts = FONTS) {
  return fonts.map((f) => ({ value: fontStack(f), text: f.label }));
}

function formatOf(file) {
  if (file.endsWith('.woff2')) return 'woff2';
  if (file.endsWith('.woff')) return 'woff';
  if (file.endsWith('.otf')) return 'opentype';
  return 'truetype';
}

/**
 * @font-face declarations.
 *
 * Bundled and remote fonts resolve against different bases — assets on the
 * player, the CMS host for everything else — so both are passed separately.
 * Either may be omitted; entries whose base is missing are skipped rather than
 * emitted with a broken URL.
 */
export function fontFaceCss({ bundledBase, remoteBase } = {}, fonts = FONTS) {
  const withSlash = (b) => (b.endsWith('/') ? b : `${b}/`);

  return fileFonts(fonts)
    .flatMap((font) => {
      const base = font.source === 'remote' ? remoteBase : bundledBase;
      if (!base) return [];
      return facesOf(font).map((face) => {
        const lines = [
          `  font-family: '${font.family}';`,
          `  src: url('${withSlash(base)}${face.file}') format('${formatOf(face.file)}');`,
          `  font-display: swap;`
        ];
        if (face.weight) lines.splice(2, 0, `  font-weight: ${face.weight};`);
        if (face.style) lines.splice(2, 0, `  font-style: ${face.style};`);
        return `@font-face {\n${lines.join('\n')}\n}`;
      });
    })
    .join('\n');
}

/**
 * Legacy Quill class map. Existing content carries `class="ql-font-<id>"`, so
 * these must keep resolving. `.ql-font-greatvibes` is new: the original
 * stylesheet declared `.ql-font-monsieur` twice, and the second rule silently
 * shadowed the Great Vibes mapping.
 */
export function quillFontClassCss(fonts = FONTS) {
  return fileFonts(fonts)
    .map((f) => `.ql-font-${f.id} { font-family: ${fontStack(f)}; }`)
    .join('\n');
}

/**
 * Which registered fonts a document actually uses.
 *
 * Matches the inline `font-family` the editor writes and the legacy
 * `ql-font-*` classes. The result is what gets stored in the screen's `fonts`
 * column, so the player can warm its cache before the screen is due.
 */
export function usedFonts(html, fonts = FONTS) {
  const source = String(html ?? '');
  return fileFonts(fonts).filter(
    (f) => (f.family && source.includes(f.family)) || source.includes(`ql-font-${f.id}`)
  );
}

/** Just the family names — the compact form worth persisting. */
export function usedFontNames(html, fonts = FONTS) {
  return usedFonts(html, fonts).map((f) => f.family);
}
