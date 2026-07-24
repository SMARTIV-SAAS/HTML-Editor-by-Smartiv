/**
 * Whitelist sanitizer. No third-party dependency: the output of this editor is
 * rendered inside an Android TV WebView, so anything that survives here runs
 * on the signage device.
 */

/**
 * Images are deliberately absent.
 *
 * A signage device is regularly offline or behind a captive portal, so a remote
 * image is a broken icon and a mid-rotation reflow; an inlined one inflates the
 * document by a third and blows past SQLite's 2 MB CursorWindow. Screen artwork
 * belongs in the player's own asset pipeline, not in operator-authored HTML.
 */
const ALLOWED_TAGS = new Set([
  'p', 'br', 'span', 'div', 'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote', 'hr',
  'a',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'dl', 'dt', 'dd'
]);

/** Dropped whole, not unwrapped: keeping their children would keep the media. */
const DROP_ENTIRELY = new Set([
  'img', 'picture', 'source', 'svg', 'canvas', 'video', 'audio', 'figure', 'figcaption'
]);

// Any `data-sv-*` attribute is editor-owned metadata and passes through.
const SV_DATA_ATTR = /^data-sv-[a-z0-9-]+$/;

const ALLOWED_ATTRS = {
  '*': ['class', 'style', 'dir'],
  a: ['href', 'target', 'rel'],
  td: ['colspan', 'rowspan'],
  th: ['colspan', 'rowspan', 'scope']
};

// Properties we let through in inline style attributes.
const ALLOWED_STYLE_PROPS = new Set([
  'color', 'background-color', 'font-size', 'font-family', 'font-weight',
  'font-style', 'text-align', 'text-decoration', 'line-height',
  'letter-spacing', 'text-transform', 'width', 'height', 'margin',
  'margin-top', 'margin-bottom', 'padding', 'opacity', 'text-shadow'
]);

// No data: URLs — with images gone there is nothing legitimate to inline.
const SAFE_URL = /^(https?:|\/|#|mailto:)/i;

function sanitizeStyle(value) {
  return value
    .split(';')
    .map((decl) => decl.trim())
    .filter(Boolean)
    .filter((decl) => {
      const prop = decl.split(':')[0]?.trim().toLowerCase();
      const val = decl.slice(decl.indexOf(':') + 1).toLowerCase();
      // `--sv-*` custom properties drive the field-list layout knobs.
      if (!ALLOWED_STYLE_PROPS.has(prop) && !prop.startsWith('--sv-')) return false;
      // url()/expression() in styles is the classic CSS injection vector.
      return !/url\s*\(|expression\s*\(|javascript:/i.test(val);
    })
    .join('; ');
}

function scrubElement(el) {
  const tag = el.tagName.toLowerCase();

  if (DROP_ENTIRELY.has(tag)) {
    el.remove();
    return;
  }

  if (!ALLOWED_TAGS.has(tag)) {
    // Keep the text, drop the element.
    const parent = el.parentNode;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
    return;
  }

  const allowed = new Set([...(ALLOWED_ATTRS['*'] ?? []), ...(ALLOWED_ATTRS[tag] ?? [])]);
  for (const attr of [...el.attributes]) {
    const name = attr.name.toLowerCase();
    if (name.startsWith('on') || !(allowed.has(name) || SV_DATA_ATTR.test(name))) {
      el.removeAttribute(attr.name);
      continue;
    }
    if ((name === 'href' || name === 'src') && !SAFE_URL.test(attr.value.trim())) {
      el.removeAttribute(attr.name);
      continue;
    }
    if (name === 'style') {
      const cleaned = sanitizeStyle(attr.value);
      if (cleaned) el.setAttribute('style', cleaned);
      else el.removeAttribute('style');
    }
  }

  if (tag === 'a' && el.getAttribute('target') === '_blank') {
    el.setAttribute('rel', 'noopener noreferrer');
  }
}

/** Returns sanitized HTML string. */
export function sanitizeHtml(html) {
  const doc = document.implementation.createHTMLDocument('sv');
  doc.body.innerHTML = String(html ?? '');

  doc.body
    .querySelectorAll(
      ['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', ...DROP_ENTIRELY].join(', ')
    )
    .forEach((n) => n.remove());

  // Walk a static list: scrubElement mutates the tree while we iterate.
  for (const el of [...doc.body.querySelectorAll('*')]) {
    if (el.isConnected) scrubElement(el);
  }
  return doc.body.innerHTML;
}

/** Strip everything down to plain text — used by the paste handler. */
export function toPlainText(html) {
  const doc = document.implementation.createHTMLDocument('sv');
  doc.body.innerHTML = String(html ?? '');
  return doc.body.textContent ?? '';
}
