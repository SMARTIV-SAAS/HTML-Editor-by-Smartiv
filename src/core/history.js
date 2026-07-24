import { saveCaret, restoreCaret } from './selection.js';

/**
 * Undo stack over full HTML snapshots. Snapshots are coalesced while the user
 * keeps typing so an undo jumps a word, not a character.
 */
export class History {
  constructor(root, { limit = 100, coalesceMs = 500 } = {}) {
    this.root = root;
    this.limit = limit;
    this.coalesceMs = coalesceMs;
    this.stack = [];
    this.index = -1;
    this._lastPush = 0;
  }

  reset(html) {
    this.stack = [{ html, caret: null }];
    this.index = 0;
  }

  push({ force = false } = {}) {
    const html = this.root.innerHTML;
    const current = this.stack[this.index];
    if (current && current.html === html) return;

    const now = Date.now();
    const coalesce = !force && now - this._lastPush < this.coalesceMs;
    this._lastPush = now;

    const entry = { html, caret: saveCaret(this.root) };

    if (coalesce && this.index >= 0) {
      this.stack[this.index] = entry;
      return;
    }

    this.stack = this.stack.slice(0, this.index + 1);
    this.stack.push(entry);
    if (this.stack.length > this.limit) this.stack.shift();
    this.index = this.stack.length - 1;
  }

  canUndo() { return this.index > 0; }
  canRedo() { return this.index < this.stack.length - 1; }

  undo() {
    if (!this.canUndo()) return false;
    // Make sure the live state is recorded before stepping back.
    this.push({ force: true });
    if (this.stack[this.index].html === this.root.innerHTML && this.index > 0) this.index--;
    this._apply();
    return true;
  }

  redo() {
    if (!this.canRedo()) return false;
    this.index++;
    this._apply();
    return true;
  }

  _apply() {
    const entry = this.stack[this.index];
    this.root.innerHTML = entry.html;
    restoreCaret(this.root, entry.caret);
  }
}
