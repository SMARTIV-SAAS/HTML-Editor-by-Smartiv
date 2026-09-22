/**
 * Dark-mode toggle — a per-viewer authoring aid, not document state.
 *
 * Flips only the editing surface (and the editor chrome) to a dark background,
 * so an operator writing light-coloured text can see it while authoring. It
 * changes nothing in the content: getContent, the stored HTML, the TV output
 * and the export are all untouched — the dark background lives purely on the
 * editing surface via CSS variables, never as inline styles on the content.
 */
export function surfacePlugin(editor) {
  editor.darkMode = false;

  editor.addCommand('toggleDarkMode', () => {
    editor.darkMode = !editor.darkMode;
    editor.events.emit('dark-mode', editor.darkMode);
    return true;
  });

  editor.ui.addButton('darkMode', {
    icon: '◐',
    label: 'Dark editor background (writing aid)',
    command: 'toggleDarkMode',
    active: () => editor.darkMode
  });

  editor.addShortcut('mod+shift+l', 'toggleDarkMode');
}
surfacePlugin.pluginName = 'surface';
