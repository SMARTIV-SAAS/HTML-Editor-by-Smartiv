/**
 * Field list — the "Event: … / Host: … / Time: …" block.
 *
 * The reason label/value rows never line up in a plain rich-text editor is that
 * the colon is part of the label text, so its x position follows the length of
 * each label. Here the colon is CSS generated content on a grid item that spans
 * the full label column, so every colon lands on the same x no matter how long
 * the label is. Nobody has to pad with spaces or tabs.
 *
 *   <dl class="sv-fields" data-sv-colon="align">
 *     <dt>Event</dt><dd>Coordination &amp; Technical Briefing</dd>
 *     <dt>Host</dt>  <dd>Media Team</dd>
 *   </dl>
 *
 * Colon modes:
 *   align  - labels flush left, colons flush to the label column edge (default)
 *   right  - labels right-aligned, colons trail the text
 *   tight  - colon hugs the label, no alignment (legacy look)
 *   none   - no colon at all
 */

const FIELD_SELECTOR = 'dl.sv-fields';

export function fieldListPlugin(editor) {
  const defaults = editor.options.fieldList ?? {};

  editor.addCommand('insertFieldList', (rows) => {
    const dl = buildFieldList(rows ?? defaults.template ?? [
      ['Event', 'Coordination & Technical Briefing'],
      ['Host', 'Media Team'],
      ['Time', '14.00 – 16.00']
    ], defaults.colon ?? 'align');

    editor.selection.insert(dl);
    placeCaret(dl.querySelector('dt'));
    return true;
  });

  editor.addCommand('fieldListColon', (mode) => {
    const dl = activeList(editor);
    if (!dl) return false;
    dl.setAttribute('data-sv-colon', mode);
    return true;
  });

  editor.addCommand('fieldListLabelWidth', (width) => {
    const dl = activeList(editor);
    if (!dl) return false;
    if (width === 'auto') dl.style.removeProperty('--sv-label-width');
    else dl.style.setProperty('--sv-label-width', width);
    return true;
  });

  editor.addCommand('fieldListAddRow', () => {
    const dl = activeList(editor);
    if (!dl) return false;
    const { dt } = appendRow(dl, currentRow(editor)?.dd);
    placeCaret(dt);
    return true;
  });

  editor.addCommand('fieldListRemoveRow', () => {
    const row = currentRow(editor);
    if (!row) return false;
    const dl = row.dt.parentNode;
    const target = row.dt.previousElementSibling?.previousElementSibling ?? null;
    row.dt.remove();
    row.dd.remove();
    if (!dl.querySelector('dt')) dl.remove();
    else placeCaret(target ?? dl.querySelector('dt'));
    return true;
  });

  /* ------------------------------------------------------------------ toolbar */

  editor.ui.addButton('fieldList', {
    icon: '⁙',
    label: 'Insert field list (Event: …)',
    command: 'insertFieldList',
    active: () => !!activeList(editor)
  });

  editor.ui.addSelect('fieldListColon', {
    label: 'Colon',
    width: 150,
    command: 'fieldListColon',
    enabled: () => !!activeList(editor),
    options: [
      { value: 'align', text: 'Aligned (:)' },
      { value: 'right', text: 'Label right-aligned' },
      { value: 'tight', text: 'Attached to label' },
      { value: 'none', text: 'No colon' }
    ],
    value: () => activeList(editor)?.getAttribute('data-sv-colon') ?? 'align'
  });

  editor.ui.addSelect('fieldListLabelWidth', {
    label: 'Label width',
    width: 150,
    command: 'fieldListLabelWidth',
    enabled: () => !!activeList(editor),
    options: [
      { value: 'auto', text: 'Automatic' },
      { value: '6em', text: 'Narrow (6em)' },
      { value: '9em', text: 'Medium (9em)' },
      { value: '13em', text: 'Wide (13em)' }
    ],
    value: () => activeList(editor)?.style.getPropertyValue('--sv-label-width').trim() || 'auto'
  });

  /* -------------------------------------------------------------- keyboard nav */

  editor.events.on('keydown', (e) => {
    const row = currentRow(editor);
    if (!row) return;
    const inLabel = row.active === row.dt;

    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        const prev = inLabel ? row.dt.previousElementSibling : row.dt;
        if (prev) placeCaret(prev);
      } else if (inLabel) {
        placeCaret(row.dd);
      } else {
        const nextDt = row.dd.nextElementSibling;
        if (nextDt) {
          placeCaret(nextDt);
        } else {
          placeCaret(appendRow(row.dt.parentNode, row.dd).dt);
          editor.commit(); // Tab created a row — record it now, no input fires.
        }
      }
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inLabel) {
        placeCaret(row.dd);
        return;
      }
      const dl = row.dt.parentNode;
      // Enter on an empty value ends the list instead of adding a dead row.
      if (!row.dd.textContent.trim() && !row.dt.textContent.trim()) {
        row.dt.remove();
        row.dd.remove();
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        dl.after(p);
        if (!dl.querySelector('dt')) dl.remove();
        placeCaret(p);
        editor.commit(); // ended the list — record the structural change.
        return;
      }
      placeCaret(appendRow(dl, row.dd).dt);
      editor.commit(); // Enter created a row.
      return;
    }

    if (e.key === 'Backspace' && inLabel && !row.dt.textContent && atStart(row.dt)) {
      e.preventDefault();
      editor.execCommand('fieldListRemoveRow');
    }
  });

  // A label that already ends in ":" would render a double colon. Runs as a
  // normalizer so the trimmed label is in the value the host stores, not one
  // change behind it.
  editor.addNormalizer(() => {
    for (const dl of editor.root.querySelectorAll(FIELD_SELECTOR)) {
      if (dl.getAttribute('data-sv-colon') === 'none') continue;

      // Content baked for export and loaded back: drop the literal colon so the
      // editor is back on the generated one.
      dl.removeAttribute('data-sv-colon-baked');
      dl.querySelectorAll(':scope > dt > .sv-colon').forEach((n) => n.remove());

      for (const dt of dl.querySelectorAll(':scope > dt')) {
        // Rewrite only the trailing text node — assigning textContent here would
        // wipe every inline span the operator put inside the label.
        const last = dt.lastChild;
        if (last?.nodeType !== Node.TEXT_NODE) continue;
        if (!/[:：]\s*$/.test(last.data)) continue;
        last.data = last.data.replace(/\s*[:：]\s*$/, '');
        if (!last.data && dt.childNodes.length > 1) last.remove();
      }
    }
  });
}
fieldListPlugin.pluginName = 'fieldList';

