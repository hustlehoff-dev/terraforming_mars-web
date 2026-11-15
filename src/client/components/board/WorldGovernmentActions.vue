<template>
  <div class="world-government">
    <h2>{{ $t('World Government Terraforming') }}</h2>
    <div class="world-government__actions">
      <button v-for="(action, index) in actions" :key="index" type="button" :disabled="busy"
        @click="emit('choose', index)">
        <img v-if="action.icon" :src="action.icon" alt="">
        <span>{{ $t(action.title) }}</span>
        <strong v-if="action.change">{{ action.change }}</strong>
        <span v-else-if="action.onMap" class="world-government__arrow" aria-hidden="true">›</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {computed} from 'vue';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';

const props = defineProps<{options: ReadonlyArray<PlayerInputModel>, busy: boolean}>();
const emit = defineEmits<{choose: [index: number]}>();

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
  max-width: 440px;
  margin-inline: auto;

  h2 {
    margin: 0 0 14px;
    color: #fff0d2;
    font-size: 1.15rem;
    font-weight: 700;
  }
}

.world-government__actions {
  display: grid;
  gap: 5px;

  button {
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    min-height: 50px;
    padding: 7px 12px;
    border: 1px solid #354951;
    border-radius: 6px;
    background: #12212a;
    color: #edf4f6;
    font: inherit;
    font-size: 0.9rem;
    line-height: 1.2;
    text-align: start;
    cursor: pointer;

    &:hover:not(:disabled) {
      border-color: #87b6be;
      background: #213943;
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

  img {
    width: 28px;
    height: 28px;
    object-fit: contain;
  }

  img + span,
  button > span:first-child {
    grid-column: 2;
  }

  strong,
  .world-government__arrow {
    color: #a7dfdf;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
}

:global(#player-home .mission-panel:has(.world-government) .mission-panel__nav > strong) {
  display: none;
}

:global(#player-home.mission-cinematic .mission-panel.mission-panel--decision:has(.world-government)) {
  width: min(490px, calc(100vw - 24px)) !important;
}
</style>
