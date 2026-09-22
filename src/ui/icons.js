/**
 * Toolbar icon set.
 *
 * Keyed by a button's registry `name`, so plugins keep passing a plain-text
 * `icon` glyph and never learn about SVG — ToolbarItem prefers the vector here
 * and falls back to the glyph for anything not listed. One stroke weight, one
 * grid (24), currentColor throughout, so every control reads as one family.
 */

const ICONS = {
  undo: '<path d="M4 11h11a5 5 0 0 1 0 10h-4"/><path d="M8 7l-4 4 4 4"/>',
  redo: '<path d="M20 11H9a5 5 0 0 0 0 10h4"/><path d="M16 7l4 4-4 4"/>',

  bold: '<path d="M7 5h6.5a3.5 3.5 0 0 1 0 7H7z"/><path d="M7 12h7.5a3.5 3.5 0 0 1 0 7H7z"/>',
  italic: '<path d="M19 5h-6"/><path d="M11 19H5"/><path d="M15 5l-4 14"/>',
  underline: '<path d="M7 4v6a5 5 0 0 0 10 0V4"/><path d="M5 20h14"/>',
  strikethrough: '<path d="M5 12h14"/><path d="M16 7.5A4 4 0 0 0 9 8.5"/><path d="M8.5 16A4 4 0 0 0 15.5 15"/>',
  removeFormat: '<path d="M5 6V5h11v1"/><path d="M10 5v9"/><path d="M7 19h6"/><path d="M15.5 15l5 5"/><path d="M20.5 15l-5 5"/>',

  alignLeft: '<path d="M4 6h16"/><path d="M4 12h10"/><path d="M4 18h13"/>',
  alignCenter: '<path d="M4 6h16"/><path d="M7 12h10"/><path d="M5 18h14"/>',
  alignRight: '<path d="M4 6h16"/><path d="M10 12h10"/><path d="M7 18h13"/>',
  alignJustify: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',

  bulletList:
    '<circle cx="4.5" cy="6.5" r="1.3" fill="currentColor" stroke="none"/>' +
    '<circle cx="4.5" cy="12.5" r="1.3" fill="currentColor" stroke="none"/>' +
    '<circle cx="4.5" cy="18.5" r="1.3" fill="currentColor" stroke="none"/>' +
    '<path d="M9 6.5h11"/><path d="M9 12.5h11"/><path d="M9 18.5h11"/>',
  numberList:
    '<path d="M10 6.5h10"/><path d="M10 12.5h10"/><path d="M10 18.5h10"/>' +
    '<path d="M4 5l1.2-.6V9"/><path d="M4 15.2a1.2 1.2 0 0 1 2.3.4c0 1-2.3 1.6-2.3 3.4h2.4"/>',
  outdent: '<path d="M4 6h16"/><path d="M11 12h9"/><path d="M4 18h16"/><path d="M7 9l-3 3 3 3"/>',
  indent: '<path d="M4 6h16"/><path d="M11 12h9"/><path d="M4 18h16"/><path d="M4 9l3 3-3 3"/>',

  link: '<path d="M9.5 14.5l5-5"/><path d="M11 7l1-1a4 4 0 0 1 6 6l-2 2"/><path d="M13 17l-1 1a4 4 0 0 1-6-6l2-2"/>',
  unlink: '<path d="M9 7l-2 2a4 4 0 0 0 6 6"/><path d="M15 17l2-2a4 4 0 0 0-6-6"/><path d="M4 4l16 16"/>',
  hr: '<path d="M4 12h16"/><path d="M6 8h4" opacity=".4"/><path d="M14 16h4" opacity=".4"/>',

  fieldList:
    '<path d="M4 6h5"/><path d="M4 12h5"/><path d="M4 18h5"/>' +
    '<circle cx="11" cy="6" r=".9" fill="currentColor" stroke="none"/>' +
    '<circle cx="11" cy="12" r=".9" fill="currentColor" stroke="none"/>' +
    '<circle cx="11" cy="18" r=".9" fill="currentColor" stroke="none"/>' +
    '<path d="M14 6h6"/><path d="M14 12h6"/><path d="M14 18h6"/>',

  panels: '<rect x="4" y="5" width="16" height="14" rx="1.5"/><path d="M12 5v14"/>',

  table:
    '<rect x="4" y="5" width="16" height="14" rx="1.5"/>' +
    '<path d="M4 10h16"/><path d="M4 14.5h16"/><path d="M10 5v14"/>',
  tableAddRow:
    '<rect x="4" y="5" width="16" height="9" rx="1.5"/><path d="M4 9.5h16"/><path d="M10 5v9"/>' +
    '<path d="M12 17v5"/><path d="M9.5 19.5h5"/>',
  tableAddColumn:
    '<rect x="5" y="4" width="9" height="16" rx="1.5"/><path d="M9.5 4v16"/><path d="M5 10h9"/>' +
    '<path d="M17 12h5"/><path d="M19.5 9.5v5"/>',
  tableDeleteRow:
    '<rect x="4" y="5" width="16" height="9" rx="1.5"/><path d="M4 9.5h16"/><path d="M10 5v9"/>' +
    '<path d="M9.5 19.5h5"/>',
  tableDeleteColumn:
    '<rect x="5" y="4" width="9" height="16" rx="1.5"/><path d="M9.5 4v16"/><path d="M5 10h9"/>' +
    '<path d="M17 12h5"/>',

  darkMode: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  source: '<path d="M9 8l-4 4 4 4"/><path d="M15 8l4 4-4 4"/><path d="M13.5 6l-3 12"/>',
  preview: '<rect x="3" y="5" width="18" height="12" rx="1.5"/><path d="M8 21h8"/><path d="M12 17v4"/>',
  safeArea:
    '<rect x="3" y="4.5" width="18" height="15" rx="1.5"/>' +
    '<rect x="6.5" y="8" width="11" height="8" rx="1" stroke-dasharray="2.5 2.5" opacity=".7"/>',
  exportTv: '<path d="M12 4v10"/><path d="M8 10l4 4 4-4"/><path d="M5 20h14"/>',

  themeToggle:
    '<circle cx="12" cy="12" r="8.5"/>' +
    '<path d="M12 3.5a8.5 8.5 0 0 0 0 17z" fill="currentColor" stroke="none"/>',

  // Text/highlight colour glyphs; the coloured underline bar is drawn by the
  // component from the live value, so it is not part of the vector.
  foreColor: '<path d="M5.5 18l4.5-12 4.5 12"/><path d="M7.5 13.5h5"/>',
  backColor: '<path d="M4 20h16"/><path d="M9 15.5l7-7 2.5 2.5-7 7H9z"/>'
};

/** Wrap inner markup in a sized, stroke-based SVG. Returns '' when unmapped. */
export function iconSvg(name) {
  const inner = ICONS[name];
  if (!inner) return '';
  return (
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" ' +
    'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    inner +
    '</svg>'
  );
}

export function hasIcon(name) {
  return !!ICONS[name];
}
