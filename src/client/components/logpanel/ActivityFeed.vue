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
            :is="entry.card || entry.targetSpace || entry.deck?.length ? 'button' : 'div'"
            :type="entry.card || entry.targetSpace || entry.deck?.length ? 'button' : undefined"
            class="activity-feed__entry"
            :class="{'activity-feed__entry--new': newKeys.has(entry.key)}"
            :title="entry.text"
            :aria-label="entry.card || entry.targetSpace || entry.deck?.length ? entry.text : undefined"
            :aria-expanded="entry.deck?.length ? reveal?.key === entry.key : entry.card ? previewKey === entry.key : undefined"
            @click="inspect(entry)"
            @pointerenter="hoverEntry(entry)"
            @pointerleave="unhoverEntry(entry)"
            @focus="hoverEntry(entry)"
            @blur="unhoverEntry(entry)">
            <span v-if="entry.player" class="activity-feed__marker" :class="'player_bg_color_' + entry.player" aria-hidden="true"></span>
            <span class="activity-feed__line">
              <strong v-if="entry.actor">{{ entry.actor + ' ' }}</strong>
              <span class="activity-feed__verb">{{ entry.action + ' ' }}</span>
              <b v-if="entry.subjectText">{{ entry.subjectText }}</b>
              <span v-for="(step, index) in entry.stepLines" :key="index" class="activity-feed__reveal" v-html="'→ ' + renderIcons(step)"></span>
              <span v-if="entry.spent" class="activity-feed__units activity-feed__units--spent" v-html="renderIcons(entry.spent)"></span>
              <span v-if="entry.effects" class="activity-feed__units" v-html="renderIcons(entry.effects)"></span>
              <span v-if="entry.scienceGained !== undefined" class="activity-feed__units" v-html="renderIcons('+' + entry.scienceGained + ':cr:science:')"></span>
              <span v-for="target in entry.targetLines" :key="target.player" class="activity-feed__target">
                <span aria-hidden="true">→</span>
                <span class="activity-feed__target-name" :class="'player_bg_color_' + target.player">{{ target.name }}</span>
                <span class="activity-feed__units" v-html="renderIcons(target.effects)"></span>
              </span>
            </span>
          </component>
        </li>
      </ol>
      <p v-if="loaded && entries.length === 0" class="activity-feed__empty" v-i18n>No activity yet</p>
    </div>
    <div v-if="previewEntry?.groups.length" class="activity-feed__preview activity-feed__preview--deck" aria-hidden="true">
      <div v-for="group in previewEntry.groups" :key="group.label" class="activity-feed__group" :class="{'activity-feed__group--dim': group.dim}">
        <p>{{ group.label }}</p>
        <div class="activity-feed__group-cards">
          <template v-for="(name, index) in group.cards" :key="index">
            <Card v-if="getCard(name)" :card="{name}" />
            <strong v-else>{{ $t(name) }}</strong>
          </template>
        </div>
      </div>
    </div>
    <!-- Milestone or award: its tile, name and what it asks for. -->
    <div v-else-if="previewMa" class="activity-feed__preview" aria-hidden="true">
      <div class="activity-feed__ma">
        <img :src="previewMa.icon" alt="" @error="($event.target as HTMLImageElement).style.visibility = 'hidden'">
        <small>{{ $t(previewMa.kind) }}</small>
        <strong>{{ $t(previewMa.name) }}</strong>
        <p>{{ $t(previewMa.description) }}</p>
      </div>
    </div>
    <div v-else-if="previewCard || previewEntry?.stepLines.length" class="activity-feed__preview" aria-hidden="true">
      <p v-if="previewEntry?.stepLines.length" class="activity-feed__summary">{{ previewEntry.text }}</p>
      <Card v-if="previewCard" :key="previewCard.name" :card="previewCard" autoTall />
    </div>
  </aside>
  <ActivityCardReveal v-if="reveal?.deck?.length" :key="reveal.key" :batches="reveal.deck" :playerName="revealPlayerName" @close="closeReveal" />
