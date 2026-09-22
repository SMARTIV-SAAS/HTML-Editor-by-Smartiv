/**
 * Portable (self-contained) output.
 *
 * The editing DOM keeps the class-based blocks — `<dl class="sv-fields">` and
 * `<div class="sv-panels">` — because the keyboard navigation and the toolbar
 * reason about them, and because one stylesheet (tv.css) can restyle every
 * screen at once. But those blocks are laid out by tv.css: on a player that
 * lacks it (an old Quill viewer during the transition) the colons vanish and
 * the panels stack.
 *
 * Portable output removes that dependency. On the way *out* of the editor a
 * field list becomes a plain `<table>` whose colon sits in its own column — so
 * it aligns with zero external CSS, in any renderer — and multi-column panels
 * get inline flex. On the way *back in* the transform is reversed, so the
 * operator still edits the friendly `<dl>`.
 *
 * The table carries `data-sv-block="fields"` (not the `sv-fields` class) so
 * tv.css never touches it and the reverse transform can find it. Inline colours
 * and fonts the operator set live on the cell contents and travel untouched.
 */

const FIELD_DL = 'dl.sv-fields';
const FIELD_TABLE = 'table[data-sv-block="fields"]';

const cssName = (prop) => prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

function parse(html) {
  const doc = document.implementation.createHTMLDocument('sv');
  doc.body.innerHTML = String(html ?? '');
  return doc;
}

function moveChildren(from, to) {
  while (from.firstChild) to.appendChild(from.firstChild);
}

/* --------------------------------------------------------------- editor → store */

export function toPortable(html) {
  const doc = parse(html);
  fieldListsToTables(doc);
  panelsToInline(doc);
  return doc.body.innerHTML;
}

function fieldListsToTables(doc) {
  for (const dl of [...doc.body.querySelectorAll(FIELD_DL)]) {
    const mode = dl.getAttribute('data-sv-colon') || 'align';
    const labelWidth = dl.style.getPropertyValue('--sv-label-width').trim();
    const showColon = mode !== 'none';

    const table = doc.createElement('table');
    table.setAttribute('data-sv-block', 'fields');
    table.setAttribute('data-sv-colon', mode);
    if (labelWidth) table.setAttribute('data-sv-label-width', labelWidth);
    table.setAttribute('style', 'border-collapse:collapse;margin:0 0 .8em');

    const kids = [...dl.children];
    for (let i = 0; i < kids.length; i++) {
      if (kids[i].tagName !== 'DT') continue;
      const dt = kids[i];
      const dd = kids[i + 1]?.tagName === 'DD' ? kids[i + 1] : null;

      const tr = doc.createElement('tr');

      const label = doc.createElement('td');
      label.setAttribute('data-sv-role', 'label');
      let labelStyle = 'font-weight:700;white-space:nowrap;vertical-align:top;padding:0 .5em .25em 0';
      if (mode === 'right') labelStyle += ';text-align:right';
      if (labelWidth) labelStyle += `;width:${labelWidth}`;
      label.setAttribute('style', labelStyle);
      moveChildren(dt, label);
      tr.appendChild(label);

      if (showColon) {
        const colon = doc.createElement('td');
        colon.setAttribute('data-sv-role', 'colon');
        colon.setAttribute('style', 'font-weight:700;white-space:nowrap;vertical-align:top;padding:0 .5em .25em 0');
        colon.textContent = ':';
        tr.appendChild(colon);
      }

      const value = doc.createElement('td');
      value.setAttribute('data-sv-role', 'value');
      value.setAttribute('style', 'vertical-align:top;padding:0 0 .25em 0');
      if (dd) moveChildren(dd, value);
      tr.appendChild(value);

      table.appendChild(tr);
    }
    dl.replaceWith(table);
  }
}

function panelsToInline(doc) {
  for (const panels of [...doc.body.querySelectorAll('.sv-panels')]) {
    const cols = Number(panels.getAttribute('data-sv-columns') || '1') || 1;
    if (cols <= 1) continue; // one column needs no layout CSS at all
    panels.style.display = 'flex';
    panels.style.gap = '2.5rem';
    panels.style.alignItems = 'flex-start';
    const items = [...panels.querySelectorAll(':scope > .sv-panel')];
    items.forEach((panel, i) => {
      panel.style.flex = '1';
      panel.style.minWidth = '0';
      if (i < items.length - 1) {
        // Neutral divider that reads on light and dark alike.
        panel.style.borderRight = '2px solid rgba(128,128,128,.4)';
        panel.style.paddingRight = '2.5rem';
      }
    });
  }
}

/* --------------------------------------------------------------- store → editor */

export function fromPortable(html) {
  const doc = parse(html);
  tablesToFieldLists(doc);
  panelsFromInline(doc);
  return doc.body.innerHTML;
}

function tablesToFieldLists(doc) {
  for (const table of [...doc.body.querySelectorAll(FIELD_TABLE)]) {
    const mode = table.getAttribute('data-sv-colon') || 'align';
    const labelWidth = table.getAttribute('data-sv-label-width') || '';

    const dl = doc.createElement('dl');
    dl.className = 'sv-fields';
    dl.setAttribute('data-sv-block', 'fields');
    dl.setAttribute('data-sv-colon', mode);
    if (labelWidth) dl.style.setProperty('--sv-label-width', labelWidth);

    for (const tr of [...table.querySelectorAll('tr')]) {
      const cells = [...tr.children];
      const labelCell = cells.find((c) => c.getAttribute('data-sv-role') === 'label') || cells[0];
      const valueCell = cells.find((c) => c.getAttribute('data-sv-role') === 'value') || cells[cells.length - 1];

      const dt = doc.createElement('dt');
      if (labelCell) moveChildren(labelCell, dt);
      if (!dt.firstChild) dt.innerHTML = '<br>';

      const dd = doc.createElement('dd');
      if (valueCell && valueCell !== labelCell) moveChildren(valueCell, dd);
      if (!dd.firstChild) dd.innerHTML = '<br>';

      dl.append(dt, dd);
    }
    table.replaceWith(dl);
  }
}

function panelsFromInline(doc) {
  for (const panels of [...doc.body.querySelectorAll('.sv-panels')]) {
    ['display', 'gap', 'alignItems'].forEach((p) => panels.style.removeProperty(cssName(p)));
    if (!panels.getAttribute('style')) panels.removeAttribute('style');
    for (const panel of [...panels.querySelectorAll(':scope > .sv-panel')]) {
      ['flex', 'minWidth', 'borderRight', 'paddingRight'].forEach((p) => panel.style.removeProperty(cssName(p)));
      if (!panel.getAttribute('style')) panel.removeAttribute('style');
    }
  }
}
