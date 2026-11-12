<template>
  <div v-if="cards.length" class="mission-hand">
    <Transition name="mission-preview">
      <div v-if="selectedCard" class="mission-hand__preview" @keydown.esc="selected = undefined">
        <button type="button" :aria-label="$t('Close')" @click="selected = undefined">×</button>
        <Card :key="selectedCard.name" :card="selectedCard" />
        <a href="#actions" @click="selected = undefined" v-i18n>Actions</a>
      </div>
    </Transition>
    <TransitionGroup name="mission-draw" tag="div" class="mission-hand__strip" :aria-label="$t('Cards In Hand')" @keydown.esc="selected = undefined">
      <button
        v-for="card in previews"
        :key="card.name"
        type="button"
        class="mission-hand__card"
        :aria-expanded="selected === card.name"
        @click="inspectCard(card.name)">
        <span class="mission-hand__title">
          <strong v-if="card.cost !== undefined">{{ card.cost }}</strong>
          <span>{{ $t(card.name) }}</span>
        </span>
        <span class="mission-hand__art" :class="'mission-hand__art--' + card.art" aria-hidden="true"></span>
        <span v-if="card.description" class="mission-hand__effect">{{ $t(card.description) }}</span>
      </button>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import {computed, ref} from 'vue';
import Card from '@/client/components/card/Card.vue';
import {getCardOrThrow} from '@/client/cards/ClientCardManifest';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {SoundManager} from '@/client/utils/SoundManager';

const props = defineProps<{cards: ReadonlyArray<CardModel>}>();
const selected = ref<CardName>();
const selectedCard = computed(() => props.cards.find((card) => card.name === selected.value));

function inspectCard(name: CardName) {
  selected.value = selected.value === name ? undefined : name;
  if (selected.value !== undefined) {
    SoundManager.mission('card');
  }
}
const previews = computed(() => props.cards.map((card) => {
  const definition = getCardOrThrow(card.name);
  const tags = definition.tags;
  let art = 'research';
  if (tags.includes(Tag.PLANT) || tags.includes(Tag.MICROBE) || tags.includes(Tag.ANIMAL)) {
    art = 'greenhouse';
  } else if (tags.includes(Tag.POWER)) {
    art = 'power';
  } else if (!tags.includes(Tag.SPACE) && (tags.includes(Tag.BUILDING) || tags.includes(Tag.CITY))) {
    art = 'city';
  }
  const description = definition.metadata.description;
  return {
    name: card.name,
    cost: card.calculatedCost ?? definition.cost,
    description: typeof description === 'string' ? description : description?.text,
    art,
  };
}));
</script>
