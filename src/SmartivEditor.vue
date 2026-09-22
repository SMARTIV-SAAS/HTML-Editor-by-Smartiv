<script setup>
import { ref, shallowRef, watch, computed, inject, onMounted, onBeforeUnmount } from 'vue';
import { FONT_STORE_KEY } from './fontStore.js';
import { Editor } from './core/Editor.js';
import { defaultPlugins, defaultToolbar } from './presets.js';
import { prettyPrint } from './plugins/sourceView.js';
import { resolveTheme, DEFAULT_THEME } from './plugins/theme.js';
import { FONTS, usedFontNames } from './fonts.js';
import { ensureContentStyles } from './styles/inject.js';
import Toolbar from './ui/Toolbar.vue';
import EditorDialog from './ui/EditorDialog.vue';
import TvPreview from './ui/TvPreview.vue';

const props = defineProps({
  modelValue: { type: String, default: '' },
  /** Background theme name — v-model:theme keeps it in sync with the host. */
  theme: { type: String, default: DEFAULT_THEME },
  /** Plugin factories; defaults to the full Smartiv set. */
  plugins: { type: Array, default: () => defaultPlugins },
  /** Array of groups of registered button names. */
  toolbar: { type: Array, default: () => defaultToolbar },
  options: { type: Object, default: () => ({}) },
  placeholder: { type: String, default: 'Write the screen content here…' },
  minHeight: { type: String, default: '320px' },
  maxHeight: { type: String, default: '60vh' },
  dark: { type: Boolean, default: false },
  /** Paint the editing surface with the TV background instead of white. */
  tvSurface: { type: Boolean, default: true },
  readonly: { type: Boolean, default: false }
});

const emit = defineEmits([
  'update:modelValue', 'update:theme', 'update:fonts', 'change', 'init', 'export'
]);

const rootEl = ref(null);
const editor = shallowRef(null);
const mode = ref('wysiwyg');
const sourceText = ref('');
const safeArea = ref(true);
const dialog = ref(null);
const tick = ref(0);
const words = ref(0);

let syncing = false;

const activeTheme = ref(props.theme);
const themeVars = computed(() => resolveTheme(activeTheme.value));

/** Static tv config first, then the live theme — the operator's pick wins. */
const tvOptions = computed(() => ({ ...(props.options.tv ?? {}), ...themeVars.value }));

// The editing surface is a plain neutral white — it no longer mirrors the TV
// theme background. The theme was an editing aid that only confused operators
// once the on-TV background became transparent, so the surface stays neutral
// and the theme survives solely as the TV text colour (used by the preview and
// the exported document).
const surfaceStyle = computed(() => ({
  '--sv-min-height': props.minHeight,
  '--sv-max-height': props.maxHeight
}));

const notice = ref('');
let noticeTimer;

// Shared across every editor in the app: a font uploaded on the font manager
// page shows up here without this component being remounted.
const fontStore = inject(FONT_STORE_KEY, null);

const fontCatalog = computed(
  () => props.options.fontCatalog ?? fontStore?.catalog.value ?? FONTS
);

/**
 * Which families this document needs, published so the host can persist them
 * next to the HTML. The player reads that list to warm its font cache before
 * the screen is due, which is what keeps text from re-flowing mid-rotation.
 */
let lastFonts = '';
function emitFonts(html) {
  const names = usedFontNames(html, fontCatalog.value);
  const key = names.join('|');
  if (key === lastFonts) return;
  lastFonts = key;
  emit('update:fonts', names);
}

const modeLabel = computed(() => ({
  source: 'HTML source mode',
  preview: 'Preview 1920×1080'
}[mode.value] ?? 'WYSIWYG mode'));

const isEmpty = computed(() => {
  const html = props.modelValue?.replace(/<[^>]*>/g, '').trim();
  return !html;
});

