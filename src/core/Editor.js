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
    if (!silent) this._changed({ force: true });
  }

  /* ---------------------------------------------------------------- commands */

  addCommand(name, fn) {
    this.commands.set(name, fn);
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
    this.history.push({ force });
    this.events.emit('change', this.getContent());
    this.events.emit('selectionchange');
  }

  /** Keep the document as a flat list of block elements; avoids stray text nodes. */
  _normalize() {
    if (!this.root.firstChild) {
      this.root.innerHTML = '<p><br></p>';
      return;
    }
    for (const node of [...this.root.childNodes]) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
        const p = document.createElement('p');
        this.root.insertBefore(p, node);
        p.appendChild(node);
      }
    }
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
