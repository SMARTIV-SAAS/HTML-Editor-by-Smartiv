import './styles/editor.css';
import SmartivEditor from './SmartivEditor.vue';
import FontManager from './ui/FontManager.vue';
import { FONT_STORE_KEY } from './fontStore.js';

export { SmartivEditor };
export { Editor } from './core/Editor.js';
export { sanitizeHtml, toPlainText } from './core/sanitize.js';
export { bakeColons } from './core/output.js';
export {
  isSmartivHtml, documentVersion, wrapDocument, unwrapDocument, SV_DOC_VERSION
} from './core/marker.js';
export { toPortable, fromPortable } from './core/portable.js';
export { defaultPlugins, defaultToolbar, compactToolbar } from './presets.js';
export { buildDocument } from './plugins/tv.js';
export { prettyPrint } from './plugins/sourceView.js';
export { TV_CSS } from './styles/tvCss.js';
export { ensureContentStyles } from './styles/inject.js';

export { historyPlugin } from './plugins/history.js';
export { inlinePlugin } from './plugins/inline.js';
export { blocksPlugin } from './plugins/blocks.js';
export { alignPlugin } from './plugins/align.js';
export { listsPlugin } from './plugins/lists.js';
export { typographyPlugin } from './plugins/typography.js';
export { fieldListPlugin } from './plugins/fieldList.js';
export { linkPlugin } from './plugins/link.js';
export { tablePlugin } from './plugins/table.js';
export { sourceViewPlugin } from './plugins/sourceView.js';
export { tvPlugin } from './plugins/tv.js';
export { FONTS, fontStack, fontOptions, fontFaceCss, legacyFontClassCss, usedFonts, usedFontNames } from './fonts.js';

export { default as SmartivFontManager } from './ui/FontManager.vue';
export {
  createFontStore, createRestTransport, validateFontFile, sniffFormat, FONT_STORE_KEY
} from './fontStore.js';

/**
 * Vue plugin: registers <SmartivEditor /> and <SmartivFontManager />.
 *
 * Pass `fonts` to share one catalogue across every editor in the app — an
 * upload on the font manager page then reaches editors already mounted on other
 * routes, with no reload.
 *
 *   app.use(SmartivEditorPlugin, {
 *     fonts: createFontStore({
 *       transport: createRestTransport({ endpoint: '/api/fonts' }),
 *       remoteBase: '/fonts/'
 *     })
 *   });
 */
export const SmartivEditorPlugin = {
  install(app, options = {}) {
    app.component(options.name ?? 'SmartivEditor', SmartivEditor);
    app.component(options.fontManagerName ?? 'SmartivFontManager', FontManager);
    if (options.fonts) app.provide(FONT_STORE_KEY, options.fonts);
    if (options.defaults) app.provide('smartivEditorDefaults', options.defaults);
  }
};

export default SmartivEditorPlugin;
