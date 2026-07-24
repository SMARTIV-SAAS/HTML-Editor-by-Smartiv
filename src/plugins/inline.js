/** bold / italic / underline / strikethrough / clear formatting */
export function inlinePlugin(editor) {
  const marks = [
    { name: 'bold', cmd: 'bold', icon: 'B', label: 'Bold', shortcut: 'mod+b' },
    { name: 'italic', cmd: 'italic', icon: 'I', label: 'Italic', shortcut: 'mod+i' },
    { name: 'underline', cmd: 'underline', icon: 'U', label: 'Underline', shortcut: 'mod+u' },
    { name: 'strikethrough', cmd: 'strikeThrough', icon: 'S', label: 'Strikethrough' }
  ];

  for (const mark of marks) {
    editor.addCommand(mark.name, () => editor.native(mark.cmd));
    editor.ui.addButton(mark.name, {
      icon: mark.icon,
      label: mark.label,
      command: mark.name,
      active: () => editor.queryState(mark.cmd)
    });
    if (mark.shortcut) editor.addShortcut(mark.shortcut, mark.name);
  }

  editor.addCommand('removeFormat', () => {
    editor.native('removeFormat');
    editor.native('unlink');
  });
  editor.ui.addButton('removeFormat', {
    icon: '⌫',
    label: 'Clear formatting',
    command: 'removeFormat'
  });
}
inlinePlugin.pluginName = 'inline';
