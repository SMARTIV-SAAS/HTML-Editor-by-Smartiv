/** Text alignment. Writes text-align on the block rather than <center> tags. */
const ALIGN_BLOCKS = 'p,h1,h2,h3,h4,h5,h6,li,dt,dd,blockquote,pre,.sv-panel__title,.sv-fields';

export function alignPlugin(editor) {
  const aligns = [
    { name: 'alignLeft', value: 'left', icon: '⯇', label: 'Align left', state: 'justifyLeft' },
    { name: 'alignCenter', value: 'center', icon: '≡', label: 'Align centre', state: 'justifyCenter' },
    { name: 'alignRight', value: 'right', icon: '⯈', label: 'Align right', state: 'justifyRight' },
    { name: 'alignJustify', value: 'justify', icon: '☰', label: 'Justify', state: 'justifyFull' }
  ];

  for (const a of aligns) {
    editor.addCommand(a.name, () => {
      // Apply to every block the selection touches, not just the one at the
      // caret, so selecting several paragraphs aligns all of them.
      const blocks = editor.selection.blocks(ALIGN_BLOCKS);
      if (blocks.length) {
        for (const block of blocks) block.style.textAlign = a.value;
        return true;
      }
      return editor.native(a.state);
    });
    editor.ui.addButton(a.name, {
      icon: a.icon,
      label: a.label,
      command: a.name,
      active: () => editor.queryState(a.state)
    });
  }
}
alignPlugin.pluginName = 'align';
