<template>
  <aside class="activity-feed" :aria-label="$t('Activity feed')" @keydown.esc.stop="dismissPreview">
    <button
      type="button"
      class="activity-feed__toggle"
      :aria-controls="listId"
      :aria-expanded="expanded"
      @click="toggleFeed"
      v-i18n>Activity feed</button>
    <div class="activity-feed__body" :class="{'activity-feed__body--expanded': expanded}">
      <div class="activity-feed__header">
        <h2 v-i18n>Activity feed</h2>
        <button v-if="scrolled" type="button" @click="showLatest" v-i18n>Latest activity</button>
      </div>
      <ol :id="listId" ref="list" class="activity-feed__list" tabindex="0" @scroll.passive="updateScroll">
        <li v-for="entry in entries" :key="entry.key">
          <component
            :is="entry.card || entry.space ? 'button' : 'div'"
            :type="entry.card || entry.space ? 'button' : undefined"
            class="activity-feed__entry"
            :class="{'activity-feed__entry--new': newKeys.has(entry.key)}"
            :title="entry.text"
            :aria-label="entry.card || entry.space ? entry.text : undefined"
            :aria-expanded="entry.card ? previewKey === entry.key : undefined"
            @click="inspect(entry)">
            <span v-if="entry.player" class="activity-feed__marker" :class="'player_bg_color_' + entry.player" aria-hidden="true"></span>
            <span class="activity-feed__line">
              <strong v-if="entry.actor">{{ entry.actor + ' ' }}</strong><span>{{ entry.action }}</span><b v-if="entry.subjectText">{{ ' ' + entry.subjectText }}</b>
            </span>
          </component>
        </li>
      </ol>
      <p v-if="loaded && entries.length === 0" class="activity-feed__empty" v-i18n>No activity yet</p>
    </div>
    <div v-if="previewCard" class="activity-feed__preview">
      <button type="button" :aria-label="$t('Close')" @click="dismissPreview">×</button>
      <Card :key="previewCard.name" :card="previewCard" autoTall />
    </div>
  </aside>
</template>

<script setup lang="ts">
import {computed, nextTick, onBeforeUnmount, ref, shallowRef, useId, watch} from 'vue';
import Card from '@/client/components/card/Card.vue';
import {getCard} from '@/client/cards/ClientCardManifest';
import {translateText} from '@/client/directives/i18n';
import {paths} from '@/common/app/paths';
import {CardModel} from '@/common/models/CardModel';
import {GameActivityKind, GameActivityModel} from '@/common/models/GameActivityModel';
import {ViewModel} from '@/common/models/PlayerModel';
import {SpaceId} from '@/common/Types';

const labels: Record<GameActivityKind, string> = {
  played: 'played',
  action: 'used action',
  project: 'used project',
  placed: 'placed',
  removed: 'removed',
  milestone: 'claimed milestone',
  award: 'funded award',
  colony: 'colonized',
  trade: 'traded with',
  temperature: 'raised temperature',
  oxygen: 'raised oxygen',
  venus: 'raised Venus scale',
  passed: 'passed',
  ended: 'ended turn',
  generation: 'Generation',
};

const props = defineProps<{viewModel: ViewModel}>();
const emit = defineEmits<{spaceClicked: [space: SpaceId]}>();
const listId = useId();
const list = ref<HTMLOListElement>();
const expanded = ref(false);
const loaded = ref(false);
const scrolled = ref(false);
const events = shallowRef<Array<GameActivityModel>>([]);
const newKeys = shallowRef<ReadonlySet<string>>(new Set());
const previewKey = ref<string>();
const players = computed(() => new Map(props.viewModel.players.map((player) => [player.color, player])));
const entries = computed(() => events.value.map((event) => {
  const actor = event.player ? players.value.get(event.player)?.name ?? event.player : undefined;
  const action = translateText(labels[event.kind]);
  const subject = event.card?.split(':')[0] ?? event.subject;
  const subjectText = subject && translateText(subject);
  return {...event, actor, action, subjectText, text: [actor, action, subjectText].filter(Boolean).join(' ')};
}));
const previewCard = computed<CardModel | undefined>(() => {
  const event = events.value.find((entry) => entry.key === previewKey.value);
  if (!event?.card || !getCard(event.card)) {
    return undefined;
  }
  return (event.player && players.value.get(event.player)?.tableau.find((card) => card.name === event.card)) || {name: event.card};
});

let request: AbortController | undefined;
let highlightTimer: number | undefined;

