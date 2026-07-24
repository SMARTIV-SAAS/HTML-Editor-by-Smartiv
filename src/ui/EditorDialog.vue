<script setup>
import { reactive, watch, nextTick, ref } from 'vue';

const props = defineProps({ spec: { type: Object, default: null } });
const emit = defineEmits(['close']);

const values = reactive({});
const first = ref(null);

watch(
  () => props.spec,
  async (spec) => {
    for (const key of Object.keys(values)) delete values[key];
    if (!spec) return;
    for (const field of spec.fields) values[field.name] = field.value ?? '';
    await nextTick();
    first.value?.focus();
  },
  { immediate: true }
);

function submit() {
  const spec = props.spec;
  const missing = spec.fields.some((f) => f.required && !String(values[f.name]).trim());
  if (missing) return;
  emit('close');
  // Restore the caret first: focus moved to the dialog while the user typed.
  spec.restore?.();
  spec.onSubmit({ ...values });
}
</script>

<template>
  <div v-if="spec" class="sv-dialog__backdrop" @click.self="emit('close')">
    <form class="sv-dialog" @submit.prevent="submit" @keydown.esc="emit('close')">
      <h3>{{ spec.title }}</h3>

      <label v-for="(field, i) in spec.fields" :key="field.name" class="sv-dialog__field">
        <span>{{ field.label }}</span>
        <input
          v-if="field.type === 'checkbox'"
          type="checkbox"
          v-model="values[field.name]"
        />
        <input
          v-else
          :ref="(el) => { if (i === 0) first = el; }"
          type="text"
          v-model="values[field.name]"
          :required="field.required"
        />
      </label>

      <div class="sv-dialog__actions">
        <button type="button" @click="emit('close')">Cancel</button>
        <button type="submit" class="is-primary">Save</button>
      </div>
    </form>
  </div>
</template>
