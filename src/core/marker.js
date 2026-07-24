/**
 * Document format marker.
 *
 * During the transition the same column holds two kinds of HTML: Quill-authored
 * content written by the old CMS, and Smartiv-authored content written by this
 * editor. The player has to tell them apart to pick the right stylesheet, and
 * guessing from class names is brittle — a legacy document could contain
 * "sv-fields" by coincidence, and a Smartiv document that happens to be a plain
 * paragraph carries no Smartiv class at all.
 *
 * So the editor states it outright:
 *
 *   <div class="sv-doc" data-sv-doc="1"> … </div>
 *
 * The wrapper is a plain unstyled div. An old player that knows nothing about
 * it renders straight through; a new player reads the attribute. The number is
 * the format version, which is what makes a future migration detectable rather
 * than guessed.
 *
 * The wrapper never enters the editing DOM: it is added by getContent() and
 * removed by setContent(), so selection, normalisation and the undo stack all
 * carry on working against a flat list of blocks.
 */

export const SV_DOC_VERSION = 1;
const MARKER_ATTR = 'data-sv-doc';

/** Legacy hook, for content saved before the marker existed. */
const LEGACY_HINT = /class="[^"]*\bsv-(?:fields|panels|panel)\b/;

/** Does this HTML come from the Smartiv editor? */
export function isSmartivHtml(html) {
  const source = String(html ?? '');
  return source.includes(MARKER_ATTR) || LEGACY_HINT.test(source);
}

/** Format version, or 0 when the HTML is not Smartiv-authored. */
export function documentVersion(html) {
  const match = String(html ?? '').match(/data-sv-doc="(\d+)"/);
  if (match) return Number(match[1]);
  return LEGACY_HINT.test(String(html ?? '')) ? 1 : 0;
}

/** Wrap content for storage. Idempotent. */
export function wrapDocument(html, version = SV_DOC_VERSION) {
  const source = String(html ?? '').trim();
  if (!source) return '';
  if (source.includes(MARKER_ATTR)) return source;
  return `<div class="sv-doc" ${MARKER_ATTR}="${version}">${source}</div>`;
}

/**
 * Strip the wrapper on the way into the editor.
 *
 * Uses a real parse rather than a regex: a regex for the closing tag would
 * match the wrong `</div>` as soon as the content contains nested divs, which
 * every panel layout does.
 */
export function unwrapDocument(html) {
  const source = String(html ?? '');
  if (!source.includes(MARKER_ATTR)) return source;

  const doc = document.implementation.createHTMLDocument('sv');
  doc.body.innerHTML = source;

  // Unwrap repeatedly: a double round trip through an older build could have
  // nested one marker inside another.
  let wrapper;
  while ((wrapper = doc.body.querySelector(`[${MARKER_ATTR}]`))) {
    const parent = wrapper.parentNode;
    while (wrapper.firstChild) parent.insertBefore(wrapper.firstChild, wrapper);
    parent.removeChild(wrapper);
  }
  return doc.body.innerHTML;
}
