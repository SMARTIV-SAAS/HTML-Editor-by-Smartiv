/**
 * Font size / family / colour.
 *
 * Text colour is independent of the background theme on purpose. The theme only
 * sets the document default (`--sv-color`); an explicit colour is written as an
 * inline style on a <span>, which outranks the theme in the cascade and travels
 * with the HTML all the way into the Android TV document. Picking white text
 * stays white after the operator switches the background to light, and vice
 * versa — the two settings never overwrite each other.
 *
 * Sizes are expressed in rem against a 16px root so one document scales between
 * the 1080p and 720p panels by moving the root font-size alone.
 */
import { FONTS, fontOptions } from '../fonts.js';

export function typographyPlugin(editor) {
  const sizes = editor.options.fontSizes ?? [
    { value: '1rem', text: 'Small (16)' },
    { value: '1.5rem', text: 'Normal (24)' },
    { value: '2rem', text: 'Medium (32)' },
    { value: '2.5rem', text: 'Large (40)' },
    { value: '3.5rem', text: 'Title (56)' },
    { value: '4.5rem', text: 'Display (72)' }
  ];

  // `fontCatalog` is the merged list the host supplies — bundled fonts plus
  // whatever GET /api/fonts returned. A family offered here but missing on the
  // player falls back to a system face on the TV without any warning, so the
  // catalogue is the contract between the two sides.
  // Read through `editor.fontCatalog` at call time, not once at init: the host
  // replaces it whenever the shared store loads or an upload lands, and the
  // dropdown has to follow without the editor being remounted.
  editor.fontCatalog = editor.options.fontCatalog ?? FONTS;
  const fonts = editor.options.fontFamilies
    ? () => editor.options.fontFamilies
    : () => fontOptions(editor.fontCatalog, { grouped: true });

  editor.addCommand('fontSize', (value) => applyInlineStyle(editor, 'fontSize', value));
  editor.addCommand('fontFamily', (value) => applyInlineStyle(editor, 'fontFamily', value));
  editor.addCommand('foreColor', (value) => applyInlineStyle(editor, 'color', value));
  editor.addCommand('backColor', (value) => applyInlineStyle(editor, 'backgroundColor', value));

  editor.ui.addSelect('fontSize', {
    label: 'Size', width: 140, options: sizes, command: 'fontSize',
    value: () => currentStyle(editor, 'fontSize', sizes)
  });
  editor.ui.addSelect('fontFamily', {
    label: 'Font', width: 160, options: fonts, command: 'fontFamily',
    value: () => currentStyle(editor, 'fontFamily', fonts())
  });
  editor.ui.addColor('foreColor', {
    icon: 'A',
    label: 'Text colour',
    command: 'foreColor',
    resetLabel: 'Use theme colour',
    swatches: editor.options.textColors,
    current: () => currentColor(editor, 'color')
  });
  editor.ui.addColor('backColor', {
    icon: '▣',
    label: 'Highlight colour',
    command: 'backColor',
    resetLabel: 'No highlight',
    swatches: editor.options.bgColors,
    current: () => currentColor(editor, 'backgroundColor')
  });
}
typographyPlugin.pluginName = 'typography';

/**
 * Wrap the selection in a <span> carrying one style property.
 * document.execCommand('fontSize') only speaks the legacy 1-7 scale and emits
 * <font> tags, so the wrapping is done here instead.
 *
 * An empty value clears the property, handing the run back to the theme default.
 */
function applyInlineStyle(editor, prop, value) {
  const range = editor.selection.range();
  if (!range) return false;

  if (!value) return clearInlineStyle(editor, prop);

  if (range.collapsed) {
    // Nothing selected: drop a styled empty span and park the caret inside it.
    const span = document.createElement('span');
    span.style[prop] = value;
    span.appendChild(document.createTextNode('​'));
    editor.selection.insert(span);
    const r = document.createRange();
    r.setStart(span.firstChild, 1);
    r.collapse(true);
    editor.selection.set(r);
    return true;
  }

  const span = document.createElement('span');
  span.style[prop] = value;
  try {
    span.appendChild(range.extractContents());
    range.insertNode(span);
    cleanupNested(span, prop);
    const after = document.createRange();
    after.selectNodeContents(span);
    editor.selection.set(after);
  } catch {
    // extractContents throws on selections that straddle block boundaries.
    editor.native('insertHTML', `<span style="${cssName(prop)}:${value}">${editor.selection.text()}</span>`);
  }
  return true;
}

/** Strip the property from every element the selection touches. */
function clearInlineStyle(editor, prop) {
  const range = editor.selection.range();
  if (!range) return false;

  const scope = range.commonAncestorContainer.nodeType === 1
    ? range.commonAncestorContainer
    : range.commonAncestorContainer.parentElement;

  const targets = [scope, ...(scope?.querySelectorAll('[style]') ?? [])];
  for (const el of targets) {
    if (!el?.style?.[prop]) continue;
    if (el !== scope && !range.intersectsNode(el)) continue;
    el.style[prop] = '';
    if (!el.getAttribute('style')) el.removeAttribute('style');
    unwrapIfBare(el);
  }
  return true;
}

/** Remove the same property from descendants so the outer span actually wins. */
function cleanupNested(span, prop) {
  span.querySelectorAll('[style]').forEach((child) => {
    if (child.style[prop]) child.style[prop] = '';
    if (!child.getAttribute('style')) child.removeAttribute('style');
    unwrapIfBare(child);
  });
}

function unwrapIfBare(el) {
  if (el.tagName !== 'SPAN' || el.attributes.length) return;
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

function currentStyle(editor, prop, options) {
  const el = editor.selection.element();
  if (!el) return '';
  const computed = getComputedStyle(el)[prop];
  const match = options.find((o) => normalize(o.value) === normalize(computed));
  return match?.value ?? '';
}

/**
 * Resolved colour at the caret as a hex string, or '' when there is none —
 * a transparent background means "no highlight", and the toolbar should show an
 * empty bar rather than a misleading solid black one.
 */
function currentColor(editor, prop) {
  const el = editor.selection.element();
  if (!el) return '';
  return rgbToHex(getComputedStyle(el)[prop]);
}

function rgbToHex(value) {
  const m = String(value).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i);
  if (!m) return /^#[0-9a-f]{6}$/i.test(value) ? value : '';
  if (m[4] !== undefined && Number(m[4]) === 0) return ''; // fully transparent
  return '#' + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('');
}

function normalize(v) {
  return String(v).toLowerCase().replace(/["']/g, '').replace(/\s+/g, '');
}

function cssName(prop) {
  return prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}
