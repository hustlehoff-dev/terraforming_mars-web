<template>
  <div class="world-government">
    <header class="world-government__header">
      <h2>{{ $t('World Government Terraforming') }}</h2>
      <button v-if="closeMissionPanel" type="button" :aria-label="$t('Close')" @click="closeMissionPanel">×</button>
    </header>
    <button v-for="(action, index) in actions" :key="index" class="world-government__action"
      type="button" :disabled="busy" @click="emit('choose', index)">
      <img v-if="action.icon" :src="action.icon" alt="">
      <strong v-if="action.change">{{ action.change }}</strong>
      <span v-else-if="action.onMap" class="world-government__arrow" aria-hidden="true">›</span>
      <span>{{ $t(action.title) }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import {computed, inject} from 'vue';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';

const props = defineProps<{options: ReadonlyArray<PlayerInputModel>, busy: boolean}>();
const emit = defineEmits<{choose: [index: number]}>();
const closeMissionPanel = inject<() => void>('closeMissionPanel');

const effects: Record<string, {icon: string, change?: string}> = {
  'Increase temperature': {icon: 'assets/global-parameters/temperature.png', change: '+2 °C'},
  'Increase oxygen': {icon: 'assets/global-parameters/oxygen.png', change: '+1%'},
  'Add an ocean': {icon: 'assets/tiles/ocean.png', change: '+1'},
  'Increase Venus scale': {icon: 'assets/global-parameters/venus.png', change: '+2%'},
  'Remove an unprotected hazard': {icon: 'assets/remove-dust-storms.png'},
  'Increase the Moon habitat rate': {icon: 'assets/moon/card-habitat-rate.png', change: '+1'},
  'Increase the Moon mining rate': {icon: 'assets/moon/card-mining-rate.png', change: '+1'},
  'Increase the Moon logistic rate': {icon: 'assets/moon/card-logistic-rate.png', change: '+1'},
};

const actions = computed(() => props.options.map((option) => ({
  ...effects[typeof option.title === 'string' ? option.title : option.title.message],
  title: option.title,
  onMap: option.type === 'space',
})));
</script>

<style scoped lang="less">
.world-government {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  justify-items: stretch;
  gap: clamp(8px, 1.5vw, 14px);
  max-width: 680px;
  margin-inline: auto;

  button {
    margin: 0;
    border: 1px solid #49616d;
    border-radius: 9px;
    background: #142630;
    color: #eef4f6;
    font-family: inherit;
    cursor: pointer;

    &:hover:not(:disabled) {
      border-color: #92dbe5;
      background: #1d3945;
    }

    &:focus-visible {
      outline: 2px solid #f0ca83;
      outline-offset: 2px;
    }

    &:disabled {
      opacity: 0.55;
      cursor: wait;
    }
  }
}

.world-government__header {
  grid-column: 1 / -1;
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
    padding: 0;
    font-size: 1.65rem;
    line-height: 1;
  }
}

.world-government__action {
  display: flex;
  min-height: clamp(128px, 23dvh, 176px);
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: clamp(8px, 2vw, 16px);
  font-size: clamp(0.9rem, 2.6vw, 1.12rem);
  font-weight: 700;
  line-height: 1.2;
  overflow-wrap: anywhere;
  text-align: center;

  img {
    width: clamp(44px, 10vw, 68px);
    height: clamp(44px, 10vw, 68px);
    object-fit: contain;
  }

  strong,
  .world-government__arrow {
    color: #b2e6ee;
    font-size: clamp(1.35rem, 4vw, 1.8rem);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
}

:global(#player-home .mission-panel--decision:has(.world-government) > .mission-panel__nav) {
  display: none;
}

:global(#player-home.mission-cinematic .mission-panel.mission-panel--decision:has(.world-government)) {
  width: min(740px, calc(100vw - 24px)) !important;
}
</style>
