<script setup>
import { ref, inject, computed } from 'vue';
import { FONT_STORE_KEY } from '../fontStore.js';
import { fontStack } from '../fonts.js';

/**
 * The separate "Fonts" page of the CMS.
 *
 * It writes to the shared store, so a font uploaded here becomes selectable in
 * every editor already mounted elsewhere in the app — no reload, no per-page
 * configuration.
 */
const props = defineProps({
  /** Falls back to the store provided by the Vue plugin. */
  store: { type: Object, default: null },
  sampleText: { type: String, default: 'Meeting in progress — 14.00' }
});

const injected = inject(FONT_STORE_KEY, null);
const store = computed(() => props.store ?? injected);

const file = ref(null);
const family = ref('');
const label = ref('');
const weight = ref(400);
const style = ref('normal');
const fallback = ref('sans-serif');
const busy = ref(false);
const message = ref(null);

const fonts = computed(() => store.value?.catalog.value ?? []);
const uploaded = computed(() => fonts.value.filter((f) => !store.value?.isStandard(f)));
const standard = computed(() => fonts.value.filter((f) => store.value?.isStandard(f)));

const canSubmit = computed(() => !!file.value && family.value.trim().length > 1 && !busy.value);

function onFile(event) {
  file.value = event.target.files?.[0] ?? null;
  message.value = null;
  // A sensible default: "BrandSans-Bold.woff2" → "BrandSans".
  if (file.value && !family.value) {
    family.value = file.value.name.replace(/\.[^.]+$/, '').replace(/[-_](regular|bold|italic|\d{3})$/i, '');
  }
}

async function submit() {
  if (!canSubmit.value) return;
  busy.value = true;
  message.value = null;
  try {
    const result = await store.value.upload(file.value, {
      family: family.value.trim(),
      label: label.value.trim() || family.value.trim(),
      weight: Number(weight.value),
      style: style.value,
      fallback: fallback.value
    });
    message.value = {
      type: result?.warning ? 'warn' : 'ok',
      text: result?.warning
        ?? (result?.local
          ? `"${family.value}" is available for this session only — no upload endpoint is configured.`
          : `"${family.value}" uploaded and available in every editor.`)
    };
    file.value = null;
    family.value = '';
    label.value = '';
  } catch (err) {
    message.value = { type: 'error', text: err.message };
  } finally {
    busy.value = false;
  }
}

async function drop(font) {
  if (!confirm(`Remove "${font.label}"? Screens already using it will fall back to a system font.`)) return;
  try {
    await store.value.remove(font.id);
  } catch (err) {
    message.value = { type: 'error', text: err.message };
  }
}

function faceSummary(font) {
  if (!font.faces?.length) return 'system stack';
  return font.faces
    .map((f) => `${f.weight ?? 400}${f.style === 'italic' ? ' italic' : ''}`)
    .join(', ');
}
</script>

<template>
  <div v-if="!store" class="sv-fonts sv-fonts--empty">
    No font store provided. Pass <code>:store</code>, or install the plugin with
    <code>app.use(SmartivEditorPlugin, { fonts: createFontStore(…) })</code>.
  </div>

  <div v-else class="sv-fonts">
    <section class="sv-fonts__panel">
      <h2>Add a font</h2>
      <p class="sv-fonts__hint">
        woff2 is preferred — it is roughly 40% smaller than the same face as ttf.
        Upload one file per weight and style.
      </p>

      <form class="sv-fonts__form" @submit.prevent="submit">
        <label class="sv-fonts__field">
          <span>Font file</span>
          <input type="file" accept=".woff2,.woff,.ttf,.otf" @change="onFile" />
        </label>

        <label class="sv-fonts__field">
          <span>Family name</span>
          <input v-model="family" type="text" placeholder="Montserrat" required />
          <small>
            This is the name @font-face declares, so it can be anything — it does
            not have to match the name inside the file. It must be unique, and it
            is stored inside saved content, so renaming it later orphans screens
            already using it.
          </small>
        </label>

        <label class="sv-fonts__field">
          <span>Display label <em>(optional)</em></span>
          <input v-model="label" type="text" :placeholder="family || 'Montserrat'" />
        </label>

        <div class="sv-fonts__row">
          <label class="sv-fonts__field">
            <span>Weight</span>
            <select v-model="weight">
              <option v-for="w in [100,200,300,400,500,600,700,800,900]" :key="w" :value="w">{{ w }}</option>
            </select>
          </label>
          <label class="sv-fonts__field">
            <span>Style</span>
            <select v-model="style">
              <option value="normal">Normal</option>
              <option value="italic">Italic</option>
            </select>
          </label>
          <label class="sv-fonts__field">
            <span>Fallback</span>
            <select v-model="fallback">
              <option value="sans-serif">sans-serif</option>
              <option value="serif">serif</option>
              <option value="cursive">cursive</option>
              <option value="monospace">monospace</option>
            </select>
          </label>
        </div>

        <button type="submit" class="sv-fonts__submit" :disabled="!canSubmit">
          {{ busy ? 'Uploading…' : 'Upload font' }}
        </button>
      </form>

      <p v-if="message" class="sv-fonts__msg" :class="`is-${message.type}`">{{ message.text }}</p>
      <p v-if="store.state.error" class="sv-fonts__msg is-error">
        Could not load the catalogue: {{ store.state.error }}
      </p>
    </section>

    <section class="sv-fonts__panel">
      <h2>Uploaded fonts <span class="sv-fonts__count">{{ uploaded.length }}</span></h2>
      <p v-if="!uploaded.length" class="sv-fonts__hint">Nothing uploaded yet.</p>

      <ul class="sv-fonts__list">
        <li v-for="font in uploaded" :key="font.id ?? font.family">
          <div class="sv-fonts__sample" :style="{ fontFamily: fontStack(font) }">{{ sampleText }}</div>
          <div class="sv-fonts__meta">
            <strong>{{ font.label }}</strong>
            <span>{{ font.family }} · {{ faceSummary(font) }}</span>
          </div>
          <button type="button" class="sv-fonts__remove" @click="drop(font)">Remove</button>
        </li>
      </ul>
    </section>

    <section class="sv-fonts__panel">
      <h2>Standard fonts <span class="sv-fonts__count">{{ standard.length }}</span></h2>
      <p class="sv-fonts__hint">
        Shipped with the player. Always available offline and cannot be removed.
      </p>
      <ul class="sv-fonts__list sv-fonts__list--compact">
        <li v-for="font in standard" :key="font.id">
          <div class="sv-fonts__sample" :style="{ fontFamily: fontStack(font) }">{{ sampleText }}</div>
          <div class="sv-fonts__meta"><strong>{{ font.label }}</strong></div>
        </li>
      </ul>
    </section>
  </div>
</template>