</template>

<script setup lang="ts">
import {computed, nextTick, onBeforeUnmount, ref, shallowRef, useId, watch} from 'vue';
import Card from '@/client/components/card/Card.vue';
import ActivityCardReveal from './ActivityCardReveal.vue';
import {getCard} from '@/client/cards/ClientCardManifest';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {renderIcons} from '@/client/markdown/markdown';
import {zoomCard} from '@/client/components/board/cardZoom';
import {getAward, getMilestone} from '@/client/MilestoneAwardManifest';
import {AwardName} from '@/common/ma/AwardName';
import {MilestoneName} from '@/common/ma/MilestoneName';
import {paths} from '@/common/app/paths';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {deckLabels, GameActivityKind, GameActivityModel} from '@/common/models/GameActivityModel';
import {PlayedCardLogModel} from '@/common/models/PlayedCardLogModel';
import {ViewModel} from '@/common/models/PlayerModel';
import {isPlayerId, SpaceId} from '@/common/Types';

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
  bought: 'bought',
  sold: 'sold',
  fizzled: 'discarded the unplayable prelude',
  copied: 'copied the direct effect of',
  deck: 'Project deck',
};

const props = defineProps<{viewModel: ViewModel}>();
const emit = defineEmits<{
  spaceClicked: [space: SpaceId];
  triggers: [triggers: Array<{player: Color, card: CardName, effects: string}>];
  cardPlays: [cards: Array<PlayedCardLogModel>];
}>();
const listId = useId();
const list = ref<HTMLOListElement>();
const expanded = ref(false);
const loaded = ref(false);
const scrolled = ref(false);
const events = shallowRef<Array<GameActivityModel>>([]);
const newKeys = shallowRef<ReadonlySet<string>>(new Set());
const previewKey = ref<string>();
const reveal = shallowRef<GameActivityModel>();
const queuedReveals: GameActivityModel[] = [];
// A card previewed by hovering closes when the pointer leaves; one opened by a click or tap stays.
let previewPinned = false;
const players = computed(() => new Map(props.viewModel.players.map((player) => [player.color, player])));
/**
 * Consecutive project-deck events (e.g. four cards revealed and discarded one by one) read as one
 * line: their batches of the same kind are joined into a single list of cards.
 */
function mergeDeckRuns(list: ReadonlyArray<GameActivityModel>): Array<GameActivityModel> {
  const merged: Array<GameActivityModel> = [];
  for (const event of list) {
    const previous = merged[merged.length - 1];
    if (event.kind === 'deck' && previous?.kind === 'deck' && previous.player === event.player &&
      event.deck !== undefined && previous.deck !== undefined && !event.steps?.length && !previous.steps?.length) {
      const batches = [...previous.deck];
      // The list is newest first, so older cards go before the ones already in the line.
      for (const batch of [...event.deck].reverse()) {
        const same = batches.findIndex((other) => other.kind === batch.kind && other.player === batch.player);
        if (same >= 0) {
          batches[same] = {...batches[same], cards: [...batch.cards, ...batches[same].cards]};
        } else {
          batches.unshift(batch);
        }
      }
      merged[merged.length - 1] = {...previous, deck: batches};
    } else {
      merged.push(event);
    }
  }
  return merged;
}

type DeckGroup = {label: string, cards: Array<CardName>, dim?: boolean};

