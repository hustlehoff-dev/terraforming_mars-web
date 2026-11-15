<template>
  <div class="decision-tiles"
    :class="{'decision-tiles--with-close': closable, 'decision-tiles--single': primaryCount <= 1, 'decision-tiles--many': primaryCount > 4}">
    <DecisionHeading v-if="title" class="decision-tiles__heading" :title="title" :closable="closable" @close="closeMissionPanel?.()" />
    <p v-if="warning !== undefined" class="decision-tiles__warning card-warning">{{ $t(warning) }}</p>
    <button v-for="{choice, index} in orderedChoices" :key="index" class="decision-tiles__choice"
      :class="{'decision-tiles__choice--secondary': choice.secondary}"
      type="button" :disabled="busy || choice.disabled" :aria-busy="busy || undefined" :aria-pressed="choice.selected" @click="emit('choose', index)">
      <img v-if="choice.icon" :key="choice.icon" :src="choice.icon" alt="" @error="($event.target as HTMLImageElement).style.visibility = 'hidden'">
      <strong v-if="choice.price !== undefined" class="decision-tiles__price">{{ choice.price }} M€</strong>
      <strong v-else-if="choice.change">{{ choice.change }}</strong>
      <span>
        <span v-if="choice.targetColor && !choice.owner" class="decision-tiles__player-color" :class="playerColorClass(choice.targetColor, 'bg')" aria-hidden="true"></span>
        {{ choice.literalTitle ?? $t(choice.title) }}
      </span>
      <small v-if="choice.description" class="decision-tiles__description">{{ $t(choice.description) }}</small>
      <small v-if="choice.details" class="decision-tiles__details">{{ choice.details }}</small>
      <small v-if="choice.owner" class="decision-tiles__owner">
        <span v-if="choice.targetColor" class="decision-tiles__player-color" :class="playerColorClass(choice.targetColor, 'bg')" aria-hidden="true"></span>
        {{ choice.owner }}
      </small>
    </button>
  </div>
</template>

<script setup lang="ts">
import {computed, inject, Ref} from 'vue';
import {Message} from '@/common/logs/Message';
import {playerColorClass} from '@/common/utils/utils';
import DecisionHeading from './DecisionHeading.vue';
import {DecisionChoice} from './DecisionChoice';

const props = defineProps<{
  choices: ReadonlyArray<DecisionChoice>;
  title?: string | Message;
  warning?: string | Message;
  ownsHeading?: boolean;
  busy?: boolean;
}>();
const emit = defineEmits<{choose: [index: number]}>();
const closeMissionPanel = inject<() => void>('closeMissionPanel');
const missionDecisionPanel = inject<Ref<boolean>>('missionDecisionPanel');
const cardDialog = inject<Ref<boolean>>('cardDialog');
const closable = computed(() => Boolean(props.title && props.ownsHeading && closeMissionPanel && missionDecisionPanel?.value && !cardDialog?.value));
const primaryCount = computed(() => props.choices.filter((choice) => !choice.secondary).length);
const orderedChoices = computed(() => props.choices.map((choice, index) => ({choice, index}))
  .sort((a, b) => Number(Boolean(a.choice.secondary)) - Number(Boolean(b.choice.secondary))));
</script>

<style scoped lang="less">
.decision-tiles {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  justify-items: stretch;
  gap: clamp(8px, 1.5vw, 14px);
  max-width: 680px;
  margin-inline: auto;

  &--single {
    grid-template-columns: minmax(0, 1fr);
  }

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

    &[aria-pressed='true'] {
      border-color: #e2c27f;
      background: #1d3945;
    }

    &:disabled {
      opacity: 0.75;
      cursor: not-allowed;
    }

    &[aria-busy='true'] {
      cursor: wait;
    }
  }
}

.decision-tiles__heading,
.decision-tiles__warning {
  grid-column: 1 / -1;
}

.decision-tiles__warning {
  margin: 0;
}

.decision-tiles__player-color {
  display: inline-block;
  width: 0.7em;
  height: 0.7em;
  margin-inline-end: 0.25em;
  border: 1px solid #dce8ee85;
  border-radius: 50%;
}

.decision-tiles__choice {
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

  strong {
    color: #b2e6ee;
    font-size: clamp(1.35rem, 4vw, 1.8rem);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .decision-tiles__price,
  .decision-tiles__owner {
    color: #ffe3a4;
  }
}

.decision-tiles__description,
.decision-tiles__details,
.decision-tiles__owner {
  font-size: 0.82rem;
}

.decision-tiles__description {
  color: #c8d8e0;
  font-weight: 500;
}

.decision-tiles__details {
  color: #b2e6ee;
}

.decision-tiles__choice--secondary {
  grid-column: 1 / -1;
  min-height: 44px;
  font-size: 0.95rem;
}

@media (min-width: 680px) {
  .decision-tiles--many {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

:global(#player-home .mission-panel--decision:has(.decision-tiles--with-close) .mission-panel__decision-heading) {
  display: none;
}
</style>