onMounted(() => {
  ensureContentStyles(document, {
    bundledBase: props.options.fontBundledBase,
    remoteBase: props.options.fontRemoteBase ?? fontStore?.remoteBase,
    catalog: fontCatalog.value
  });

  const instance = new Editor(rootEl.value, {
    ...props.options,
    theme: props.theme,
    fontCatalog: fontCatalog.value
  });
  for (const plugin of props.plugins) instance.use(plugin);

  instance.events.on('theme', (name) => {
    activeTheme.value = name;
    emit('update:theme', name);
    tick.value++;
  });

  instance.events.on('change', (html) => {
    syncing = true;
    words.value = countWords(html);
    emitFonts(html);
    emit('update:modelValue', html);
    emit('change', html);
    tick.value++;
    // Let the modelValue watcher see the flag, then clear it.
    queueMicrotask(() => { syncing = false; });
  });

  instance.events.on('selectionchange', () => { tick.value++; });

  instance.events.on('notice', (message) => {
    notice.value = message;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { notice.value = ''; }, 4000);
  });

  instance.events.on('dialog', (spec) => {
    dialog.value = { ...spec, restore: () => instance.selection.restore(spec.caret) };
  });

  instance.events.on('toggle-source', () => {
    if (mode.value === 'source') {
      instance.setContent(sourceText.value);
      mode.value = 'wysiwyg';
    } else {
      sourceText.value = prettyPrint(instance.getContent());
      mode.value = 'source';
    }
  });

  instance.events.on('toggle-preview', () => {
    mode.value = mode.value === 'preview' ? 'wysiwyg' : 'preview';
  });

  instance.events.on('toggle-safe-area', () => { safeArea.value = !safeArea.value; });

  instance.events.on('export', (payload) => {
    emit('export', payload);
    if (props.options.autoDownload !== false) download(payload);
  });

  instance.init(props.modelValue);
  emitFonts(instance.getContent());
  instance.root.setAttribute('contenteditable', String(!props.readonly));
  editor.value = instance;
  words.value = countWords(instance.getContent());
  emit('init', instance);
});

onBeforeUnmount(() => {
  clearTimeout(noticeTimer);
  editor.value?.destroy();
});

watch(() => props.modelValue, (value) => {
  if (syncing || !editor.value) return;
  if (value !== editor.value.getContent()) editor.value.setContent(value, { silent: true });
});

// The catalogue is live. Refresh the @font-face block, hand the new list to the
// typography plugin, and bump the tick so the dropdown re-renders.
watch(fontCatalog, (catalog) => {
  ensureContentStyles(document, {
    bundledBase: props.options.fontBundledBase,
    remoteBase: props.options.fontRemoteBase ?? fontStore?.remoteBase,
    catalog
  });
  if (editor.value) {
    editor.value.fontCatalog = catalog;
    tick.value++;
  }
});

watch(() => props.theme, (name) => {
  if (!editor.value || name === activeTheme.value) return;
  editor.value.execCommand('setTheme', name);
});

watch(() => props.readonly, (ro) => {
  editor.value?.root.setAttribute('contenteditable', String(!ro));
});

function applySource() {
  editor.value.setContent(sourceText.value);
  mode.value = 'wysiwyg';
}

function download({ filename, html }) {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function countWords(html) {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ');
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

defineExpose({
  getEditor: () => editor.value,
  /** Families this document needs — persist alongside the HTML. */
  getUsedFonts: () => usedFontNames(editor.value?.getContent() ?? '', fontCatalog.value),
  getContent: (opts) => editor.value?.getContent(opts),
  setContent: (html) => editor.value?.setContent(html),
  exportTv: () => editor.value?.execCommand('exportTv')
});
</script>

<template>
  <div class="sv-editor" :class="{ 'sv-editor--dark': dark }">
    <Toolbar v-if="editor" :editor="editor" :layout="toolbar" :tick="tick" />

    <div class="sv-surface" :style="surfaceStyle">
      <!-- The contenteditable stays mounted in every mode: unmounting it would
           throw away the undo stack and the caret. -->
      <div
        v-show="mode === 'wysiwyg'"
        ref="rootEl"
        class="sv-content"
        :class="{ 'sv-content--tv': tvSurface }"
        :data-placeholder="placeholder"
        :data-empty="isEmpty"
        role="textbox"
        aria-multiline="true"
      />

      <textarea
        v-if="mode === 'source'"
        v-model="sourceText"
        class="sv-source"
        spellcheck="false"
        @blur="applySource"
      />

      <TvPreview
        v-if="mode === 'preview'"
        :html="modelValue"
        :tv="tvOptions"
        :safe-area="safeArea"
      />
    </div>

    <div class="sv-status">
      <span>{{ words }} {{ words === 1 ? 'word' : 'words' }}</span>
      <span v-if="notice" class="sv-status__notice">{{ notice }}</span>
      <span>{{ modeLabel }}</span>
    </div>

    <EditorDialog :spec="dialog" @close="dialog = null" />
  </div>
</template>
