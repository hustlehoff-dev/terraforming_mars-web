<template>
  <aside v-if="rivals.length > 0" class="rival-panel" :aria-label="$t('Other players')">
    <ul class="rival-panel__list">
      <li v-for="rival in visibleRivals" :key="rival.color">
        <RivalTile :player="rival" :active="rival.color === activeColor" @click="open(rival.color)" />
      </li>
    </ul>
    <div v-if="extraRivals.length > 0" class="rival-panel__overflow">
      <span v-if="extraActiveRival" class="rival-panel__overflow-turn" role="status">
        <span class="rival-tile__name" :title="extraActiveRival.name">{{ extraActiveRival.name }}</span>
        <span class="rival-tile__status" v-i18n>Now playing</span>
      </span>
      <button
        type="button"
        class="rival-panel__more"
        aria-haspopup="dialog"
        :aria-label="`${$t('Show more players')} (+${extraRivals.length})`"
        @click="open()">
        +{{ extraRivals.length }}
      </button>
    </div>

    <dialog ref="dialog" class="rival-panel__dialog" aria-labelledby="rival-panel-title" @close="selectedColor = undefined">
      <header class="rival-panel__dialog-header">
        <h2 id="rival-panel-title">
          <template v-if="selectedRival">{{ selectedRival.name }} · <span v-i18n>Played Cards</span></template>
          <span v-else v-i18n>Other players</span>
        </h2>
        <form method="dialog">
          <button type="submit" class="rival-panel__close" autofocus v-i18n>Close</button>
        </form>
      </header>
      <template v-if="selectedRival">
        <div v-if="selectedRival.tableau.length > 0" class="rival-panel__cards">
          <div v-for="card in selectedRival.tableau" :key="card.name" class="cardbox">
            <Card :card="card" :actionUsed="isCardActivated(card, selectedRival)" :cubeColor="selectedRival.color" autoTall />
          </div>
        </div>
        <p v-else class="rival-panel__empty" v-i18n>No played cards yet.</p>
      </template>
      <ul v-else class="rival-panel__list rival-panel__extra">
        <li v-for="rival in extraRivals" :key="rival.color">
          <RivalTile :player="rival" :active="rival.color === activeColor" @click="open(rival.color)" />
        </li>
      </ul>
    </dialog>
  </aside>
</template>

<script setup lang="ts">
import {computed, nextTick, ref} from 'vue';
import dialogPolyfill from 'dialog-polyfill';
import Card from '@/client/components/card/Card.vue';
import {hasShowModal, showModal} from '@/client/components/HTMLDialogElementCompatibility';
import RivalTile from '@/client/components/overview/RivalTile.vue';
import {isCardActivated} from '@/client/utils/CardUtils';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';

const props = defineProps<{
  players: ReadonlyArray<PublicPlayerModel>;
  playerColor: Color;
  activeColor?: Color;
}>();

const visibleCount = 4;
const dialog = ref<HTMLDialogElement>();
const selectedColor = ref<Color>();
const rivals = computed(() => props.players.filter((player) => player.color !== props.playerColor));
const visibleRivals = computed(() => rivals.value.slice(0, visibleCount));
const extraRivals = computed(() => rivals.value.slice(visibleCount));
const extraActiveRival = computed(() => extraRivals.value.find((rival) => rival.color === props.activeColor));
const selectedRival = computed(() => rivals.value.find((player) => player.color === selectedColor.value));

async function open(color?: Color) {
  selectedColor.value = color;
  await nextTick();
  const element = dialog.value;
  if (element === undefined) {
    return;
  }
  if (element.open) {
    element.querySelector<HTMLButtonElement>('.rival-panel__close')?.focus();
  } else {
    if (!hasShowModal(element)) {
      dialogPolyfill.registerDialog(element);
    }
    showModal(element);
  }
}
</script>
