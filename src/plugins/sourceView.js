/** Toggle between WYSIWYG and raw HTML, plus a formatter for the source pane. */
export function sourceViewPlugin(editor) {
  editor.addCommand('toggleSource', () => {
    editor.events.emit('toggle-source');
    return true;
  });
  editor.ui.addButton('source', { icon: '</>', label: 'HTML source', command: 'toggleSource' });

  editor.addCommand('formatSource', () => {
    editor.setContent(prettyPrint(editor.getContent()));
    return true;
  });
}
sourceViewPlugin.pluginName = 'sourceView';

const BLOCK = /^(p|div|dl|dt|dd|ul|ol|li|h[1-6]|table|thead|tbody|tr|td|th|blockquote|figure|figcaption|hr)$/;

/** Indent block-level tags one per line; inline markup is left untouched. */
export function prettyPrint(html) {
  const tokens = String(html).split(/(<\/?[a-zA-Z][^>]*>)/g).filter((t) => t !== '');
  let depth = 0;
  const out = [];

  for (const token of tokens) {
    const open = token.match(/^<([a-zA-Z][a-zA-Z0-9]*)/);
    const close = token.match(/^<\/([a-zA-Z][a-zA-Z0-9]*)/);
    const tag = (open?.[1] ?? close?.[1] ?? '').toLowerCase();
    const isBlock = BLOCK.test(tag);
    const selfClosing = /\/>$/.test(token) || /^(hr|br|img)$/.test(tag);

    if (close && isBlock) depth = Math.max(0, depth - 1);
    if (isBlock || (open && selfClosing)) out.push('  '.repeat(depth) + token.trim());
    else if (out.length) out[out.length - 1] += token;
    else out.push(token);
    if (open && isBlock && !selfClosing) depth++;
  }
  return out.filter((line) => line.trim()).join('\n');
}
