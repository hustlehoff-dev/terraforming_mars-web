<template>
  <aside class="played-card-history" :aria-label="$t('Card play history')" @keydown.esc.stop="clearPreview">
    <button
      type="button"
      class="played-card-history__toggle"
      aria-controls="played-card-history-list"
      :aria-expanded="expanded"
      @click="toggleList">
      <span v-i18n>Card play history</span>
    </button>
    <div class="played-card-history__notice" aria-live="polite">
      <button v-if="justPlayed" type="button" @click="openRecentPlay(justPlayed.key)">
        <span v-i18n>Card played</span>
        <strong>{{ $t(justPlayed.card) }}</strong>
      </button>
    </div>
    <div class="played-card-history__body" :class="{'played-card-history__body--expanded': expanded}">
      <h2 v-i18n>Card play history</h2>
      <ol id="played-card-history-list" ref="list" class="played-card-history__list">
        <li v-for="play in plays" :key="play.key">
          <button
            type="button"
            class="played-card-history__entry"
            :class="{'played-card-history__entry--new': newKeys.has(play.key), 'played-card-history__entry--previewed': previewKey === play.key}"
            :aria-expanded="previewKey === play.key"
            @pointerenter="pointedKey = play.key"
            @pointerleave="pointedKey = undefined"
            @focus="focusedKey = play.key"
            @blur="focusedKey = undefined"
            @click="pinPreview(play.key)">
            <strong>{{ $t(play.card) }}</strong>
            <span>{{ playerNames.get(play.player) ?? play.player }}</span>
          </button>
        </li>
      </ol>
      <p v-if="loaded && plays.length === 0" class="played-card-history__empty" v-i18n>No cards played yet</p>
    </div>
    <div
      v-if="previewCard"
      class="played-card-history__preview"
      :class="{'played-card-history__preview--pinned': pinnedKey === previewKey}">
      <button v-if="pinnedKey === previewKey" type="button" :aria-label="$t('Close')" @click="closePreview">×</button>
      <Card :key="previewCard.name" :card="previewCard" autoTall />
    </div>
  </aside>
</template>

<script setup lang="ts">
import {computed, nextTick, onBeforeUnmount, ref, shallowRef, watch} from 'vue';
import Card from '@/client/components/card/Card.vue';
import {getCard} from '@/client/cards/ClientCardManifest';
import {paths} from '@/common/app/paths';
import {CardModel} from '@/common/models/CardModel';
import {PlayedCardLogModel} from '@/common/models/PlayedCardLogModel';
import {ViewModel} from '@/common/models/PlayerModel';

const props = defineProps<{viewModel: ViewModel}>();
const list = ref<HTMLOListElement>();
const expanded = ref(false);
const loaded = ref(false);
const plays = shallowRef<Array<PlayedCardLogModel>>([]);
const newKeys = shallowRef<ReadonlySet<string>>(new Set());
const pointedKey = ref<string>();
const focusedKey = ref<string>();
const pinnedKey = ref<string>();
const previewKey = computed(() => pointedKey.value ?? focusedKey.value ?? pinnedKey.value);
const justPlayed = computed(() => plays.value.find((play) => play.player === props.viewModel.color && newKeys.value.has(play.key)));
const playerNames = computed(() => new Map(props.viewModel.players.map((player) => [player.color, player.name])));
const previewCard = computed<CardModel | undefined>(() => {
  const play = plays.value.find((entry) => entry.key === previewKey.value);
  if (play === undefined) {
    return undefined;
  }
  const player = props.viewModel.players.find((candidate) => candidate.color === play.player);
  return player?.tableau.find((card) => card.name === play.card) ?? {name: play.card};
});

let request: AbortController | undefined;
let highlightTimer: number | undefined;

watch(
  [() => props.viewModel.id, () => props.viewModel.runId, () => props.viewModel.game.gameAge, () => props.viewModel.game.step, () => props.viewModel.game.undoCount],
  ([id, runId], previous) => {
    if (id !== previous[0] || runId !== previous[1]) {
      loaded.value = false;
      plays.value = [];
      newKeys.value = new Set();
      clearPreview();
    }
    void refresh();
  },
  {immediate: true});

onBeforeUnmount(() => {
  request?.abort();
  window.clearTimeout(highlightTimer);
});

async function refresh() {
  request?.abort();
  const currentRequest = new AbortController();
  request = currentRequest;
  const query = new URLSearchParams({id: props.viewModel.id, view: 'played-cards'});
  try {
    const response = await fetch(`${paths.API_GAME_LOGS}?${query}`, {signal: currentRequest.signal});
    if (!response.ok) {
      return;
    }
    const result: Array<PlayedCardLogModel> = await response.json();
    if (currentRequest.signal.aborted) {
      return;
    }
    const nextPlays = result.filter((play) => getCard(play.card) !== undefined);
    const previousKeys = new Set(plays.value.map((play) => play.key));
    const addedKeys = nextPlays.filter((play) => !previousKeys.has(play.key)).map((play) => play.key);
    const scroller = list.value;
    const oldTop = scroller?.scrollTop ?? 0;
    const oldHeight = scroller?.scrollHeight ?? 0;
    if (loaded.value && addedKeys.length > 0) {
      newKeys.value = new Set(addedKeys);
      window.clearTimeout(highlightTimer);
      highlightTimer = window.setTimeout(() => {
        newKeys.value = new Set();
      }, 2200);
    }
    loaded.value = true;
    plays.value = nextPlays;
    if (previewKey.value && !nextPlays.some((play) => play.key === previewKey.value)) {
      clearPreview();
    }
    if (scroller && oldTop > 0) {
      await nextTick();
      if (!currentRequest.signal.aborted && scroller.scrollTop === oldTop) {
        scroller.scrollTop = oldTop + scroller.scrollHeight - oldHeight;
      }
    }
  } catch (error) {
    if (!currentRequest.signal.aborted) {
      console.error('Unable to load card play history', error);
    }
  }
}

