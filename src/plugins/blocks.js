/** Paragraph / heading / blockquote block switcher. */
export function blocksPlugin(editor) {
  const options = [
    { value: 'p', text: 'Paragraph' },
    { value: 'h1', text: 'Heading 1' },
    { value: 'h2', text: 'Heading 2' },
    { value: 'h3', text: 'Heading 3' },
    { value: 'h4', text: 'Heading 4' },
    { value: 'h5', text: 'Heading 5' },
    { value: 'h6', text: 'Heading 6' },
    { value: 'pre', text: 'Preformatted' },
    { value: 'blockquote', text: 'Quote' }
  ];

  editor.addCommand('formatBlock', (tag) => editor.native('formatBlock', `<${tag}>`));

  editor.ui.addSelect('blockFormat', {
    label: 'Block',
    width: 130,
    options,
    command: 'formatBlock',
    value: () => {
      const block = editor.selection.closest(
        (n) => n.nodeType === 1 && /^(P|H[1-6]|PRE|BLOCKQUOTE|DIV)$/.test(n.tagName)
      );
      const tag = block?.tagName.toLowerCase() ?? 'p';
      return tag === 'div' ? 'p' : tag;
    }
  });

  editor.addCommand('horizontalRule', () => editor.native('insertHorizontalRule'));
  editor.ui.addButton('hr', { icon: '─', label: 'Horizontal rule', command: 'horizontalRule' });
}
blocksPlugin.pluginName = 'blocks';
