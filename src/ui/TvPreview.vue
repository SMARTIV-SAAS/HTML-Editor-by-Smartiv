<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { buildDocument } from '../plugins/tv.js';

const props = defineProps({
  html: { type: String, default: '' },
  tv: { type: Object, default: () => ({}) },
  safeArea: { type: Boolean, default: true }
});

const box = ref(null);
const scale = ref(1);
let observer;

// The stage is always authored at 1920x1080 and scaled down to fit, so the
// operator judges proportions exactly as the panel will render them.
const doc = computed(() => buildDocument(props.html, props.tv));

function fit() {
  if (!box.value) return;
  // clientWidth includes the wrapper padding, which the 1920px stage must not eat.
  const style = getComputedStyle(box.value);
  const inner = box.value.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  scale.value = Math.min(1, inner / 1920);
}

onMounted(() => {
  fit();
  observer = new ResizeObserver(fit);
  observer.observe(box.value);
});
onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <div ref="box" class="sv-preview">
    <div class="sv-preview__scaler" :style="{ height: 1080 * scale + 'px' }">
      <div class="sv-preview__frame" :style="{ transform: `scale(${scale})` }">
        <iframe class="sv-preview__stage" :srcdoc="doc" sandbox="allow-same-origin" title="Pratinjau TV" />
        <div v-if="safeArea" class="sv-preview__safe" />
      </div>
    </div>
  </div>
</template>
