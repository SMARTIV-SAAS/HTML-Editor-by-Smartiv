import { EventBus } from './EventBus.js';
import { History } from './history.js';
import { sanitizeHtml, toPlainText } from './sanitize.js';
import { wrapDocument, unwrapDocument } from './marker.js';
import * as sel from './selection.js';

/**
 * The editor instance every plugin receives. Deliberately small: a command
 * table, a UI registry, a selection API and an event bus. Plugins never touch
 * the Vue layer — the toolbar renders whatever ended up in the registry.
 */
export class Editor {
  constructor(root, options = {}) {
    this.root = root;
    this.options = options;
    this.events = new EventBus();
    this.history = new History(root, options.history);
    this.selection = {
      range: () => sel.getRange(root),
      set: (r) => sel.setRange(root, r),
      element: () => sel.currentElement(root),
      closest: (fn) => sel.closestFromCaret(root, fn),
      insert: (node) => sel.insertNode(root, node),
      save: () => sel.saveCaret(root),
      restore: (s) => sel.restoreCaret(root, s),
      text: () => sel.getSelection(root)?.toString() ?? ''
    };

    this.commands = new Map();
    this.ui = {
      buttons: new Map(),
      /** @param {string} name @param {object} spec */
      addButton: (name, spec) => {
        this.ui.buttons.set(name, { name, type: 'button', ...spec });
      },
      addSelect: (name, spec) => {
        this.ui.buttons.set(name, { name, type: 'select', ...spec });
      },
      addColor: (name, spec) => {
        this.ui.buttons.set(name, { name, type: 'color', ...spec });
      },
      addSeparator: (name) => {
        this.ui.buttons.set(name, { name, type: 'separator' });
      }
    };

    this.shortcuts = new Map();
    this.plugins = new Map();
    // DOM canonicalisers run before content is serialised, so what a plugin
    // cleans up is reflected in the emitted value and the history snapshot —
    // not one change behind.
    this.normalizers = [];
    this._composing = false;
  }

  /* ---------------------------------------------------------------- lifecycle */

  use(plugin) {
    const instance = plugin(this) ?? {};
    this.plugins.set(plugin.pluginName ?? plugin.name, instance);
    return this;
  }

  init(html = '') {
    this.root.setAttribute('contenteditable', 'true');
    this.root.setAttribute('spellcheck', String(this.options.spellcheck ?? false));
    this.setContent(html, { silent: true });
    this.history.reset(this.root.innerHTML);
    this._bindDom();
    this.events.emit('init');
  }

  destroy() {
    this._unbind?.();
    this.events.emit('destroy');
    this.events.destroy();
  }

  /* ----------------------------------------------------------------- content */

  /**
   * Content as it should be stored.
   *
   * The format marker is added here rather than kept in the editing DOM, so
   * selection, normalisation and undo all keep working against a flat list of
   * blocks. Set `options.documentMarker: false` to store bare fragments.
   */
  getContent({ format = 'html', marker = this.options.documentMarker !== false } = {}) {
    const html = sanitizeHtml(this.root.innerHTML);
    if (format === 'text') return toPlainText(html);
    return marker ? wrapDocument(html) : html;
  }

  setContent(html, { silent = false } = {}) {
    this.root.innerHTML = sanitizeHtml(unwrapDocument(html)) || '<p><br></p>';
    this._normalize();
    // Canonicalise loaded content immediately (e.g. un-bake exported colons),
    // even when silent, so getContent() right after setContent is already clean.
    this._runNormalizers();
    if (!silent) this._changed({ force: true });
  }

  /* ---------------------------------------------------------------- commands */

  addCommand(name, fn) {
    this.commands.set(name, fn);
  }

  /**
   * Register a DOM canonicaliser. It runs (in registration order) before every
   * content serialisation, so cleanups are never a change behind the value the
   * host receives. Must be idempotent.
   */
  addNormalizer(fn) {
    this.normalizers.push(fn);
  }

  /** Record a change after a plugin has mutated the DOM directly (no input event). */
  commit() {
    this._changed({ force: true });
  }

  execCommand(name, value) {
    const fn = this.commands.get(name);
    if (!fn) {
      console.warn(`[smartiv-editor] unknown command "${name}"`);
      return false;
    }
    this.root.focus({ preventScroll: true });
    const result = fn(value, this);
    this._changed();
    return result;
  }

  /** Thin wrapper over document.execCommand so plugins have one place to call. */
  native(command, value = null) {
    this.root.focus({ preventScroll: true });
    document.execCommand(command, false, value);
    return true;
  }

  queryState(command) {
    try { return document.queryCommandState(command); } catch { return false; }
  }

  queryValue(command) {
    try { return document.queryCommandValue(command); } catch { return ''; }
  }

  addShortcut(combo, commandName, value) {
    this.shortcuts.set(combo.toLowerCase(), { commandName, value });
  }

  /* ------------------------------------------------------------------ internal */

  _changed({ force = false } = {}) {
    // Canonicalise first, so the snapshot and the emitted value match the DOM.
    this._runNormalizers();
    this.history.push({ force });
    this.events.emit('change', this.getContent());
    this.events.emit('selectionchange');
  }

  _runNormalizers() {
    for (const fn of this.normalizers) {
      try {
        fn(this);
      } catch (err) {
        console.warn('[smartiv-editor] normalizer threw', err);
      }
    }
  }