/** Readable groups for a deck entry: cards dealt to choose from become "Bought" and "Discarded". */
function deckGroups(event: GameActivityModel): Array<DeckGroup> {
  const batches = event.deck ?? [];
  const offered = batches.filter((batch) => batch.kind === 'offered').flatMap((batch) => batch.cards);
  const bought = batches.filter((batch) => batch.kind === 'bought').flatMap((batch) => batch.cards);
  const groups: Array<DeckGroup> = [];
  if (offered.length > 0) {
    const left = [...bought];
    const discarded = offered.filter((card) => {
      const index = left.indexOf(card);
      if (index === -1) {
        return true;
      }
      left.splice(index, 1);
      return false;
    });
    groups.push({label: translateText('Bought'), cards: bought});
    if (discarded.length > 0) {
      groups.push({label: translateText('Discarded'), cards: discarded, dim: true});
    }
  } else if (bought.length > 0) {
    groups.push({label: translateText('Bought'), cards: bought});
  }
  for (const batch of batches) {
    if (batch.kind !== 'offered' && batch.kind !== 'bought') {
      const recipient = batch.player && batch.player !== event.player ? players.value.get(batch.player)?.name : undefined;
      groups.push({label: [recipient, translateText(deckLabels[batch.kind])].filter(Boolean).join(' '), cards: [...batch.cards], dim: batch.kind === 'discarded'});
    }
  }
  return groups.filter((group) => group.cards.length > 0 || group.label === translateText('Bought'));
}

const entries = computed(() => mergeDeckRuns(events.value).map((event) => {
  const actor = event.player ? players.value.get(event.player)?.name ?? event.player : undefined;
  const action = translateText(labels[event.kind]);
  const subject = event.card?.split(':')[0] ?? event.subject;
  const subjectText = subject && translateText(subject);
  const targetLines = (event.targets ?? []).map((target) => ({...target, name: players.value.get(target.player)?.name ?? target.player}));
  const stepLines = event.steps?.map((step) => {
    if (step.kind === 'placed' || step.kind === 'removed') {
      const sector = props.viewModel.game.spaces?.find((field) => field.id === step.space)?.a9 ?? step.space;
      return translateTextWithParams(step.kind === 'placed' ? 'Placed ${0} on sector ${1}' : 'Removed ${0} from sector ${1}', [translateText(step.subject), sector]);
    }
    if (step.kind === 'note') {
      return translateText(step.text);
    }
    if (step.kind === 'resource') {
      const otherPlayer = step.player && step.player !== event.player ? players.value.get(step.player)?.name : undefined;
      const text = translateTextWithParams(step.count > 0 ? 'Added ${0} ${1} to ${2}' : 'Removed ${0} ${1} from ${2}',
        [String(Math.abs(step.count)), translateText(step.resource), translateText(step.card.split(':')[0])]);
      return [otherPlayer, text].filter(Boolean).join(': ');
    }
    if (step.kind === 'event' && (step.event === 'temperature' || step.event === 'oxygen' || step.event === 'venus') && step.subject) {
      return `:i:${step.event}: ${step.subject}`;
    }
    if (step.kind === 'event') {
      const otherPlayer = step.player && step.player !== event.player ? players.value.get(step.player)?.name : undefined;
      return [otherPlayer, translateText(labels[step.event]), step.card || step.subject ? translateText(step.card ?? step.subject ?? '') : undefined].filter(Boolean).join(' ');
    }
    if (step.deck) {
      const recipient = step.deck.player ? players.value.get(step.deck.player)?.name : undefined;
      return [recipient, translateText(deckLabels[step.deck.kind]), step.deck.cards.map(translateText).join(', ')].filter(Boolean).join(' ');
    }
    const recipient = step.player ? players.value.get(step.player)?.name ?? step.player : undefined;
    const count = step.count === 1 ? translateText('Drew a card') : translateTextWithParams('Drew ${0} cards', [String(step.count ?? 0)]);
    return [recipient, count].filter(Boolean).join(' ');
  }) ?? deckGroups(event).map((group) => `${group.label}: ${group.cards.length ? group.cards.map(translateText).join(', ') : '—'}`);
  const science = event.scienceGained === undefined ? undefined : `+${event.scienceGained} ${translateText('Science')}`;
  const summary = [actor, action, subjectText].filter(Boolean).join(' ');
  return {...event, actor, action, subjectText, targetLines, stepLines, groups: event.deck?.length ? deckGroups(event) : [], targetSpace: event.space ?? event.placements?.[0]?.space,
    text: [summary, ...stepLines, science].filter(Boolean).join(' → ')};
}));
const previewCard = computed<CardModel | undefined>(() => {
  const event = events.value.find((entry) => entry.key === previewKey.value);
  const card = event?.card;
  if (!event || !card || !getCard(card)) {
    return undefined;
  }
  return (event.player && players.value.get(event.player)?.tableau.find((model) => model.name === card)) || {name: card};
});
const previewEntry = computed(() => entries.value.find((entry) => entry.key === previewKey.value));
const previewMa = computed(() => {
  const entry = previewEntry.value;
  if (!entry?.subject || (entry.kind !== 'milestone' && entry.kind !== 'award')) {
    return undefined;
  }
  const name = entry.subject;
  const description = entry.kind === 'award' ? getAward(name as AwardName)?.description : getMilestone(name as MilestoneName)?.description;
  return {
    kind: entry.kind === 'award' ? 'Award' : 'Milestone',
    name,
    description: description ?? '',
    icon: `assets/ma/${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.png`,
  };
});