function clearPreview() {
  pinnedKey.value = undefined;
  pointedKey.value = undefined;
  focusedKey.value = undefined;
}

function closePreview() {
  list.value?.querySelector<HTMLButtonElement>('[aria-expanded="true"]')?.focus();
  clearPreview();
}

function pinPreview(key: string) {
  if (pinnedKey.value === key) {
    clearPreview();
  } else {
    pinnedKey.value = key;
  }
}

function toggleList() {
  expanded.value = !expanded.value;
  if (!expanded.value) {
    clearPreview();
  }
}

function openRecentPlay(key: string) {
  expanded.value = true;
  clearPreview();
  pinnedKey.value = key;
}
</script>

<style scoped lang="less">
.played-card-history {
  position: absolute;
  z-index: 9;
  inset-block-start: 32%;
  inset-inline-start: clamp(10px, 2vw, 30px);
  width: clamp(96px, 12vw, 168px);
  color: #e7e9e8;
  font-size: 0.64rem;
}

.played-card-history__toggle {
  display: none;
}

.played-card-history__notice {
  position: absolute;
  inset-block-start: 0;
  inset-inline-start: calc(100% + 6px);
  min-width: 7rem;
  pointer-events: none;

  button {
    display: grid;
    width: 100%;
    gap: 0.15rem;
    padding: 0.35rem 0.45rem;
    border: 1px solid #e6ae6d8c;
    background: #453420;
    color: #ffe2bc;
    font: inherit;
    text-align: start;
    pointer-events: auto;
  }
}

.played-card-history__body {
  border: 1px solid #9fb0ba47;
  background: var(--mission-glass, #111a22ed);

  h2 {
    margin: 0;
    padding: 0.4rem 0.45rem;
    border-bottom: 1px solid #9fb0ba47;
    color: #dfc39e;
    font-size: inherit;
    font-weight: 650;
  }
}

.played-card-history__list {
  max-height: min(30svh, 16rem);
  overflow-y: auto;
  margin: 0;
  padding: 0;
  list-style: none;
  overscroll-behavior: contain;
  overflow-anchor: none;
  scrollbar-width: thin;

  li {
    margin: 0;
  }
}

.played-card-history__entry {
  display: grid;
  width: 100%;
  gap: 0.14rem;
  padding: 0.35rem 0.45rem;
  border: 0;
  border-bottom: 1px solid #9fb0ba26;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;
  overflow-wrap: anywhere;

  span {
    color: #bdc8ce;
    font-size: 0.88em;
  }

  &:focus-visible,
  &--previewed {
    outline: 1px solid #b8e1ea;
    outline-offset: -1px;
    background: #2e505c;
  }

  &--new {
    box-shadow: inset 3px 0 #f2ca8f;
    animation: history-card-played 1.2s ease-out;
  }
}

.played-card-history__empty {
  margin: 0;
  padding: 0.4rem 0.45rem;
  color: #bdc8ce;
}

.played-card-history__preview {
  position: absolute;
  inset-block-start: 0;
  inset-inline-start: calc(100% + 6px);
  max-height: min(55svh, 24rem);
  overflow: auto;
  padding: 0.25rem;
  border: 1px solid #b8e1ea;
  background: #111a22;
  pointer-events: none;
  overscroll-behavior: contain;

  &--pinned {
    pointer-events: auto;
  }

  button {
    display: block;
    margin-inline-start: auto;
    border: 1px solid #9fb0ba47;
    background: #111a22;
    color: inherit;
  }

  :deep(.card-container) {
    margin: 0;
    zoom: 0.8;
  }
}

@keyframes history-card-played {
  from { background-color: #745433; }
  to { background-color: transparent; }
}

@media (prefers-reduced-motion: reduce) {
  .played-card-history__entry--new {
    animation: none;
  }
}

@media (max-width: 760px) {
  .played-card-history {
    inset-block-start: 145px;
    inset-inline-start: 8px;
    width: 105px;
  }

  .played-card-history__toggle {
    display: block;
    width: 100%;
    padding: 0.25rem 0.35rem;
    border: 1px solid #9fb0ba47;
    background: var(--mission-glass, #111a22ed);
    color: inherit;
    font: inherit;
    text-align: start;
  }

  .played-card-history__body {
    display: none;

    &--expanded {
      display: block;
    }

    h2 {
      display: none;
    }
  }

  .played-card-history__preview :deep(.card-container) {
    zoom: 0.68;
  }
}
</style>
