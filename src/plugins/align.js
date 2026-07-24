/** Text alignment. Writes text-align on the block rather than <center> tags. */
export function alignPlugin(editor) {
  const aligns = [
    { name: 'alignLeft', value: 'left', icon: '⯇', label: 'Align left', state: 'justifyLeft' },
    { name: 'alignCenter', value: 'center', icon: '≡', label: 'Align centre', state: 'justifyCenter' },
    { name: 'alignRight', value: 'right', icon: '⯈', label: 'Align right', state: 'justifyRight' },
    { name: 'alignJustify', value: 'justify', icon: '☰', label: 'Justify', state: 'justifyFull' }
  ];

  for (const a of aligns) {
    editor.addCommand(a.name, () => {
      const block = editor.selection.closest(
        (n) => n.nodeType === 1 && getComputedStyle(n).display !== 'inline'
      );
      if (block && block !== editor.root) block.style.textAlign = a.value;
      else editor.native(a.state);
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
