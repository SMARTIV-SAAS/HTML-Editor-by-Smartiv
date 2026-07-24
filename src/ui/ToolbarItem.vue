<script setup>
import { computed, ref, onBeforeUnmount } from 'vue';
import { iconSvg, hasIcon } from './icons.js';

const props = defineProps({
  item: { type: Object, required: true },
  editor: { type: Object, required: true },
  // Bumped by the parent on every selection change so the computeds re-run.
  tick: { type: Number, default: 0 }
});

const open = ref(false);

const isActive = computed(() => (props.tick, props.item.active?.() ?? false));
const isEnabled = computed(() => (props.tick, props.item.enabled?.() ?? true));
const currentValue = computed(() => (props.tick, props.item.value?.() ?? ''));

// A vector icon when the button name maps to one; the plugin's text glyph
// otherwise. Keeps every plugin free of icon markup.
const svg = computed(() => iconSvg(props.item.name));
const useSvg = computed(() => hasIcon(props.item.name));

// Options may be a function so a plugin can serve a list that changes at
// runtime — the font dropdown grows the moment a font is uploaded elsewhere.
const options = computed(() =>
  (props.tick, typeof props.item.options === 'function' ? props.item.options() : props.item.options ?? [])
);

const swatches = computed(() => props.item.swatches ?? [
  '#ffffff', '#e6edf3', '#9aa7b4', '#5b6773', '#1c2430', '#000000', '#ffd166', '#f4a261',
  '#e63946', '#d62828', '#f77f00', '#fcbf49', '#2a9d8f', '#43aa8b', '#0b63c5', '#1fbfd4'
]);

const currentColor = computed(() => (props.tick, props.item.current?.() ?? '#000000'));

function run(value) {
  props.editor.execCommand(props.item.command, value);
}

function pick(color) {
  open.value = false;
  run(color);
}

/** Clearing hands the run back to the theme default rather than painting it. */
function clear() {
  open.value = false;
  run('');
}

function onClickOutside(e) {
  if (!e.target.closest?.('.sv-color')) open.value = false;
}
document.addEventListener('click', onClickOutside);
onBeforeUnmount(() => document.removeEventListener('click', onClickOutside));
</script>

<template>
  <div v-if="item.type === 'separator'" class="sv-toolbar__sep" />

  <label
    v-else-if="item.type === 'select'"
    class="sv-select"
    :class="{ 'is-disabled': !isEnabled }"
    :title="item.label"
  >
    <select
      :style="{ width: item.width ? item.width + 'px' : null }"
      :aria-label="item.label"
      :disabled="!isEnabled"
      :value="currentValue"
      @change="run($event.target.value)"
    >
      <option value="" disabled>{{ item.label }}</option>
      <option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.text }}</option>
    </select>
    <svg class="sv-select__caret" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </label>

  <div v-else-if="item.type === 'color'" class="sv-color">
    <button
      type="button"
      class="sv-btn sv-btn--color"
      :title="item.label"
      :aria-label="item.label"
      :aria-expanded="open"
      :disabled="!isEnabled"
      @click.stop="open = !open"
    >
      <span class="sv-btn__ico" v-if="useSvg" v-html="svg" />
      <span class="sv-btn__ico" v-else>{{ item.icon }}</span>
      <span class="sv-color__bar" :style="{ background: currentColor }" />
    </button>
    <div v-if="open" class="sv-color__panel">
      <button
        v-for="color in swatches"
        :key="color"
        type="button"
        class="sv-color__swatch"
        :class="{ 'is-current': color.toLowerCase() === currentColor.toLowerCase() }"
        :style="{ background: color }"
        :title="color"
        @click="pick(color)"
      />
      <label class="sv-color__custom">
        <span>Custom</span>
        <input type="color" :value="currentColor" @change="pick($event.target.value)" />
      </label>
      <button type="button" class="sv-color__reset" @click="clear">
        {{ item.resetLabel ?? 'Clear' }}
      </button>
    </div>
  </div>

  <button
    v-else
    type="button"
    class="sv-btn"
    :class="{ 'sv-btn--active': isActive }"
    :title="item.label"
    :aria-label="item.label"
    :aria-pressed="isActive"
    :disabled="!isEnabled"
    @mousedown.prevent
    @click="run()"
  >
    <span class="sv-btn__ico" v-if="useSvg" v-html="svg" />
    <span class="sv-btn__ico sv-btn__ico--glyph" v-else>{{ item.icon }}</span>
  </button>
</template>
