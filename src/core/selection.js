/**
 * Selection helpers scoped to a single contenteditable root.
 * Everything guards against selections that live outside the root, which is the
 * usual cause of "toolbar button wrote into the wrong element" bugs.
 */

export function getSelection(root) {
  const sel = (root.getRootNode?.() ?? document).getSelection?.() ?? window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return null;
  return sel;
}

export function getRange(root) {
  return getSelection(root)?.getRangeAt(0) ?? null;
}

export function setRange(root, range) {
  const sel = window.getSelection();
  if (!sel || !range) return;
  sel.removeAllRanges();
  sel.addRange(range);
  root.focus({ preventScroll: true });
}

/** Snapshot the caret as offsets into the root's text, survives innerHTML writes. */
export function saveCaret(root) {
  const range = getRange(root);
  if (!range) return null;
  const pre = range.cloneRange();
  pre.selectNodeContents(root);
  pre.setEnd(range.startContainer, range.startOffset);
  const start = pre.toString().length;
  return { start, end: start + range.toString().length };
}

export function restoreCaret(root, snapshot) {
  if (!snapshot) return;
  const range = document.createRange();
  range.setStart(root, 0);
  range.collapse(true);

  let charIndex = 0;
  let foundStart = false;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);

  let node;
  while ((node = walker.nextNode())) {
    const next = charIndex + node.length;
    if (!foundStart && snapshot.start >= charIndex && snapshot.start <= next) {
      range.setStart(node, snapshot.start - charIndex);
      foundStart = true;
    }
    if (foundStart && snapshot.end >= charIndex && snapshot.end <= next) {
      range.setEnd(node, snapshot.end - charIndex);
      break;
    }
    charIndex = next;
  }
  setRange(root, range);
}

/** Nearest ancestor element of the caret, bounded by root. */
export function currentElement(root) {
  const range = getRange(root);
  if (!range) return null;
  let node = range.startContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;
  return root.contains(node) ? node : null;
}

/** Walk up from the caret until `predicate` matches or we leave the root. */
export function closestFromCaret(root, predicate) {
  let node = currentElement(root);
  while (node && node !== root) {
    if (predicate(node)) return node;
    node = node.parentNode;
  }
  return null;
}

/** Replace the current selection with a node and place the caret after it. */
export function insertNode(root, node) {
  const range = getRange(root);
  if (!range) {
    root.appendChild(node);
    return;
  }
  range.deleteContents();
  range.insertNode(node);
  const after = document.createRange();
  after.setStartAfter(node);
  after.collapse(true);
  setRange(root, after);
}
