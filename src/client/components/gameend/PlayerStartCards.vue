<template>
  <div v-if="cards.length" class="player-start-cards" :aria-label="$t('Played cards')">
    <button v-for="card in cards" :key="card.name" type="button" class="player-start-cards__card"
      :title="$t(card.name)" :aria-label="$t('View card') + ': ' + $t(card.name)" @click="zoomCard(card, true)">
      <Card :card="card" autoTall inert aria-hidden="true" />
    </button>
  </div>
</template>

<script setup lang="ts">
import {computed} from 'vue';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {CardType} from '@/common/cards/CardType';
import {getCardsByType} from '@/client/utils/CardUtils';
import Card from '@/client/components/card/Card.vue';
import {zoomCard} from '@/client/components/board/cardZoom';

const props = defineProps<{player: PublicPlayerModel}>();
// Only the played tableau: discarded offers and unplayed cards are never shown here.
const cards = computed(() => [
  ...getCardsByType(props.player.tableau, [CardType.CORPORATION]),
  ...getCardsByType(props.player.tableau, [CardType.PRELUDE]),
]);
</script>

<style scoped lang="less">
.player-start-cards {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px;
}

.player-start-cards__card {
  display: block;
  flex: none;
  padding: 6px 3px 3px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  cursor: zoom-in;

  :deep(.card-container) {
    width: 240px;
    margin: 0;
    zoom: 0.32;
    pointer-events: none;
  }

  &:hover,
  &:focus-visible {
    outline: 2px solid #ba7836;
    outline-offset: 1px;
  }
}
</style>
