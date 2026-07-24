/**
 * Output transforms applied on the way to the player, never to the editing DOM.
 */

/**
 * Turn the CSS-generated colon into a real element.
 *
 * Inside the editor the colon comes from `dt::after`, which keeps the label
 * text clean to edit. That works only while the stylesheet is present. If a
 * pipeline stores the content fragment and drops the exported <style> — or the
 * player wraps the fragment in its own document — every colon silently
 * disappears and the screen reads "Event  Coordination…".
 *
 * Baking a <span class="sv-colon">:</span> into each label removes that
 * dependency: with the stylesheet the layout is unchanged (the span is just
 * another flex child, and `::after` is suppressed via data-sv-colon-baked);
 * without it the text still reads "Event:".
 */
export function bakeColons(html) {
  const doc = document.implementation.createHTMLDocument('sv');
  doc.body.innerHTML = String(html ?? '');

  for (const dl of doc.body.querySelectorAll('dl.sv-fields')) {
    const mode = dl.getAttribute('data-sv-colon') || 'align';
    if (mode === 'none') continue;

    dl.setAttribute('data-sv-colon-baked', '1');
    for (const dt of dl.querySelectorAll(':scope > dt')) {
      if (dt.querySelector('.sv-colon')) continue;
      const span = doc.createElement('span');
      span.className = 'sv-colon';
      span.textContent = ':';
      dt.appendChild(span);
    }
  }
  return doc.body.innerHTML;
}
