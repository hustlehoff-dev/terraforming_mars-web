<template>
  <header class="decision-heading">
    <h2>{{ $t(title) }}</h2>
    <button v-if="closable" type="button" :aria-label="$t('Close')" @click="emit('close')">×</button>
  </header>
</template>

<script setup lang="ts">
import {Message} from '@/common/logs/Message';

defineProps<{title: string | Message, closable?: boolean}>();
const emit = defineEmits<{close: []}>();
</script>

<style scoped lang="less">
.decision-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  h2 {
    margin: 0;
    color: #fff0d2;
    font-size: 1.15rem;
    font-weight: 700;
  }

  button {
    display: grid;
    width: 44px;
    height: 44px;
    flex: none;
    place-items: center;
    margin: 0;
    padding: 0;
    border: 1px solid #49616d;
    border-radius: 9px;
    background: #142630;
    color: #eef4f6;
    font-family: inherit;
    font-size: 1.65rem;
    line-height: 1;
    cursor: pointer;

    &:hover {
      border-color: #92dbe5;
      background: #1d3945;
    }

    &:focus-visible {
      outline: 2px solid #f0ca83;
      outline-offset: 2px;
    }
  }
}
</style>
