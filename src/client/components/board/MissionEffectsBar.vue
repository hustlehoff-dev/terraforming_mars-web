<template>
  <div v-if="effectCards.length" class="mission-effects" :aria-label="$t('Card effects')" role="group">
    <button type="button" class="mission-effects__title" :title="$t('Show all played cards')" @click="emit('openAll')">
      {{ $t('Effects') }} · {{ effectCards.length }} <span aria-hidden="true">⤢</span>
    </button>
    <div class="mission-effects__list">
      <button v-for="card in effectCards" :key="card.name" type="button" class="mission-effects__card"
        :class="{'mission-effects__card--lit': lit.has(card.name), 'mission-effects__card--usable': usable?.has(card.name)}"
        :title="usable?.has(card.name) ? $t(card.name) + ' · ' + $t('Use action') : $t(card.name)"
        @click="usable?.has(card.name) && emit('use', card)"
        @pointerenter="hovered = card" @pointerleave="hovered = undefined" @focus="hovered = card" @blur="hovered = undefined">
        <Card :card="card" inert />
      </button>
    </div>
    <div v-if="hovered" class="mission-effects__preview" aria-hidden="true">
      <Card :card="hovered" autoTall />
      <span v-if="usable?.has(hovered.name)" class="mission-effects__hint" v-i18n>Click to use the action</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import {computed, ref} from 'vue';
import Card from '@/client/components/card/Card.vue';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {getCard} from '@/client/cards/ClientCardManifest';

/*
 * The player's played cards with an ongoing effect ("When any city tile is placed..."), small,
 * in the dock. Hover shows the card; a card glows for a moment when its effect gives something.
 */
const props = defineProps<{tableau: ReadonlyArray<CardModel>, lit: ReadonlySet<CardName>, usable?: ReadonlySet<CardName>}>();
const emit = defineEmits<{use: [card: CardModel], openAll: []}>();
const hovered = ref<CardModel>();

const effectCache = new Map<CardName, boolean>();
function hasEffect(name: CardName): boolean {
  let known = effectCache.get(name);
  if (known === undefined) {
    known = JSON.stringify(getCard(name)?.metadata.renderData ?? '').includes('"is":"effect"');
    effectCache.set(name, known);
  }
  return known;
}

const effectCards = computed(() => props.tableau.filter((card) => hasEffect(card.name)));
</script>

<style lang="less">
// Same tile as "Played Cards" (height, frame, title), between it and the hand.
.mission-effects {
  position: relative;
  display: grid;
  height: calc(352px * var(--mission-card-scale, 0.6));
  grid-template-rows: auto minmax(0, 1fr);
  gap: 6px;
  padding: 8px;
  border: 1px solid #6f8c98;
  border-radius: 10px;
  background: linear-gradient(#18293a, #0b141c);
  pointer-events: auto;
}

.mission-effects__title {
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  color: #eef6f8;
  font-size: 0.72rem;
  font-weight: 800;
  text-align: center;
  text-transform: uppercase;
}

.mission-effects__list {
  display: grid;
  grid-template-columns: repeat(2, 72px);
  align-content: start;
  gap: 6px;
  overflow-y: auto;
  overscroll-behavior: contain;
  // A visible scrollbar and whole rows per wheel step: easy to scroll.
  padding-right: 4px;
  scroll-snap-type: y mandatory;
  scrollbar-width: thin;
  scrollbar-color: #8fb3c0 #0b141c;

  > * {
    scroll-snap-align: start;
  }
}

.mission-effects__card {
  position: relative;
  width: 72px;
  height: 50px;
  overflow: hidden;
  padding: 0;
  border: 1px solid #6f8c98;
  border-radius: 6px;
  background: #0b141c;
  cursor: help;

  &--usable {
    border-color: #3c9be6;
    box-shadow: 0 0 10px #3c9be6aa;
    cursor: pointer;
  }

  .card-container {
    zoom: 0.3;
    margin: 0 !important;
  }

  &:hover,
  &:focus-visible {
    outline: none;
    border-color: #b4ffeb;
  }

  &--lit {
    border-color: #e2c27f;
    box-shadow: 0 0 12px #e2c27f;
    animation: mission-effects-lit 0.6s ease-in-out 4 alternate;
  }
}

@keyframes mission-effects-lit {
  to { box-shadow: 0 0 22px #ffe9bd; }
}

.mission-effects__preview {
  position: absolute;
  z-index: 30;
  bottom: calc(100% + 10px);
  left: 0;
  pointer-events: none;

  .card-container {
    zoom: 1.15;
    margin: 0 !important;
    box-shadow: 0 16px 40px #000c;
  }
}

.mission-effects__hint {
  display: block;
  margin-top: 8px;
  padding: 6px 10px;
  border: 1px solid #3c9be6;
  border-radius: 8px;
  background: #0b141cf0;
  color: #cfe8ff;
  font-size: 0.8rem;
  font-weight: 800;
  text-align: center;
  text-transform: uppercase;
}
</style>
