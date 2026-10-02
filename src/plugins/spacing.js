/**
 * Line spacing — the vertical distance between lines of text.
 *
 * Written as an inline `line-height` on each block the selection touches, so it
 * bakes into the exported HTML and renders the same on the TV with no stylesheet
 * (a unitless value, so it scales with the font size like the rest of the rem
 * layout). An empty value clears it and hands the block back to the default.
 */
const BLOCK_SELECTOR = 'p,h1,h2,h3,h4,h5,h6,li,dt,dd,blockquote,pre,.sv-panel__title';

/**
 * Line-height on a `dt`/`dd` is dropped when the field list is converted to a
 * table on export, so target the enclosing `dl` instead — one value governs the
 * whole list and portable output carries it onto the table.
 */
function spacingTarget(block) {
  if (block.tagName === 'DT' || block.tagName === 'DD') {
    return block.closest('dl') ?? block;
  }
  return block;
}

export function spacingPlugin(editor) {
  const options = editor.options.lineHeights ?? [
    { value: '', text: 'Spacing' },
    { value: '1', text: 'Single' },
    { value: '1.15', text: 'Tight' },
    { value: '1.35', text: 'Normal' },
    { value: '1.6', text: 'Relaxed' },
    { value: '2', text: 'Double' }
  ];

  editor.addCommand('lineSpacing', (value) => {
    const blocks = blocksInSelection(editor);
    if (!blocks.length) return false;
    const targets = new Set(blocks.map(spacingTarget));
    for (const block of targets) {
      if (value) block.style.lineHeight = value;
      else {
        block.style.lineHeight = '';
        if (!block.getAttribute('style')) block.removeAttribute('style');
      }
    }
    return true;
  });

  editor.ui.addSelect('lineSpacing', {
    label: 'Line spacing',
    width: 132,
    options,
    command: 'lineSpacing',
    value: () => {
      const block = nearestBlock(editor);
      if (!block) return '';
      const current = spacingTarget(block).style.lineHeight || '';
      return options.some((o) => o.value === current) ? current : '';
    }
  });
}
spacingPlugin.pluginName = 'spacing';

/** The block-level elements the current selection touches. */
function blocksInSelection(editor) {
  const range = editor.selection.range();
  if (!range) return [];
  const root = editor.root;
  const all = [...root.querySelectorAll(BLOCK_SELECTOR)];
  const hit = all.filter((b) => {
    try { return range.intersectsNode(b); } catch { return false; }
  });
  if (hit.length) return hit;
  const near = nearestBlock(editor);
  return near ? [near] : [];
}

function nearestBlock(editor) {
  const block = editor.selection.closest(
    (n) => n.nodeType === 1 && n.matches?.(BLOCK_SELECTOR)
  );
  return block && block !== editor.root ? block : null;
}
