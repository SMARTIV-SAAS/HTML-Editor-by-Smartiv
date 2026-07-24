/**
 * Background theme for the screen document.
 *
 * The theme is document state, not per-selection formatting: it drives the
 * editing surface, the TV preview and the exported file from one place. Rule
 * colours ship with each preset so dividers and table borders stay visible on
 * a light *and* a dark background without needing color-mix() — Android TV
 * WebViews are often several Chrome releases behind.
 */
export const THEMES = {
  light: {
    text: 'White (neutral)',
    background: '#ffffff',
    color: '#14181d',
    rule: 'rgba(0, 0, 0, .18)',
    ruleSoft: 'rgba(0, 0, 0, .05)'
  },
  paper: {
    text: 'Soft cream',
    background: '#f4f1ea',
    color: '#1a1815',
    rule: 'rgba(0, 0, 0, .16)',
    ruleSoft: 'rgba(0, 0, 0, .05)'
  },
  dark: {
    text: 'Dark',
    background: '#0f1216',
    color: '#f2f5f8',
    rule: 'rgba(255, 255, 255, .22)',
    ruleSoft: 'rgba(255, 255, 255, .08)'
  },
  midnight: {
    text: 'Midnight blue',
    background: '#0b1a2b',
    color: '#eaf2fb',
    rule: 'rgba(255, 255, 255, .22)',
    ruleSoft: 'rgba(255, 255, 255, .08)'
  },
  brand: {
    text: 'Smartiv gradient',
    background: 'linear-gradient(120deg, #0b63c5 0%, #17a2d8 50%, #2ec5cf 100%)',
    color: '#ffffff',
    rule: 'rgba(255, 255, 255, .25)',
    ruleSoft: 'rgba(255, 255, 255, .1)'
  }
};

export const DEFAULT_THEME = 'light';

/** Resolve a theme name (or a custom object) to concrete CSS values. */
export function resolveTheme(name) {
  if (name && typeof name === 'object') return { ...THEMES[DEFAULT_THEME], ...name };
  return THEMES[name] ?? THEMES[DEFAULT_THEME];
}

export function themePlugin(editor) {
  editor.theme = editor.options.theme ?? DEFAULT_THEME;

  editor.addCommand('setTheme', (name) => {
    if (!THEMES[name]) return false;
    editor.theme = name;
    editor.events.emit('theme', name);
    return true;
  });

  /** Flip between the light and dark ends — handy as a keyboard shortcut. */
  editor.addCommand('toggleTheme', () => {
    const dark = THEMES[editor.theme]?.color?.startsWith('#f') ?? false;
    return editor.execCommand('setTheme', dark ? 'light' : 'dark');
  });

  editor.ui.addSelect('theme', {
    label: 'Background',
    width: 165,
    command: 'setTheme',
    options: Object.entries(THEMES).map(([value, t]) => ({ value, text: t.text })),
    value: () => editor.theme
  });

  editor.ui.addButton('themeToggle', {
    icon: '◐',
    label: 'Light / dark',
    command: 'toggleTheme'
  });

  editor.addShortcut('mod+shift+l', 'toggleTheme');
}
themePlugin.pluginName = 'theme';