/* ---------------------------------------------------------------------- utils */

function buildFieldList(rows, colon) {
  const dl = document.createElement('dl');
  dl.className = 'sv-fields';
  dl.setAttribute('data-sv-block', 'fields');
  dl.setAttribute('data-sv-colon', colon);
  for (const [label, value] of rows) {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    dl.append(dt, dd);
  }
  return dl;
}

function appendRow(dl, afterDd) {
  const dt = document.createElement('dt');
  dt.innerHTML = '<br>';
  const dd = document.createElement('dd');
  dd.innerHTML = '<br>';
  if (afterDd) afterDd.after(dt, dd);
  else dl.append(dt, dd);
  return { dt, dd };
}

function activeList(editor) {
  return editor.selection.closest((n) => n.nodeType === 1 && n.matches?.(FIELD_SELECTOR));
}

function currentRow(editor) {
  const cell = editor.selection.closest(
    (n) => n.nodeType === 1 && (n.tagName === 'DT' || n.tagName === 'DD') && n.parentNode?.matches?.(FIELD_SELECTOR)
  );
  if (!cell) return null;
  const dt = cell.tagName === 'DT' ? cell : cell.previousElementSibling;
  const dd = cell.tagName === 'DD' ? cell : cell.nextElementSibling;
  if (!dt || !dd) return null;
  return { dt, dd, active: cell };
}

/**
 * Move the caret into `el`.
 *
 * Empty cells hold a filler <br>. Collapsing to the *end* of such a cell lands
 * the caret after that <br>, a position Chromium resolves to the next editable
 * block — so the next keystroke silently lands in the following cell. For an
 * empty cell the caret has to go to offset 0, before the filler.
 */
function placeCaret(el) {
  if (!el) return;
  const range = document.createRange();
  if (!el.textContent) {
    range.setStart(el, 0);
    range.collapse(true);
  } else {
    range.selectNodeContents(el);
    range.collapse(false);
  }
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

function atStart(el) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return false;
  const r = sel.getRangeAt(0);
  return r.collapsed && r.startOffset === 0 && (r.startContainer === el || r.startContainer === el.firstChild);
}
