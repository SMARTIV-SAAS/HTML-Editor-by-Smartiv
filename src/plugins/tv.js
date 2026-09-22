/**
 * Android TV output plugin.
 *
 * Signage-specific pieces that a generic editor has no reason to ship:
 *  - split panels (the two-up side-by-side layout)
 *  - a 1920x1080 preview with the 5% overscan safe area drawn on top
 *  - export to a standalone HTML document with the TV stylesheet inlined,
 *    so the WebView loads one file and pulls nothing off the network
 */
import { TV_CSS } from '../styles/tvCss.js';
import { bakeColons } from '../core/output.js';
import { FONTS, fontFaceCss, usedFonts } from '../fonts.js';

export function tvPlugin(editor) {
  /**
   * One panel is the default layout — most room screens show a single event.
   * The column count is a knob, not a fork: the same markup goes 1 → 2 → 3
   * without retyping the content.
   */
  editor.addCommand('insertPanel', (columns = 1) => {
    const count = Number(columns) || 1;
    const wrap = document.createElement('div');
    wrap.className = 'sv-panels';
    wrap.setAttribute('data-sv-block', 'panels');
    wrap.setAttribute('data-sv-columns', String(count));
    for (let i = 0; i < count; i++) wrap.appendChild(buildPanel());

    const spacer = document.createElement('p');
    spacer.innerHTML = '<br>';
    editor.selection.insert(wrap);
    wrap.after(spacer);
    return true;
  });

  /** Caret inside a panel block: change its column count. Otherwise: insert one. */
  editor.addCommand('panelColumns', (columns) => {
    const count = Number(columns) || 1;
    const wrap = editor.selection.closest(
      (n) => n.nodeType === 1 && n.classList?.contains('sv-panels')
    );
    if (!wrap) return editor.execCommand('insertPanel', count);

    const panels = [...wrap.querySelectorAll(':scope > .sv-panel')];
    // Shrinking keeps the leading panels; the operator drops content knowingly.
    for (let i = count; i < panels.length; i++) panels[i].remove();
    for (let i = panels.length; i < count; i++) wrap.appendChild(buildPanel());
    wrap.setAttribute('data-sv-columns', String(count));
    return true;
  });

  editor.addCommand('togglePreview', () => {
    editor.events.emit('toggle-preview');
    return true;
  });

  editor.addCommand('toggleSafeArea', () => {
    editor.events.emit('toggle-safe-area');
    return true;
  });

  editor.addCommand('exportTv', () => {
    const html = buildDocument(editor.getContent(), editor.options.tv ?? {});
    editor.events.emit('export', { filename: 'smartiv-screen.html', html });
    return html;
  });

  editor.ui.addButton('panels', { icon: '▭', label: 'Insert panel', command: 'insertPanel' });
  editor.ui.addSelect('panelColumns', {
    label: 'Columns',
    width: 130,
    command: 'panelColumns',
    options: [
      { value: '1', text: '1 column' },
      { value: '2', text: '2 columns' },
      { value: '3', text: '3 columns' }
    ],
    value: () => {
      const wrap = editor.selection.closest(
        (n) => n.nodeType === 1 && n.classList?.contains('sv-panels')
      );
      return wrap?.getAttribute('data-sv-columns') ?? '1';
    }
  });
  editor.ui.addButton('preview', { icon: '📺', label: 'TV preview (1080p)', command: 'togglePreview' });
  editor.ui.addButton('safeArea', { icon: '⛶', label: 'Overscan safe area', command: 'toggleSafeArea' });
  editor.ui.addButton('exportTv', { icon: '⇩', label: 'Export HTML for TV', command: 'exportTv' });
}
tvPlugin.pluginName = 'tv';

/**
 * Standalone document for the WebView. Fonts are not fetched — Android TV
 * devices are frequently offline or behind a captive portal, and a font that
 * fails to load reflows the whole screen mid-rotation.
 */
export function buildDocument(bodyHtml, opts = {}) {
  const {
    title = 'Smartiv Screen',
    // Transparent by default — the player composes its own wallpaper behind the
    // WebView. Text colour comes from the inline colours the operator picked;
    // `color` is only a fallback for runs with no explicit colour.
    background = 'transparent',
    color = '#14181d',
    rule = 'rgba(0, 0, 0, .18)',
    ruleSoft = 'rgba(0, 0, 0, .05)',
    fontFamily = 'Roboto, "Noto Sans", system-ui, sans-serif',
    rootFontSize = '16px',
    safeArea = '5%',
    // Where this output resolves font files. The Android player supplies its own
    // fonts.css from assets and leaves both unset; a standalone export meant to
    // open anywhere sets them to CMS URLs.
    fontBundledBase = null,
    fontRemoteBase = null,
    fontCatalog = FONTS
  } = opts;

  // Only the families this document actually uses — a screen on bundled fonts
  // alone then issues no font request at all.
  const faces = (fontBundledBase || fontRemoteBase)
    ? fontFaceCss(
        { bundledBase: fontBundledBase, remoteBase: fontRemoteBase },
        usedFonts(bodyHtml, fontCatalog)
      )
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=1920, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
:root {
  --sv-bg: ${background};
  --sv-color: ${color};
  --sv-rule: ${rule};
  --sv-rule-soft: ${ruleSoft};
  --sv-font: ${fontFamily};
  --sv-safe-area: ${safeArea};
  font-size: ${rootFontSize};
}
${faces ? faces + '\n' : ''}${TV_CSS}
</style>
</head>
<body class="sv-tv">
<main class="sv-tv__safe">
${bakeColons(bodyHtml)}
</main>
</body>
</html>`;
}

function buildPanel() {
  const panel = document.createElement('div');
  panel.className = 'sv-panel';
  panel.innerHTML =
    '<h2 class="sv-panel__title">PANEL TITLE</h2>' +
    '<dl class="sv-fields" data-sv-colon="align">' +
    '<dt>Event</dt><dd>Description</dd>' +
    '<dt>Time</dt><dd>00.00 – 00.00</dd>' +
    '</dl>';
  return panel;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