let request: AbortController | undefined;
let highlightTimer: number | undefined;

watch(
  [() => props.viewModel.id, () => props.viewModel.runId, () => props.viewModel.game.gameAge, () => props.viewModel.game.step, () => props.viewModel.game.undoCount],
  ([id, runId, , , undoCount], previous) => {
    if (id !== previous[0] || runId !== previous[1] || undoCount !== previous[4]) {
      loaded.value = false;
      events.value = [];
      newKeys.value = new Set();
      reveal.value = undefined;
      queuedReveals.length = 0;
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
      if (!currentRequest.signal.aborted) {
        reveal.value ??= queuedReveals.shift();
      }
      return;
    }
    const result = groupLegacyPlacements(await response.json());
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
    if (loaded.value) {
      const previousPlays = new Set(events.value.flatMap(cardPlays).map(({key}) => key));
      const played = result.toReversed().flatMap(cardPlays).filter(({key}) => !previousPlays.has(key));
      if (played.length > 0) {
        emit('cardPlays', played);
      }
      // New gains from card effects since the last update: shown as badges in the HUD.
      const before = new Map(events.value.map((event) => [event.key, event.triggers?.length ?? 0]));
      const fresh = result.flatMap((event) => (event.triggers ?? []).slice(before.get(event.key) ?? 0));
      if (fresh.length > 0) {
        emit('triggers', fresh);
      }
    }
    if (loaded.value && isPlayerId(props.viewModel.id)) {
      const previous = new Map(events.value.map((event) => [event.key, event]));
      for (const event of result.toReversed()) {
        if (!event.deck) {
          continue;
        }
        const start = previous.get(event.key)?.deck?.length ?? 0;
        // One source for the centre window: every new batch from the log, shown once.
        // Cards drawn by this player and cards revealed or discarded from the deck are shown;
        // cards dealt to choose from and cards bought were already shown in the choice window.
        const deck = event.deck.slice(start).filter((batch) =>
          batch.kind === 'revealed' || batch.kind === 'discarded' ||
          (batch.kind === 'drawn' && (batch.player ?? event.player) === props.viewModel.color));
        if (deck.length > 0) {
          queuedReveals.push({...event, key: `${event.key}:${start}`, deck});
        }
      }
    }
    reveal.value ??= queuedReveals.shift();
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
      reveal.value ??= queuedReveals.shift();
      console.error('Unable to load game activity', error);
    }
  }
}

