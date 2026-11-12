<template>
  <div v-if="cards.length" class="mission-hand">
    <Transition name="mission-preview">
      <div v-if="selectedCard" class="mission-hand__preview" @keydown.esc.stop="closePreview">
        <button ref="closeButton" type="button" :aria-label="$t('Close')" @click="closePreview">×</button>
        <Card :key="selectedCard.name" :card="selectedCard" autoTall />
        <a href="#actions" @click.prevent="openActions" v-i18n>Actions</a>
      </div>
    </Transition>
    <TransitionGroup name="mission-draw" tag="div" class="mission-hand__strip" :aria-label="$t('Cards In Hand')" @keydown.esc.stop="closePreview">
      <div v-for="{card, cost, description} in previews" :key="card.name" class="mission-hand__slot" :class="{'mission-card-available': playableCards?.has(card.name)}">
        <button
          type="button"
          class="mission-hand__card"
          :aria-expanded="selected === card.name"
          @click="inspectCard(card.name, $event)">
          <span class="mission-hand__title">
            <strong v-if="cost !== undefined">
              <ResourceIcon :resource="Resource.MEGACREDITS" />{{ cost }}
            </strong>
            <span>{{ $t(card.name) }}</span>
          </span>
        </button>
        <div class="mission-hand__thumbnail" aria-hidden="true" inert>
          <Card :card="card" />
        </div>
        <span v-if="playableCards?.has(card.name)" class="mission-hand__effect mission-card-status" v-i18n>Playable now</span>
        <span v-else-if="description" class="mission-hand__effect">{{ $t(description) }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import {computed, nextTick, ref} from 'vue';
import Card from '@/client/components/card/Card.vue';
import {getCardOrThrow} from '@/client/cards/ClientCardManifest';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {SoundManager} from '@/client/utils/SoundManager';
import {getPreferences} from '@/client/utils/PreferencesManager';
import {Resource} from '@/common/Resource';
import ResourceIcon from '@/client/components/common/ResourceIcon.vue';

const props = defineProps<{cards: ReadonlyArray<CardModel>, playableCards?: ReadonlySet<CardName>}>();
const emit = defineEmits<{openActions: []}>();
const selected = ref<CardName>();
const closeButton = ref<HTMLButtonElement>();
const selectedCard = computed(() => props.cards.find((card) => card.name === selected.value));
let opener: HTMLButtonElement | undefined;

async function inspectCard(name: CardName, event: MouseEvent) {
  if (selected.value === name) {
    closePreview();
    return;
  }
  if (event.currentTarget instanceof HTMLButtonElement) {
    opener = event.currentTarget;
  }
  selected.value = name;
  SoundManager.mission('card');
  await nextTick();
  closeButton.value?.focus();
}

function closePreview() {
  selected.value = undefined;
  opener?.focus();
  opener = undefined;
}

function openActions() {
  selected.value = undefined;
  opener = undefined;
  emit('openActions');
}

const previews = computed(() => props.cards.map((card) => {
  const definition = getCardOrThrow(card.name);
  const description = definition.metadata.description;
  const printedCost = definition.cost;
  return {
    card,
    cost: printedCost === undefined || getPreferences().hide_discount_on_cards ? printedCost : card.calculatedCost ?? printedCost,
    description: typeof description === 'string' ? description : description?.text,
  };
}));
</script>
