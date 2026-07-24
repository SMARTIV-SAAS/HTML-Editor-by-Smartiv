import { historyPlugin } from './plugins/history.js';
import { inlinePlugin } from './plugins/inline.js';
import { blocksPlugin } from './plugins/blocks.js';
import { alignPlugin } from './plugins/align.js';
import { listsPlugin } from './plugins/lists.js';
import { typographyPlugin } from './plugins/typography.js';
import { fieldListPlugin } from './plugins/fieldList.js';
import { linkPlugin } from './plugins/link.js';
import { tablePlugin } from './plugins/table.js';
import { sourceViewPlugin } from './plugins/sourceView.js';
import { tvPlugin } from './plugins/tv.js';
import { themePlugin } from './plugins/theme.js';

export const defaultPlugins = [
  themePlugin,
  historyPlugin,
  inlinePlugin,
  blocksPlugin,
  alignPlugin,
  listsPlugin,
  typographyPlugin,
  fieldListPlugin,
  linkPlugin,
  tablePlugin,
  sourceViewPlugin,
  tvPlugin
];

export const defaultToolbar = [
  ['undo', 'redo'],
  ['blockFormat', 'fontFamily', 'fontSize'],
  ['bold', 'italic', 'underline', 'strikethrough', 'removeFormat'],
  ['foreColor', 'backColor'],
  ['alignLeft', 'alignCenter', 'alignRight', 'alignJustify'],
  ['bulletList', 'numberList', 'outdent', 'indent'],
  ['fieldList', 'fieldListColon', 'fieldListLabelWidth'],
  ['panels', 'panelColumns', 'table', 'tableAddRow', 'tableAddColumn', 'tableDeleteRow', 'tableDeleteColumn'],
  ['link', 'unlink', 'hr'],
  ['theme', 'themeToggle'],
  ['source', 'preview', 'safeArea', 'exportTv']
];

/** Cut-down bar for CMS forms that only need the signage essentials. */
export const compactToolbar = [
  ['undo', 'redo'],
  ['blockFormat', 'fontSize'],
  ['bold', 'italic', 'underline'],
  ['foreColor'],
  ['alignLeft', 'alignCenter', 'alignRight'],
  ['fieldList', 'fieldListColon'],
  ['panels', 'panelColumns'],
  ['theme', 'preview']
];
