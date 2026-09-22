/**
 * Dark-mode toggle — a per-viewer authoring aid, not document state.
 *
 * Flips only the editing surface (and the editor chrome) to a dark background,
 * so an operator writing light-coloured text can see it while authoring. It
 * changes nothing in the content: getContent, the stored HTML, the TV output
 * and the export are all untouched — the dark background lives purely on the
 * editing surface via CSS variables, never as inline styles on the content.
 *
 * The choice is remembered in localStorage (a per-viewer convenience), so the
 * operator does not have to flip it every time. Reads and writes are guarded:
 * a private window or blocked storage simply falls back to light.
 */
const DEFAULT_KEY = 'smartiv-editor:dark-mode';

export function surfacePlugin(editor) {
  const remember = editor.options.rememberDarkMode !== false;
  const key = editor.options.darkModeKey ?? DEFAULT_KEY;

  const readStored = () => {
    if (!remember) return false;
    try {
      return localStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  };
  const writeStored = (on) => {
    if (!remember) return;
    try {
      localStorage.setItem(key, on ? '1' : '0');
    } catch {
      /* private window / storage disabled — the toggle still works this session */
    }
  };

  editor.darkMode = readStored();

  editor.addCommand('toggleDarkMode', () => {
    editor.darkMode = !editor.darkMode;
    writeStored(editor.darkMode);
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
