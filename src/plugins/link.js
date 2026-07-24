/**
 * Hyperlinks.
 *
 * The dialog is raised through editor.events.emit('dialog', …) so the Vue layer
 * owns the markup and this plugin stays DOM-only.
 */
export function linkPlugin(editor) {
  editor.addCommand('link', (payload) => {
    if (payload?.url) return applyLink(editor, payload);
    const existing = currentLink(editor);
    editor.events.emit('dialog', {
      id: 'link',
      title: 'Link',
      fields: [
        { name: 'url', label: 'URL', value: existing?.href ?? 'https://', required: true },
        { name: 'text', label: 'Text', value: existing?.textContent ?? editor.selection.text() },
        { name: 'newTab', label: 'Open in a new tab', type: 'checkbox', value: existing?.target === '_blank' }
      ],
      caret: editor.selection.save(),
      onSubmit: (values) => editor.execCommand('link', values)
    });
    return true;
  });

  editor.addCommand('unlink', () => editor.native('unlink'));

  editor.ui.addButton('link', {
    icon: '🔗',
    label: 'Link',
    command: 'link',
    active: () => !!currentLink(editor)
  });
  editor.ui.addButton('unlink', { icon: '⛓', label: 'Remove link', command: 'unlink' });
  editor.addShortcut('mod+k', 'link');
}
linkPlugin.pluginName = 'link';

function currentLink(editor) {
  return editor.selection.closest((n) => n.nodeType === 1 && n.tagName === 'A');
}

function applyLink(editor, { url, text, newTab }) {
  const existing = currentLink(editor);
  if (existing) {
    existing.href = url;
    if (text) existing.textContent = text;
    toggleTab(existing, newTab);
    return true;
  }
  const a = document.createElement('a');
  a.href = url;
  a.textContent = text || url;
  toggleTab(a, newTab);
  editor.selection.insert(a);
  return true;
}

function toggleTab(a, newTab) {
  if (newTab) {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  } else {
    a.removeAttribute('target');
    a.removeAttribute('rel');
  }
}
