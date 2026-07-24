/** Bullet / numbered lists plus indent controls. */
export function listsPlugin(editor) {
  editor.addCommand('bulletList', () => editor.native('insertUnorderedList'));
  editor.addCommand('numberList', () => editor.native('insertOrderedList'));
  editor.addCommand('indent', () => editor.native('indent'));
  editor.addCommand('outdent', () => editor.native('outdent'));

  editor.ui.addButton('bulletList', {
    icon: '•',
    label: 'Bulleted list',
    command: 'bulletList',
    active: () => editor.queryState('insertUnorderedList')
  });
  editor.ui.addButton('numberList', {
    icon: '1.',
    label: 'Numbered list',
    command: 'numberList',
    active: () => editor.queryState('insertOrderedList')
  });
  editor.ui.addButton('outdent', { icon: '⇤', label: 'Decrease indent', command: 'outdent' });
  editor.ui.addButton('indent', { icon: '⇥', label: 'Increase indent', command: 'indent' });
}
listsPlugin.pluginName = 'lists';
