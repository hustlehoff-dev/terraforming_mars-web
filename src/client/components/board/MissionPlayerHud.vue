<template>
  <div class="mission-player-hud">
    <div class="mission-player-hud__corporations">
      <button
        v-for="card in corporations"
        :key="card.name"
        type="button"
        :class="{'mission-card-available': actionCards.has(card.name)}"
        aria-haspopup="dialog"
        :aria-label="$t(card.name)"
        @click="openCorporation(card)">
        <Card :card="card" inert aria-hidden="true" />
        <span class="mission-player-hud__corp-art" aria-hidden="true" inert></span>
        <span v-if="actionCards.has(card.name)" class="mission-player-hud__corp-status" aria-hidden="true">●</span>
      </button>
    </div>
    <ul class="mission-player-hud__stocks" :aria-label="$t('Resources')">
      <li v-for="resource in ALL_RESOURCES" :key="resource">
        <ResourceIcon :resource="resource" />
        <strong :key="player[resource]" class="mission-status__value">{{ player[resource] }}</strong>
        <span class="mission-player-hud__production" :aria-label="$t(resource === 'megacredits' ? 'Income per generation' : 'Production') + ' ' + formatProduction(productionFor(resource))">({{ formatProduction(productionFor(resource)) }})</span>
      </li>
    </ul>
    <MissionHand :cards="cards" :playableCards="playableCards" />
    <dialog ref="dialog" class="mission-player-hud__dialog" :aria-label="selected && $t(selected.name)" @close="selected = undefined">
      <form method="dialog"><button type="submit" autofocus v-i18n>Close</button></form>
      <Card v-if="selected" :card="selected" autoTall />
    </dialog>
  </div>
</template>

<script setup lang="ts">
import {computed, nextTick, onMounted, ref} from 'vue';
import dialogPolyfill from 'dialog-polyfill';
import {hasShowModal, showModal} from '@/client/components/HTMLDialogElementCompatibility';
import MissionHand from '@/client/components/board/MissionHand.vue';
import Card from '@/client/components/card/Card.vue';
import ResourceIcon from '@/client/components/common/ResourceIcon.vue';
import {getCardsByType} from '@/client/utils/CardUtils';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {CardModel} from '@/common/models/CardModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {ALL_RESOURCES} from '@/common/Resource';

const props = defineProps<{
  player: PublicPlayerModel;
  cards: ReadonlyArray<CardModel>;
  playableCards: ReadonlySet<CardName>;
  actionCards: ReadonlySet<CardName>;
}>();
const corporations = computed(() => getCardsByType(props.player.tableau, [CardType.CORPORATION]));
const dialog = ref<HTMLDialogElement>();
const selected = ref<CardModel>();

function productionFor(resource: typeof ALL_RESOURCES[number]): number {
  switch (resource) {
  case 'megacredits': return props.player.terraformRating + props.player.megacreditProduction;
  case 'steel': return props.player.steelProduction;
  case 'titanium': return props.player.titaniumProduction;
  case 'plants': return props.player.plantProduction;
  case 'energy': return props.player.energyProduction;
  case 'heat': return props.player.heatProduction;
  }
}

function formatProduction(value: number): string {
  return `${value >= 0 ? '+' : ''}${value}`;
}

onMounted(() => {
  if (dialog.value && !hasShowModal(dialog.value)) {
    dialogPolyfill.registerDialog(dialog.value);
  }
});

async function openCorporation(card: CardModel) {
  selected.value = card;
  await nextTick();
  if (dialog.value) {
    showModal(dialog.value);
  }
}
</script>