function cardPlays(event: GameActivityModel): Array<PlayedCardLogModel> {
  const played: Array<PlayedCardLogModel> = [];
  if (event.kind === 'played' && event.player !== undefined && event.card !== undefined) {
    played.push({key: event.key, player: event.player, card: event.card});
  }
  event.steps?.forEach((step, index) => {
    if (step.kind === 'event' && step.event === 'played' && step.card !== undefined && step.player !== undefined) {
      played.push({key: `${event.key}:played:${index}`, player: step.player, card: step.card});
    }
  });
  return played;
}

function groupLegacyPlacements(history: Array<GameActivityModel>): Array<GameActivityModel> {
  const grouped: Array<GameActivityModel> = [];
  for (const event of history.toReversed()) {
    const action = grouped.at(-1);
    // Older servers send a separate placement row. Keep the initiating action's key so
    // a later response with the placement updates the existing row.
    if (event.kind === 'placed' && event.space && event.subject && event.player !== undefined &&
      action?.player === event.player && (action.kind === 'played' || action.kind === 'action' || action.kind === 'project') &&
      !action.key.startsWith('action:') && !event.key.startsWith('action:')) {
      const placement = {space: event.space, subject: event.subject};
      grouped[grouped.length - 1] = {
        ...action,
        placements: [...(action.placements ?? []), placement],
        steps: [...(action.steps ?? []), {kind: 'placed', ...placement}, ...(event.steps ?? [])],
        deck: action.deck || event.deck ? [...(action.deck ?? []), ...(event.deck ?? [])] : undefined,
        effects: [action.effects, event.effects].filter(Boolean).join(' '),
        targets: action.targets || event.targets ? [...(action.targets ?? []), ...(event.targets ?? [])] : undefined,
      };
    } else {
      grouped.push(event);
    }
  }
  return grouped.reverse();
}


function closePreview() {
  previewKey.value = undefined;
  previewPinned = false;
}

function revealPlayerName(color: GameActivityModel['player']): string | undefined {
  return color === undefined || color === props.viewModel.color ? undefined : players.value.get(color)?.name ?? color;
}

function closeReveal() {
  reveal.value = queuedReveals.shift();
}

function dismissPreview() {
  list.value?.querySelector<HTMLButtonElement>('[aria-expanded="true"]')?.focus({preventScroll: true});
  closePreview();
}

function toggleFeed() {
  expanded.value = !expanded.value;
  closePreview();
}

function hoverEntry(entry: GameActivityModel) {
  if ((entry.card || entry.steps?.length || entry.deck?.length || entry.kind === 'milestone' || entry.kind === 'award') && !previewPinned) {
    previewKey.value = entry.key;
  }
}

function unhoverEntry(entry: GameActivityModel) {
  if (!previewPinned && previewKey.value === entry.key) {
    closePreview();
  }
}