  /**
   * Keep the document as a flat list of block elements.
   *
   * Any run of stray top-level inline nodes — a bare text node, a `<span>` or a
   * `<br>` dropped in by a paste — is gathered into a single `<p>`, and
   * whitespace-only text between blocks is discarded. Wrapping each text node
   * on its own used to split one visual line into several paragraphs.
   */
  _normalize() {
    const root = this.root;
    if (!root.firstChild) {
      root.innerHTML = '<p><br></p>';
      return;
    }

    const BLOCK = /^(P|DIV|DL|UL|OL|LI|H[1-6]|TABLE|THEAD|TBODY|TR|TD|TH|BLOCKQUOTE|HR|FIGURE|FIGCAPTION|PRE)$/;
    const isBlock = (n) => n.nodeType === Node.ELEMENT_NODE && BLOCK.test(n.tagName);

    // Indentation that came in from HTML source mode sits in the tree as
    // whitespace-only text nodes between block siblings. It is not content, and
    // leaving it there bloats every saved document a little more each round trip.
    const NESTED_BLOCK = /^(P|DIV|DL|DT|DD|UL|OL|LI|H[1-6]|TABLE|THEAD|TBODY|TR|TD|TH|BLOCKQUOTE|HR|FIGURE|FIGCAPTION|MAIN|SECTION)$/;
    const blockSide = (n) => !n || (n.nodeType === Node.ELEMENT_NODE && NESTED_BLOCK.test(n.tagName));
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const filler = [];
    let scan;
    while ((scan = walker.nextNode())) {
      if (scan.data.trim()) continue;
      if (blockSide(scan.previousSibling) && blockSide(scan.nextSibling)) filler.push(scan);
    }
    for (const node of filler) node.remove();

    let run = null; // the <p> currently collecting an inline run
    for (const node of [...root.childNodes]) {
      if (isBlock(node)) {
        run = null;
        continue;
      }
      // Whitespace between blocks is layout noise, not content.
      if (!run && node.nodeType === Node.TEXT_NODE && !node.textContent.trim()) {
        root.removeChild(node);
        continue;
      }
      if (!run) {
        run = document.createElement('p');
        root.insertBefore(run, node);
      }
      run.appendChild(node); // moves the node out of root and into the <p>
    }

    if (!root.firstChild) root.innerHTML = '<p><br></p>';
  }

  _bindDom() {
    const root = this.root;

    const onInput = () => {
      if (this._composing) return;
      this._normalize();
      this._changed();
    };

    const onKeyDown = (e) => {
      const combo = [
        e.ctrlKey || e.metaKey ? 'mod' : '',
        e.shiftKey ? 'shift' : '',
        e.altKey ? 'alt' : '',
        e.key.toLowerCase()
      ].filter(Boolean).join('+');

      const hit = this.shortcuts.get(combo);
      if (hit) {
        e.preventDefault();
        this.execCommand(hit.commandName, hit.value);
        return;
      }
      this.events.emit('keydown', e);
    };

    const onPaste = (e) => {
      e.preventDefault();
      const data = e.clipboardData;

      // A screenshot on the clipboard carries no text; pasting it would create
      // an <img> the sanitizer then strips, leaving the operator confused about
      // what happened. Say so instead.
      if (data && [...(data.files ?? [])].some((f) => f.type.startsWith('image/'))) {
        this.events.emit('notice', 'Images are not supported in screen content.');
        return;
      }

      const html = data?.getData('text/html');
      const text = data?.getData('text/plain') ?? '';
      const payload = html && !this.options.pastePlainText
        ? sanitizeHtml(html)
        : escapeText(text);
      this.native('insertHTML', payload);
      this._normalize();
      this._changed({ force: true });
    };

    // Dropping a file would let Chromium insert a blob: image straight into the
    // DOM, outside the paste path.
    const onDrop = (e) => {
      if (e.dataTransfer?.files?.length) {
        e.preventDefault();
        this.events.emit('notice', 'Images are not supported in screen content.');
      }
    };
    const onDragOver = (e) => {
      if (e.dataTransfer?.types?.includes('Files')) e.preventDefault();
    };

    const onSelection = () => this.events.emit('selectionchange');
    const onCompositionStart = () => { this._composing = true; };
    const onCompositionEnd = () => { this._composing = false; onInput(); };

    root.addEventListener('input', onInput);
    root.addEventListener('keydown', onKeyDown);
    root.addEventListener('paste', onPaste);
    root.addEventListener('drop', onDrop);
    root.addEventListener('dragover', onDragOver);
    root.addEventListener('compositionstart', onCompositionStart);
    root.addEventListener('compositionend', onCompositionEnd);
    root.addEventListener('mouseup', onSelection);
    root.addEventListener('keyup', onSelection);
    document.addEventListener('selectionchange', onSelection);

    this._unbind = () => {
      root.removeEventListener('input', onInput);
      root.removeEventListener('keydown', onKeyDown);
      root.removeEventListener('paste', onPaste);
      root.removeEventListener('drop', onDrop);
      root.removeEventListener('dragover', onDragOver);
      root.removeEventListener('compositionstart', onCompositionStart);
      root.removeEventListener('compositionend', onCompositionEnd);
      root.removeEventListener('mouseup', onSelection);
      root.removeEventListener('keyup', onSelection);
      document.removeEventListener('selectionchange', onSelection);
    };
  }
}

function escapeText(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML.replace(/\n/g, '<br>');
}
