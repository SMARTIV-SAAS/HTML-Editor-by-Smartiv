/** Minimal table support: insert, add/remove row & column. */
export function tablePlugin(editor) {
  editor.addCommand('insertTable', ({ rows = 3, cols = 3, header = true } = {}) => {
    const table = document.createElement('table');
    table.className = 'sv-table';
    if (header) {
      const thead = table.createTHead();
      const tr = thead.insertRow();
      for (let c = 0; c < cols; c++) {
        const th = document.createElement('th');
        th.innerHTML = '<br>';
        tr.appendChild(th);
      }
    }
    const tbody = table.createTBody();
    for (let r = 0; r < rows; r++) {
      const tr = tbody.insertRow();
      for (let c = 0; c < cols; c++) tr.insertCell().innerHTML = '<br>';
    }
    editor.selection.insert(table);
    return true;
  });

  editor.addCommand('tableAddRow', () => {
    const { row } = context(editor) ?? {};
    if (!row) return false;
    const clone = row.cloneNode(true);
    clone.querySelectorAll('td, th').forEach((c) => { c.innerHTML = '<br>'; });
    row.after(clone);
    return true;
  });

  editor.addCommand('tableDeleteRow', () => {
    const { row } = context(editor) ?? {};
    row?.remove();
    return !!row;
  });

  editor.addCommand('tableAddColumn', () => {
    const ctx = context(editor);
    if (!ctx) return false;
    const index = ctx.cell.cellIndex;
    ctx.table.querySelectorAll('tr').forEach((tr) => {
      const ref = tr.cells[index];
      const cell = document.createElement(ref?.tagName === 'TH' ? 'th' : 'td');
      cell.innerHTML = '<br>';
      ref ? ref.after(cell) : tr.appendChild(cell);
    });
    return true;
  });

  editor.addCommand('tableDeleteColumn', () => {
    const ctx = context(editor);
    if (!ctx) return false;
    const index = ctx.cell.cellIndex;
    ctx.table.querySelectorAll('tr').forEach((tr) => tr.cells[index]?.remove());
    return true;
  });

  editor.ui.addButton('table', { icon: '▦', label: 'Insert table', command: 'insertTable' });
  editor.ui.addButton('tableAddRow', {
    icon: '＋▤', label: 'Add row', command: 'tableAddRow', enabled: () => !!context(editor)
  });
  editor.ui.addButton('tableAddColumn', {
    icon: '＋▥', label: 'Add column', command: 'tableAddColumn', enabled: () => !!context(editor)
  });
  editor.ui.addButton('tableDeleteRow', {
    icon: '－▤', label: 'Delete row', command: 'tableDeleteRow', enabled: () => !!context(editor)
  });
  editor.ui.addButton('tableDeleteColumn', {
    icon: '－▥', label: 'Delete column', command: 'tableDeleteColumn', enabled: () => !!context(editor)
  });
}
tablePlugin.pluginName = 'table';

function context(editor) {
  const cell = editor.selection.closest((n) => n.nodeType === 1 && /^(TD|TH)$/.test(n.tagName));
  if (!cell) return null;
  return { cell, row: cell.parentNode, table: cell.closest('table') };
}
