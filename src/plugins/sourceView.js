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

  const openLines = [];
  const isBlockTag = (t) => {
    const m = t && t.match(/^<\/?([a-zA-Z][a-zA-Z0-9]*)/);
    return m ? BLOCK.test(m[1].toLowerCase()) : false;
  };

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // Text node. Indentation left by an earlier pretty-print is not content:
    // carrying it through is what made every source-view toggle stack another
    // layer of blank lines onto the document.
    if (!/^<\/?[a-zA-Z]/.test(token)) {
      let text = token.replace(/\s+/g, ' ');
      if (!text.trim()) continue;
      // A block boundary is already a line break, so a space against it is just
      // re-imported indentation. Spacing between inline tags is real and stays.
      if (isBlockTag(tokens[i - 1])) text = text.replace(/^ /, '');
      if (isBlockTag(tokens[i + 1])) text = text.replace(/ $/, '');
      if (!text) continue;
      if (out.length) out[out.length - 1] += text;
      else out.push(text);
      continue;
    }

    // <pre> is whitespace-significant. Emit the whole element verbatim so the
    // source view never reflows or re-indents its content — collapsing it would
    // permanently destroy the preformatted text.
    if (/^<pre[\s>]/i.test(token)) {
      let raw = token;
      while (i + 1 < tokens.length && !/^<\/pre\s*>/i.test(tokens[i + 1])) {
        raw += tokens[++i];
      }
      if (i + 1 < tokens.length) raw += tokens[++i]; // the closing </pre>
      out.push('  '.repeat(depth) + raw);
      continue;
    }

    const open = token.match(/^<([a-zA-Z][a-zA-Z0-9]*)/);
    const close = token.match(/^<\/([a-zA-Z][a-zA-Z0-9]*)/);
    const tag = (open?.[1] ?? close?.[1] ?? '').toLowerCase();
    const isBlock = BLOCK.test(tag);
    const selfClosing = /\/>$/.test(token) || /^(hr|br|img)$/.test(tag);

    if (open && isBlock && !selfClosing) {
      out.push('  '.repeat(depth) + token.trim());
      openLines.push(out.length - 1);
      depth++;
    } else if (close && isBlock) {
      depth = Math.max(0, depth - 1);
      const openLine = openLines.pop();
      // Nothing new was started since this block opened, so it holds inline
      // content only — close it on the same line. That keeps the closing tag
      // from pushing a newline into the element's own text node.
      if (openLine === out.length - 1) out[out.length - 1] += token.trim();
      else out.push('  '.repeat(depth) + token.trim());
    } else if (isBlock || selfClosing) {
      out.push('  '.repeat(depth) + token.trim());
    } else if (out.length) {
      out[out.length - 1] += token;
    } else {
      out.push(token);
    }
  }
  return out.filter((line) => line.trim()).join('\n');
}
