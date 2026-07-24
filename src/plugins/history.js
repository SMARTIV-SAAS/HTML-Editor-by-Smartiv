/** Undo / redo wired to the editor's snapshot stack. */
export function historyPlugin(editor) {
  editor.addCommand('undo', () => editor.history.undo());
  editor.addCommand('redo', () => editor.history.redo());

  editor.ui.addButton('undo', {
    icon: '↶', label: 'Undo', command: 'undo', enabled: () => editor.history.canUndo()
  });
  editor.ui.addButton('redo', {
    icon: '↷', label: 'Redo', command: 'redo', enabled: () => editor.history.canRedo()
  });

  editor.addShortcut('mod+z', 'undo');
  editor.addShortcut('mod+shift+z', 'redo');
  editor.addShortcut('mod+y', 'redo');
}
historyPlugin.pluginName = 'history';