watch(
  [() => props.viewModel.id, () => props.viewModel.runId, () => props.viewModel.game.gameAge, () => props.viewModel.game.step, () => props.viewModel.game.undoCount],
  ([id, runId], previous) => {
    if (id !== previous[0] || runId !== previous[1]) {
      loaded.value = false;
      events.value = [];
      newKeys.value = new Set();
      closePreview();
      jumpToLatest();
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
  const query = new URLSearchParams({id: props.viewModel.id, view: 'activity'});
  try {
    const response = await fetch(`${paths.API_GAME_LOGS}?${query}`, {signal: currentRequest.signal});
    if (!response.ok) {
      return;
    }
    const result: Array<GameActivityModel> = await response.json();
    if (currentRequest.signal.aborted) {
      return;
    }
    const previousKeys = new Set(events.value.map((event) => event.key));
    const addedKeys = result.filter((event) => !previousKeys.has(event.key)).map((event) => event.key);
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
    events.value = result;
    if (previewKey.value && !result.some((event) => event.key === previewKey.value)) {
      closePreview();
    }
    if (scroller && oldTop > 0) {
      await nextTick();
      if (!currentRequest.signal.aborted && scroller.scrollTop === oldTop) {
        scroller.scrollTop = oldTop + scroller.scrollHeight - oldHeight;
        updateScroll();
      }
    }
  } catch (error) {
    if (!currentRequest.signal.aborted) {
      console.error('Unable to load game activity', error);
    }
  }
}

function closePreview() {
  previewKey.value = undefined;
}

function dismissPreview() {
  list.value?.querySelector<HTMLButtonElement>('[aria-expanded="true"]')?.focus({preventScroll: true});
  closePreview();
}

function toggleFeed() {
  expanded.value = !expanded.value;
  closePreview();
}

function inspect(entry: GameActivityModel) {
  if (entry.card) {
    previewKey.value = previewKey.value === entry.key ? undefined : entry.key;
  } else if (entry.space) {
    closePreview();
    expanded.value = false;
    emit('spaceClicked', entry.space);
  }
}

function updateScroll() {
  scrolled.value = (list.value?.scrollTop ?? 0) > 4;
}

function jumpToLatest() {
  if (list.value) {
    list.value.scrollTop = 0;
  }
  updateScroll();
}

function showLatest() {
  list.value?.focus({preventScroll: true});
  jumpToLatest();
}
</script>

<style scoped lang="less">
.activity-feed {
  position: absolute;
  z-index: 9;
  inset-block-start: 31%;
  inset-inline-start: clamp(10px, 2vw, 30px);
  width: clamp(155px, 19vw, 266px);
  color: #f3eee7;
  font-size: 0.61rem;
}

.activity-feed__toggle {
  display: none;
}

.activity-feed__header {
  display: flex;
  min-height: 27px;
  align-items: center;
  justify-content: space-between;
  gap: 5px;
  padding-inline: 6px;

  h2 {
    margin: 0;
    color: #dfc39e;
    font: inherit;
    font-weight: 700;
  }

  button {
    padding: 1px 4px;
    border: 1px solid #8fa3ad59;
    background: #111a22;
    color: #a2eeff;
    font: inherit;
    cursor: pointer;
  }
}

.activity-feed__list {
  display: grid;
  max-height: min(26dvh, 154px);
  gap: 3px;
  overflow-y: auto;
  margin: 0;
  padding: 0 3px 0 0;
  list-style: none;
  overscroll-behavior: contain;
  overflow-anchor: none;
  scrollbar-width: thin;
  scrollbar-color: #8fa3ad80 transparent;

  li {
    min-width: 0;
    margin: 0;
  }
}

.activity-feed__entry {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 5px;
  padding: 4px 6px;
  border: 1px solid #9fb0ba26;
  border-radius: 2px;
  background: linear-gradient(90deg, #101a23f2, #101a23bf);
  color: #becad0;
  font: inherit;
  line-height: 1.2;
  text-align: start;

  strong,
  b {
    color: #f3eee7;
    font-weight: 650;
  }

  &--new {
    border-inline-start-color: #f2ca8f;
  }
}

button.activity-feed__entry {
  cursor: pointer;

  &:hover,
  &:focus-visible,
  &[aria-expanded='true'] {
    border-color: #a2eeff;
  }
}

.activity-feed__marker {
  width: 6px;
  height: 6px;
  flex: 0 0 6px;
  border: 1px solid #ffffff59;
  border-radius: 1px;
}

.activity-feed__line {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.activity-feed__empty {
  margin: 0;
  padding: 4px 6px;
  color: #bdc8ce;
}

.activity-feed__preview {
  position: absolute;
  inset-block-start: 0;
  inset-inline-start: calc(100% + 6px);
  max-height: min(55dvh, 24rem);
  overflow: auto;
  padding: 4px;
  border: 1px solid #a2eeff;
  background: #111a22;
  overscroll-behavior: contain;

  button {
    display: block;
    margin-inline-start: auto;
    border: 1px solid #9fb0ba47;
    background: #111a22;
    color: inherit;
    cursor: pointer;
  }

  :deep(.card-container) {
    margin: 0;
    zoom: 0.8;
  }
}

@media (prefers-reduced-motion: no-preference) {
  .activity-feed__entry--new {
    animation: activity-arrived 1.2s ease-out;
  }
}

@keyframes activity-arrived {
  from { background-color: #745433; }
}

@media (max-width: 760px) {
  .activity-feed {
    inset-block-start: 145px;
    inset-inline-start: 8px;
    width: min(250px, calc(100vw - 16px));
  }

  .activity-feed__toggle {
    display: block;
    padding: 4px 6px;
    border: 1px solid #9fb0ba47;
    background: #111a22;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  .activity-feed__body {
    display: none;
    background: #101a23f5;

    &--expanded {
      display: block;
    }
  }

  .activity-feed__header {
    min-height: 0;
    justify-content: end;

    h2 {
      display: none;
    }
  }

  .activity-feed__preview {
    inset-block-start: calc(100% + 4px);
    inset-inline-start: 0;

    :deep(.card-container) {
      zoom: 0.68;
    }
  }
}
</style>