function inspect(entry: GameActivityModel) {
  if (entry.deck?.length) {
    closePreview();
    reveal.value = entry;
  } else if (entry.card && getCard(entry.card)) {
    const model = (entry.player && players.value.get(entry.player)?.tableau.find((card) => card.name === entry.card)) || {name: entry.card} as CardModel;
    closePreview();
    zoomCard(model);
  } else if (entry.placements?.[0]) {
    closePreview();
    emit('spaceClicked', entry.placements[0].space);
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
.activity-feed__summary {
  width: 215px;
  margin: 0 0 6px;
  padding: 6px 8px;
  border: 1px solid #7e9fae;
  border-radius: 4px;
  background: #101b24;
  color: #e5f4f9;
  overflow-wrap: anywhere;
}
.activity-feed__reveal :deep(.markdown-icon-temperature),
.activity-feed__reveal :deep(.markdown-icon-oxygen),
.activity-feed__reveal :deep(.markdown-icon-venus) {
  display: inline-block;
  width: 16px;
  height: 16px;
  margin-right: 2px;
  background: center / contain no-repeat;
  vertical-align: -3px;
}

.activity-feed__reveal :deep(.markdown-icon-temperature) {
  background-image: url(assets/global-parameters/temperature.png);
}

.activity-feed__reveal :deep(.markdown-icon-oxygen) {
  background-image: url(assets/global-parameters/oxygen.png);
}

.activity-feed__reveal :deep(.markdown-icon-venus) {
  background-image: url(assets/global-parameters/venus.png);
}

.activity-feed__reveal {
  color: #d0ecfa;
  white-space: normal;
}
.activity-feed {
  position: absolute;
  z-index: 9;
  inset-block-start: 31%;
  inset-inline-start: clamp(10px, 2vw, 30px);
  width: clamp(220px, 23vw, 330px);
  color: #f3eee7;
  font-size: 0.68rem;
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
    text-shadow: 0 1px 3px #000;
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
  max-height: min(36dvh, 300px);
  gap: 4px;
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
  padding: 4px 8px;
  border: 1px solid #ffffff1f;
  border-radius: 7px;
  background: linear-gradient(100deg, #0d1620b8, #0d16207a);
  box-shadow: inset 0 1px 0 #ffffff12;
  backdrop-filter: blur(6px);
  color: #c9d3d8;
  font: inherit;
  line-height: 1.3;
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
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 5px;
  white-space: normal;
  overflow-wrap: anywhere;
}

.activity-feed__verb {
  color: #aebbc2;
}

.activity-feed__units {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1px 3px;
  color: #b8f5c8;
  font-weight: 700;
  white-space: nowrap;

  &--spent {
    color: #ffc9a8;
  }

  :deep(.markdown-resource),
  :deep(.markdown-icon) {
    width: 14px;
    height: 14px;
    vertical-align: middle;
  }
}

.activity-feed__target {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: #ffd2b8;
}

.activity-feed__target-name {
  padding: 0 4px;
  border-radius: 3px;
  color: #fff;
  font-weight: 650;
  text-shadow: 0 1px 1px #0009;
}

.activity-feed__empty {
  margin: 0;
  padding: 4px 6px;
  color: #bdc8ce;
}

// The card itself floats beside the hovered row: no frame, no background, no close button.
.activity-feed__preview--deck {
  display: grid;
  gap: 8px;
  width: max-content;
  max-width: calc(100vw - 100% - 60px);
}

.activity-feed__group {
  > p {
    margin: 0 0 3px;
    color: #f3e6d6;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-shadow: 0 1px 3px #000;
    text-transform: uppercase;
  }

  &--dim .activity-feed__group-cards {
    opacity: 0.6;
    filter: grayscale(0.6);
  }
}

.activity-feed__group-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;

  :deep(.card-container) {
    margin: 0;
    zoom: 0.8;
  }
}

.activity-feed__preview {
  position: absolute;
  z-index: 2;
  inset-block-end: 0;
  inset-inline-start: calc(100% + 12px);
  filter: drop-shadow(0 18px 26px #000c);
  pointer-events: none;

  :deep(.card-container) {
    margin: 0;
    zoom: 1.15;

    @media (max-height: 760px) {
      zoom: 0.95;
    }
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
    inset-block: calc(100% + 4px) auto;
    inset-inline-start: 0;

    :deep(.card-container) {
      zoom: 0.68;
    }
  }

  .activity-feed__body {
    background: none;
  }
}

.activity-feed__ma {
  display: grid;
  width: 240px;
  justify-items: center;
  gap: 6px;
  padding: 16px;
  border: 1px solid #e2c27f;
  border-radius: 14px;
  background: linear-gradient(#152330f5, #0b131bf5);
  box-shadow: 0 12px 30px #000c;
  color: #eef6f8;
  text-align: center;

  img {
    width: 120px;
    height: 120px;
    object-fit: contain;
  }

  small {
    color: #e2c27f;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  strong {
    color: #fff3c4;
    font-size: 1.3rem;
  }

  p {
    margin: 0;
    color: #cfe0e6;
    font-size: 0.9rem;
  }
}
</style>
