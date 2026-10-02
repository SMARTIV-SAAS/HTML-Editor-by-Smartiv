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
    { value: '0.1', text: '0.1' },
    { value: '0.2', text: '0.2' },
    { value: '0.3', text: '0.3' },
    { value: '0.4', text: '0.4' },
    { value: '0.5', text: '0.5' },
    { value: '0.75', text: '0.75' },
    { value: '1', text: '1.0' },
    { value: '1.15', text: '1.15' },
    { value: '1.35', text: '1.35' },
    { value: '1.6', text: '1.6' },
    { value: '2', text: '2.0' }
  ];

  editor.addCommand('lineSpacing', (value) => {
    const blocks = editor.selection.blocks(BLOCK_SELECTOR);
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

function nearestBlock(editor) {
  const block = editor.selection.closest(
    (n) => n.nodeType === 1 && n.matches?.(BLOCK_SELECTOR)
  );
  return block && block !== editor.root ? block : null;
}
