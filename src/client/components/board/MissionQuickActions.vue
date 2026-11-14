<template>
  <aside v-if="actions.length" class="mission-quick-actions" :aria-label="$t('Available actions')">
    <button v-for="action in actions" :key="action.id" type="button" class="mission-quick-actions__button"
      :class="{'mission-quick-actions__button--disabled': action.disabled}"
      :aria-disabled="action.disabled ? 'true' : undefined"
      :aria-label="$t(action.label) + (action.cost !== undefined ? ' · ' + action.cost + ' M€' : '')"
      :title="action.disabled ? $t('Not available now: not enough resources or no legal target') : $t(action.label)"
      @click="!action.disabled && emit('select', action)">
      <ResourceIcon v-if="action.icon" :resource="action.icon" />
      <span class="mission-quick-actions__label">{{ $t(action.label) }}</span>
      <span v-if="action.cost !== undefined" class="mission-quick-actions__cost">{{ action.cost }}</span>
    </button>
  </aside>
</template>

<script setup lang="ts">
import ResourceIcon from '@/client/components/common/ResourceIcon.vue';
import type {MissionQuickAction} from './MissionQuickAction';

defineProps<{actions: readonly MissionQuickAction[]}>();
const emit = defineEmits<{select: [action: MissionQuickAction]}>();
</script>

<style scoped lang="less">
.mission-quick-actions__cost {
  display: inline-grid;
  min-width: 22px;
  height: 22px;
  place-items: center;
  margin-left: auto;
  padding: 0 4px;
  border: 1px solid #6b4b00;
  border-radius: 4px;
  background: linear-gradient(#ffe36b, #f0b20f);
  color: #1b1200;
  font-weight: 800;
}

.mission-quick-actions__button--disabled {
  border-color: #6b7a80 !important;
  background: #1a2228d9 !important;
  color: #9aa6ab !important;
  cursor: not-allowed !important;
  filter: grayscale(0.8);
  animation: none !important;
}
</style>
