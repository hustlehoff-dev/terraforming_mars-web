<template>
  <aside ref="feed" class="activity-feed" :class="{'activity-feed--expanded': expanded}" :aria-label="$t('Activity feed')" :style="placement" @keydown.esc.stop="dismissPreview">
    <div class="activity-feed__mobile-heading">
      <button
      type="button"
      class="activity-feed__toggle"
      :aria-controls="listId"
      :aria-expanded="expanded"
      @click="toggleFeed">
        <svg class="activity-feed__heading-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M6 4h14v14H6zM6 8H3v13h14v-3M9 8h8M9 11h8M9 14h5" /></svg>
        <span>{{ $t(filter === 'chat' ? 'Chat' : 'Activity feed') }}</span>
        <svg class="activity-feed__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path :d="expanded ? 'm6 9 6 6 6-6' : 'm9 6 6 6-6 6'" /></svg>
      </button>
      <button v-if="canChat" type="button" class="activity-feed__chat-toggle" :aria-label="$t('Chat')" :aria-pressed="filter === 'chat'"
        @click="setFilter(filter === 'chat' ? 'all' : 'chat'); expanded = true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 4h16v12H9l-5 4zM8 8h8M8 12h5" /></svg>
        <span v-i18n>Chat</span>
        <b v-if="unread" class="activity-feed__unread">{{ unread }}</b>
      </button>
    </div>
    <div class="activity-feed__body" :class="{'activity-feed__body--expanded': expanded, 'activity-feed__body--chat': filter === 'chat', 'activity-feed__body--card': latestCardEntry && filter !== 'chat'}">
      <ol :id="listId" ref="list" class="activity-feed__list" tabindex="0" @scroll.passive="updateScroll">
        <template v-for="item in feedItems" :key="item.key">
          <li v-if="item.chat" class="activity-feed__chat" :class="{'activity-feed__chat--mine': item.chat.player === viewModel.color}">
            <span class="activity-feed__marker" :class="'player_bg_color_' + item.chat.player" aria-hidden="true"></span>
            <span class="activity-feed__chat-line">
              <strong>{{ playerName(item.chat.player) }}</strong>
              <span>{{ item.chat.text }}</span>
            </span>
          </li>
          <li v-for="entry in item.entries" :key="entry.key">
            <component
              :is="entry.card || entry.targetSpace || entry.deck?.length ? 'button' : 'div'"
              :type="entry.card || entry.targetSpace || entry.deck?.length ? 'button' : undefined"
              class="activity-feed__entry"
              :class="{'activity-feed__entry--new': newKeys.has(entry.key), 'activity-feed__entry--card': !!entry.card}"
              :aria-label="entry.card || entry.targetSpace || entry.deck?.length ? entry.text : undefined"
              :aria-expanded="entry.deck?.length ? reveal?.key === entry.key : entry.card ? previewKey === entry.key : undefined"
              @click="inspect(entry)"
              @pointerenter="hoverEntry(entry, $event)"
              @pointerleave="unhoverEntry(entry)"
              @focus="hoverEntry(entry, $event)"
              @blur="unhoverEntry(entry)">
              <span v-if="entry.player" class="activity-feed__marker" :class="'player_bg_color_' + entry.player" aria-hidden="true"></span>
              <span class="activity-feed__line">
                <strong v-if="entry.actor">{{ entry.actor + ' ' }}</strong>
                <span v-if="entry.card" class="activity-feed__mobile-arrow" aria-hidden="true">→ </span>
                <span v-if="isCardAction(entry)" class="activity-feed__action-tag"><span aria-hidden="true">➜</span>{{ $t('Card action') }}</span>
                <span v-else class="activity-feed__verb">{{ entry.action + ' ' }}</span>
                <b v-if="entry.subjectText">{{ entry.subjectText }}</b>
                <span v-for="(step, index) in entry.stepLines" :key="index" class="activity-feed__reveal" v-html="'→ ' + renderIcons(step)"></span>
                <span v-if="entry.spent" class="activity-feed__units activity-feed__units--spent" v-html="renderIcons(entry.spent)"></span>
                <span v-if="entry.effects" class="activity-feed__units" v-html="renderIcons(entry.effects)"></span>
                <span v-if="entry.scienceGained !== undefined" class="activity-feed__units" v-html="renderIcons('+' + entry.scienceGained + ':cr:science:')"></span>
                <!-- Gains from the effect of another card (a passive effect, a corporation), each on its own line. -->
                <span v-for="trigger in entry.triggerLines" :key="trigger.key" class="activity-feed__trigger">
                  <span aria-hidden="true">✦</span>
                  <span v-if="trigger.name" class="activity-feed__target-name" :class="'player_bg_color_' + trigger.player">{{ trigger.name }}</span>
                  <span>{{ trigger.label }}</span>
                  <span class="activity-feed__units" v-html="renderIcons(trigger.effects)"></span>
                </span>
                <span v-for="target in entry.targetLines" :key="target.player" class="activity-feed__target">
                  <span aria-hidden="true">→</span>
                  <span class="activity-feed__target-name" :class="'player_bg_color_' + target.player">{{ target.name }}</span>
                  <span class="activity-feed__units" v-html="renderIcons(target.effects)"></span>
                </span>
              </span>
            </component>
          </li>
        </template>
      </ol>
      <button v-if="mobile && latestCardEntry && latestCardModel && filter !== 'chat'" type="button" class="activity-feed__latest-card" :key="latestCardEntry.key"
        :aria-label="latestCardEntry.text + ' · ' + $t('Click to view up close')" @click="inspect(latestCardEntry)">
        <span>{{ latestCardEntry.actor }}</span>
        <div class="activity-feed__latest-face"><Card :card="latestCardModel" inert /></div>
      </button>
      <p v-if="loaded && feedItems.length === 0" class="activity-feed__empty">{{ $t(filter === 'chat' ? 'No messages yet' : 'No activity yet') }}</p>
      <!-- Chat: players write here; the messages show in the feed. -->
      <form v-if="canChat && filter !== 'game'" class="activity-feed__write" @submit.prevent="sendChat">
        <input v-model="draft" type="text" :maxlength="CHAT_MESSAGE_MAX_LENGTH" :placeholder="$t('Write a message')" :aria-label="$t('Write a message')"
          enterkeyhint="send" autocomplete="off" @keydown.stop>
        <button type="submit" :disabled="sending || draft.trim() === ''" :title="$t('Send')" :aria-label="$t('Send')">➤</button>
      </form>
      <!-- Under the list, next to the latest entry: the title and the way back to the latest. -->
      <div class="activity-feed__header">
        <h2 v-i18n>Activity feed</h2>
        <button v-if="scrolled" type="button" @click="showLatest" v-i18n>Latest activity</button>
        <!-- What the feed shows: everything, only the game, only the chat. -->
        <span class="activity-feed__filter" role="group" :aria-label="$t('Show')">
          <button v-for="option in FILTERS" :key="option.value" type="button" :aria-pressed="filter === option.value" @click="setFilter(option.value)">
            {{ $t(option.label) }}<b v-if="option.value === 'chat' && unread > 0" class="activity-feed__unread">{{ unread }}</b>
          </button>
        </span>
      </div>
    </div>
    <div v-if="previewEntry?.groups.length" ref="preview" class="activity-feed__preview activity-feed__preview--deck" :style="previewStyle" aria-hidden="true">
      <div v-if="previewCards.length" class="activity-feed__group activity-feed__group--source" :class="{'activity-feed__group--action': isCardAction(previewEntry)}">
        <p>{{ $t(isCardAction(previewEntry) ? 'Card action' : 'Card') }}</p>
        <div class="activity-feed__group-cards">
          <Card v-for="card in previewCards" :key="card.name" :card="card" />
        </div>
      </div>
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
    <!-- Trade or new colony: the colony tile as it is now (track, colonies, ships). -->
    <div v-else-if="previewColony" ref="preview" class="activity-feed__preview activity-feed__preview--colony" :style="previewStyle" aria-hidden="true">
      <ColonyTile :colony="previewColony" :active="previewColony.isActive" />
      <!-- The cards that got resources from it (e.g. floaters from Titan onto Stormcraft). -->
      <div v-if="previewCards.length" class="activity-feed__group-cards">
        <Card v-for="card in previewCards" :key="card.name" :card="card" />
      </div>
    </div>
    <!-- Milestone or award: its tile, name and what it asks for. -->
    <div v-else-if="previewMa" ref="preview" class="activity-feed__preview" :style="previewStyle" aria-hidden="true">
      <div class="activity-feed__ma">
        <img :src="previewMa.icon" alt="" @error="($event.target as HTMLImageElement).style.visibility = 'hidden'">
        <small>{{ $t(previewMa.kind) }}</small>
        <strong>{{ $t(previewMa.name) }}</strong>
        <p>{{ $t(previewMa.description) }}</p>
      </div>
    </div>
    <div v-else-if="previewCards.length || previewEntry?.stepLines.length" ref="preview" class="activity-feed__preview" :style="previewStyle" aria-hidden="true">
      <p v-if="previewCards.length === 0" class="activity-feed__summary">{{ previewEntry?.text }}</p>
      <!-- The card of the entry and every card it led to: played with it, or given resources. -->
      <div v-else class="activity-feed__preview-cards" :class="{'activity-feed__preview-cards--many': previewCards.length > 1}">
        <Card v-for="card in previewCards" :key="card.name" :card="card" autoTall />
      </div>
    </div>
  </aside>
  <Teleport to="body">
    <p v-if="ringFrom" class="activity-feed__ring" role="status">
      <span aria-hidden="true">🔔</span> {{ translateTextWithParams('${0} rang you', [playerName(ringFrom)]) }}
    </p>
  </Teleport>
  <ActivityCardReveal v-if="reveal?.deck?.length" :key="reveal.key" :batches="reveal.deck" :playerName="revealPlayerName" @close="closeReveal" />
</template>

<script setup lang="ts">
import {computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useId, watch} from 'vue';
import Card from '@/client/components/card/Card.vue';
import ColonyTile from '@/client/components/colonies/Colony.vue';
import ActivityCardReveal from './ActivityCardReveal.vue';
import {getCard} from '@/client/cards/ClientCardManifest';
import {CardType} from '@/common/cards/CardType';
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
import {cardResourceCSS} from '@/client/components/common/cardResources';
import {CHAT_MESSAGE_MAX_LENGTH, ChatMessageModel, PlayerRingModel} from '@/common/models/ChatMessageModel';
import {SoundManager} from '@/client/utils/SoundManager';

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
  production: 'production:',
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
const mobileQuery = typeof window !== 'undefined' ? window.matchMedia?.('(max-width: 760px)') : undefined;
const mobile = ref(mobileQuery?.matches === true);
const MOBILE_EXPANDED_KEY = 'mission-mobile-events-expanded';
function mobileFeedExpanded(): boolean {
  try {
    return window.localStorage.getItem(MOBILE_EXPANDED_KEY) !== '0';
  } catch {
    return true;
  }
}
const expanded = ref(mobileQuery?.matches === true && mobileFeedExpanded());
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
      groups.push({label: [recipient, translateText(deckLabels[batch.kind])].filter(Boolean).join(' '), cards: [...batch.cards], dim: batch.kind === 'discarded' || batch.kind === 'skipped' || batch.kind === 'setup'});
    }
  }
  return groups.filter((group) => group.cards.length > 0 || group.label === translateText('Bought'));
}

const entries = computed(() => mergeDeckRuns(events.value).map((event) => {
  const actor = event.player ? players.value.get(event.player)?.name ?? event.player : undefined;
  const action = translateText(labels[event.kind]);
  const subject = event.card?.split(':')[0] ?? event.subject;
  const subjectText = event.buying !== undefined ?
    translateTextWithParams(event.buying.discarded !== undefined ? '${0} card(s), discarded ${1}' : '${0} card(s)', [String(event.buying.bought), String(event.buying.discarded ?? 0)]) :
    subject && translateText(subject);
  const targetLines = (event.targets ?? []).map((target) => ({...target, name: players.value.get(target.player)?.name ?? target.player}));
  const triggerGroups = new Map<string, {key: string, player: Color, card: CardName, effects: Array<string>}>();
  for (const trigger of event.triggers ?? []) {
    const key = `${trigger.player}:${trigger.card}`;
    const group = triggerGroups.get(key) ?? {key, player: trigger.player, card: trigger.card, effects: []};
    group.effects.push(trigger.effects);
    triggerGroups.set(key, group);
  }
  const triggerLines = Array.from(triggerGroups.values(), (group) => ({
    key: group.key,
    player: group.player,
    name: group.player !== event.player ? players.value.get(group.player)?.name ?? group.player : undefined,
    label: translateTextWithParams('Effect of ${0}:', [translateText(group.card.split(':')[0])]),
    effects: group.effects.join(' '),
  }));
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
      // "+4 [floater icon] Stormcraft Incorporated": the resource as an icon, then the card it went to.
      const icon = resourceIcon(step.resource);
      const text = icon !== undefined ?
        `${step.count > 0 ? '+' : '-'}${Math.abs(step.count)} ${icon} ${translateText(step.card.split(':')[0])}` :
        translateTextWithParams(step.count > 0 ? 'Added ${0} ${1} to ${2}' : 'Removed ${0} ${1} from ${2}',
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
      return [recipient, translateText(deckLabels[step.deck.kind])].filter(Boolean).join(' ') + ': ' + step.deck.cards.map(translateText).join(', ');
    }
    const recipient = step.player ? players.value.get(step.player)?.name ?? step.player : undefined;
    const count = step.count === 1 ? translateText('Drew a card') : translateTextWithParams('Drew ${0} cards', [String(step.count ?? 0)]);
    return [recipient, count].filter(Boolean).join(' ');
  }) ?? deckGroups(event).map((group) => `${group.label}: ${group.cards.length ? group.cards.map(translateText).join(', ') : '—'}`);
  const science = event.scienceGained === undefined ? undefined : `+${event.scienceGained} ${translateText('Science')}`;
  const summary = [actor, action, subjectText].filter(Boolean).join(' ');
  return {...event, actor, action, subjectText, targetLines, triggerLines, stepLines, groups: event.deck?.length ? deckGroups(event) : [], targetSpace: event.space ?? event.placements?.[0]?.space,
    text: [summary, ...stepLines, ...triggerLines.map((line) => [line.name, line.label].filter(Boolean).join(' ')), science].filter(Boolean).join(' → ')};
}));
const previewCards = computed<Array<CardModel>>(() => {
  const event = events.value.find((entry) => entry.key === previewKey.value);
  if (!event) {
    return [];
  }
  // The card itself, then the cards its steps name (e.g. a prelude played by New Partner,
  // the card that got science from it).
  const named: Array<{name: CardName, owner?: Color}> = [];
  if (event.card) {
    named.push({name: event.card, owner: event.player});
  }
  for (const step of event.steps ?? []) {
    if ((step.kind === 'event' || step.kind === 'resource') && step.card) {
      named.push({name: step.card, owner: step.player ?? event.player});
    }
  }
  const seen = new Set<CardName>();
  const cards: Array<CardModel> = [];
  for (const {name, owner} of named) {
    if (seen.has(name) || !getCard(name)) {
      continue;
    }
    seen.add(name);
    const fromOwner = owner ? players.value.get(owner)?.tableau.find((model) => model.name === name) : undefined;
    const fromAnyone = [...players.value.values()].flatMap((player) => player.tableau).find((model) => model.name === name);
    cards.push(fromOwner ?? fromAnyone ?? {name});
  }
  return cards.slice(0, 4);
});
const previewEntry = computed(() => entries.value.find((entry) => entry.key === previewKey.value));
// Only public actions are used here. Private drawn cards never become another player's thumbnail.
const latestCardEntry = computed(() => entries.value.find((entry) =>
  entry.card !== undefined && ['played', 'action', 'project'].includes(entry.kind) && getCard(entry.card) !== undefined));
const latestCardModel = computed<CardModel | undefined>(() => {
  const entry = latestCardEntry.value;
  return entry?.card === undefined ? undefined :
    (entry.player && players.value.get(entry.player)?.tableau.find((card) => card.name === entry.card)) || {name: entry.card};
});
/** The action of a played card (blue card, corporation...), not a standard action like converting heat. */
function isCardAction(entry: GameActivityModel): boolean {
  if (entry.kind !== 'action' || entry.card === undefined) {
    return false;
  }
  const type = getCard(entry.card)?.type;
  return type !== undefined && type !== CardType.STANDARD_ACTION && type !== CardType.STANDARD_PROJECT;
}

/** The entries as shown: the oldest at the top, the latest at the bottom. */
const shownEntries = computed(() => entries.value.toReversed());

/*
 * The game chat, in the same list: each message right after the entry its sender saw last.
 * A switch shows everything, only the game or only the chat.
 */
type FeedFilter = 'all' | 'game' | 'chat';
const FILTERS: ReadonlyArray<{value: FeedFilter, label: string}> = [
  {value: 'all', label: 'All'},
  {value: 'game', label: 'Game'},
  {value: 'chat', label: 'Chat'},
];
const FILTER_KEY = 'activity-feed-filter';
function savedFilter(): FeedFilter {
  try {
    const value = window.localStorage.getItem(FILTER_KEY);
    return value === 'game' || value === 'chat' ? value : 'all';
  } catch {
    return 'all';
  }
}
const filter = ref<FeedFilter>(savedFilter());
const chat = shallowRef<ReadonlyArray<ChatMessageModel>>([]);
const draft = ref('');
const sending = ref(false);
/** Messages from the others that came while the chat was hidden. */
const unread = ref(0);
const canChat = computed(() => isPlayerId(props.viewModel.id));

type FeedItem = {key: string, chat?: ChatMessageModel, entries: ReadonlyArray<(typeof shownEntries.value)[number]>};
const feedItems = computed((): Array<FeedItem> => {
  const showGame = filter.value !== 'chat';
  const showChat = filter.value !== 'game';
  const messages = showChat ? chat.value : [];
  const known = new Set(shownEntries.value.map((entry) => entry.key));
  const byAfter = new Map<string, Array<ChatMessageModel>>();
  const before: Array<ChatMessageModel> = [];
  const atEnd: Array<ChatMessageModel> = [];
  for (const message of messages) {
    if (message.after === undefined) {
      before.push(message);
    } else if (known.has(message.after)) {
      byAfter.set(message.after, [...(byAfter.get(message.after) ?? []), message]);
    } else {
      atEnd.push(message);
    }
  }
  const asItem = (message: ChatMessageModel): FeedItem => ({key: 'chat:' + message.id, chat: message, entries: []});
  const items: Array<FeedItem> = before.map(asItem);
  for (const entry of shownEntries.value) {
    if (showGame) {
      items.push({key: entry.key, entries: [entry]});
    }
    items.push(...(byAfter.get(entry.key) ?? []).map(asItem));
  }
  items.push(...atEnd.map(asItem));
  return items;
});

function playerName(color: Color): string {
  return players.value.get(color)?.name ?? color;
}

function setFilter(value: FeedFilter) {
  filter.value = value;
  if (value !== 'game') {
    unread.value = 0;
  }
  try {
    window.localStorage.setItem(FILTER_KEY, value);
  } catch {
    // Only remembered for this page.
  }
  void nextTick(jumpToLatest);
}

function takeChat(messages: ReadonlyArray<ChatMessageModel>) {
  const last = chat.value[chat.value.length - 1]?.id ?? 0;
  const fresh = messages.filter((message) => message.id > last);
  if (fresh.length === 0) {
    return;
  }
  const atLatest = !scrolled.value;
  chat.value = [...chat.value, ...fresh].slice(-300);
  if (filter.value === 'game' || (mobile.value && !expanded.value)) {
    unread.value += fresh.filter((message) => message.player !== props.viewModel.color).length;
  } else if (atLatest) {
    void nextTick(jumpToLatest);
  }
}

let chatRequest: AbortController | undefined;
const ringFrom = ref<Color>();
let lastRingId: number | undefined;
let ringTimer: number | undefined;

function receiveRing(ring: PlayerRingModel | undefined) {
  if (ring === undefined || ring.id === lastRingId) {
    return;
  }
  lastRingId = ring.id;
  ringFrom.value = ring.from;
  SoundManager.playerRing();
  window.clearTimeout(ringTimer);
  ringTimer = window.setTimeout(() => {
    ringFrom.value = undefined;
  }, 5000);
}

async function refreshChat() {
  if (chatRequest !== undefined) {
    return;
  }
  const current = new AbortController();
  chatRequest = current;
  const since = String(chat.value[chat.value.length - 1]?.id ?? 0);
  try {
    const response = await fetch(`${paths.API_CHAT}?${new URLSearchParams({id: props.viewModel.id, since})}`, {cache: 'no-store', signal: current.signal});
    if (response.ok) {
      const {messages, ring}: {messages?: Array<ChatMessageModel>, ring?: PlayerRingModel} = await response.json();
      if (!current.signal.aborted) {
        takeChat(messages ?? []);
        receiveRing(ring);
      }
    }
  } catch {
    // Next time.
  } finally {
    if (chatRequest === current) {
      chatRequest = undefined;
    }
  }
}

async function sendChat() {
  const text = draft.value.trim();
  if (text === '' || sending.value) {
    return;
  }
  sending.value = true;
  const since = String(chat.value[chat.value.length - 1]?.id ?? 0);
  const after = shownEntries.value[shownEntries.value.length - 1]?.key;
  try {
    const response = await fetch(`${paths.API_CHAT}?${new URLSearchParams({id: props.viewModel.id, since})}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({text, after}),
    });
    if (response.ok) {
      draft.value = '';
      takeChat((await response.json()).messages ?? []);
      void nextTick(jumpToLatest);
    }
  } catch {
    // The text stays in the box: send again.
  } finally {
    sending.value = false;
  }
}

let chatTimer: number | undefined;
onMounted(() => {
  void refreshChat();
  chatTimer = window.setInterval(() => void refreshChat(), 2500);
});
onBeforeUnmount(() => {
  window.clearInterval(chatTimer);
  window.clearTimeout(ringTimer);
  chatRequest?.abort();
});
watch(() => props.viewModel.id, () => {
  chatRequest?.abort();
  chatRequest = undefined;
  chat.value = [];
  unread.value = 0;
  lastRingId = undefined;
  ringFrom.value = undefined;
  window.clearTimeout(ringTimer);
  void refreshChat();
});

/*
 * Where the feed stands: right below the panel of the players (however many there are), down to
 * the dock with the hand. Measured, since the panel grows with each player.
 */
const feed = ref<HTMLElement>();
const placement = ref<Record<string, string>>({});
let placementObserver: ResizeObserver | undefined;
function placeFeed() {
  const aside = feed.value;
  const map = aside?.offsetParent;
  if (mobileQuery?.matches) {
    placement.value = {};
    return;
  }
  const players = map?.querySelector<HTMLElement>('.mission-players');
  if (!aside || !(map instanceof HTMLElement) || !players || players.offsetHeight === 0) {
    placement.value = {};
    return;
  }
  const mapBox = map.getBoundingClientRect();
  const top = players.getBoundingClientRect().bottom - mapBox.top + 10;
  const dock = document.querySelector<HTMLElement>('.mission-dock');
  const bottom = dock ? dock.getBoundingClientRect().top - mapBox.top - 12 : mapBox.height - 12;
  // The header of the feed takes about 40px; the list gets the rest, at least 160px.
  const listHeight = Math.max(160, bottom - top - 44);
  placement.value = {'inset-block-start': `${top}px`, '--feed-list-height': `${listHeight}px`};
}
/*
 * Game windows dim the whole screen behind them; the feed stays readable: its rectangle is
 * published as CSS variables, and the dimmed backdrop of the windows leaves it out
 * (see mission-hud-layout.less, "feed stays visible").
 */
let dialogObserver: MutationObserver | undefined;
function publishFeedRect() {
  const root = document.documentElement.style;
  // The whole feed (title and list), measured when it changes and whenever a window opens.
  const box = feed.value?.getBoundingClientRect();
  if (box === undefined || box.width === 0 || box.height === 0) {
    for (const name of ['--feed-x', '--feed-y', '--feed-w', '--feed-h', '--mobile-feed-bottom']) {
      root.removeProperty(name);
    }
    return;
  }
  root.setProperty('--feed-x', `${Math.round(box.left)}px`);
  root.setProperty('--feed-y', `${Math.round(box.top)}px`);
  root.setProperty('--feed-w', `${Math.round(box.width)}px`);
  root.setProperty('--feed-h', `${Math.round(box.height)}px`);
  const map = feed.value?.offsetParent;
  if (mobileQuery?.matches && map instanceof HTMLElement) {
    root.setProperty('--mobile-feed-bottom', `${Math.ceil(box.bottom - map.getBoundingClientRect().top)}px`);
  } else {
    root.removeProperty('--mobile-feed-bottom');
  }
}
function placeAndPublish() {
  placeFeed();
  void nextTick(publishFeedRect);
}
function changeFeedViewport() {
  mobile.value = mobileQuery?.matches === true;
  expanded.value = mobileQuery?.matches === true && mobileFeedExpanded();
  placeAndPublish();
}
onMounted(() => {
  placeAndPublish();
  const players = feed.value?.offsetParent?.querySelector('.mission-players');
  if (typeof ResizeObserver !== 'undefined') {
    placementObserver = new ResizeObserver(placeAndPublish);
    if (players) {
      placementObserver.observe(players);
    }
    if (feed.value) {
      placementObserver.observe(feed.value);
    }
  }
  // A window opening (a dialog gets "open"): measure again right then, so the gap is never stale.
  if (typeof MutationObserver !== 'undefined') {
    dialogObserver = new MutationObserver(() => publishFeedRect());
    dialogObserver.observe(document.body, {subtree: true, attributes: true, attributeFilter: ['open']});
  }
  window.addEventListener('resize', placeAndPublish);
  mobileQuery?.addEventListener('change', changeFeedViewport);
});
watch([feedItems, expanded], () => void nextTick(publishFeedRect), {flush: 'post'});
onBeforeUnmount(() => {
  placementObserver?.disconnect();
  dialogObserver?.disconnect();
  window.removeEventListener('resize', placeAndPublish);
  mobileQuery?.removeEventListener('change', changeFeedViewport);
  for (const name of ['--feed-x', '--feed-y', '--feed-w', '--feed-h', '--mobile-feed-bottom']) {
    document.documentElement.style.removeProperty(name);
  }
});
/** The icon shortcode of a card resource (Floater, Microbe...), when there is one. */
function resourceIcon(resource: string): string | undefined {
  const css: string | undefined = (cardResourceCSS as Record<string, string>)[resource];
  return css === undefined ? undefined : `:cr:${css.replace(/^card-resource-/, '')}:`;
}

const previewColony = computed(() => {
  const entry = previewEntry.value;
  if (!entry?.subject || (entry.kind !== 'trade' && entry.kind !== 'colony')) {
    return undefined;
  }
  return props.viewModel.game.colonies.find((colony) => colony.name === entry.subject);
});
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
    const atLatest = !loaded.value || !scrolled.value;
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
        // Buying cards: the cards were in the buying window already, nothing to show again.
        if (!event.deck || event.kind === 'bought') {
          continue;
        }
        const start = previous.get(event.key)?.deck?.length ?? 0;
        // One source for the centre window: every new batch from the log, shown once.
        // Cards drawn by this player and cards revealed or discarded from the deck are shown;
        // cards dealt to choose from and cards bought were already shown in the choice window.
        const deck = event.deck.slice(start).filter((batch) =>
          (batch.kind === 'revealed' || batch.kind === 'discarded' || batch.kind === 'drawn') &&
          (batch.player ?? event.player) === props.viewModel.color);
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
    if (scroller && atLatest) {
      await nextTick();
      if (!currentRequest.signal.aborted) {
        jumpToLatest();
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
  if (expanded.value) {
    void nextTick(jumpToLatest);
  }
  if (mobileQuery?.matches) {
    try {
      window.localStorage.setItem(MOBILE_EXPANDED_KEY, expanded.value ? '1' : '0');
    } catch { /* The current choice still works when storage is unavailable. */ }
  }
  closePreview();
}

/** Where the preview stands: level with the entry pointed at, kept inside the screen. */
const previewStyle = ref<Record<string, string>>({});
const preview = ref<HTMLElement>();
let previewAnchor: HTMLElement | undefined;

function placePreview() {
  const aside = previewAnchor?.closest('.activity-feed');
  // On narrow screens the preview sits under the feed (see the media query).
  if (!previewAnchor || !aside || window.innerWidth <= 760) {
    previewStyle.value = {};
    return;
  }
  const entry = previewAnchor.getBoundingClientRect();
  const box = aside.getBoundingClientRect();
  const height = preview.value?.offsetHeight ?? 0;
  const top = Math.max(8, Math.min(entry.top, window.innerHeight - height - 8));
  previewStyle.value = {top: `${top - box.top}px`, bottom: 'auto'};
}

function hoverEntry(entry: GameActivityModel, event?: Event) {
  if (mobileQuery?.matches) {
    return;
  }
  if ((entry.card || entry.steps?.length || entry.deck?.length || ['milestone', 'award', 'trade', 'colony'].includes(entry.kind)) && !previewPinned) {
    previewAnchor = event?.currentTarget instanceof HTMLElement ? event.currentTarget : undefined;
    previewKey.value = entry.key;
    placePreview();
    // Once more after the card is drawn, now that its height is known.
    void nextTick(placePreview);
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

/** True while reading older entries: scrolled up from the latest one at the bottom. */
function updateScroll() {
  const el = list.value;
  scrolled.value = el !== undefined && el.scrollHeight - el.clientHeight - el.scrollTop > 4;
}

function jumpToLatest() {
  if (list.value) {
    list.value.scrollTop = list.value.scrollHeight;
  }
  updateScroll();
}

function showLatest() {
  list.value?.focus({preventScroll: true});
  jumpToLatest();
}
</script>

<style scoped lang="less">
.activity-feed__mobile-heading,
.activity-feed__latest-card,
.activity-feed__mobile-arrow {
  display: none;
}
.activity-feed__ring {
  position: fixed;
  z-index: 61;
  top: max(64px, calc(env(safe-area-inset-top) + 48px));
  left: 50%;
  max-width: calc(100% - 24px);
  margin: 0;
  padding: 8px 14px;
  border: 1px solid #e2c27f;
  border-radius: 8px;
  background: #142630;
  color: #fff1cf;
  font-weight: 700;
  text-align: center;
  transform: translateX(-50%);
  pointer-events: none;
}
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

// A chat message: the sender's colour as a stripe along the left edge of its own row only.
.activity-feed__chat {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 6px;
  overflow: hidden;
  padding: 4px 6px 4px 14px;
  border-radius: 4px;
  background: #0d2a33cc;
  color: #eaf8fc;

  &--mine {
    background: #2a2210cc;
  }
}

.activity-feed__chat-line {
  min-width: 0;
  overflow-wrap: anywhere;

  strong {
    margin-right: 5px;
    color: #a2eeff;
  }
}

.activity-feed__chat--mine .activity-feed__chat-line strong {
  color: #ffe2a8;
}

.activity-feed__write {
  display: flex;
  gap: 4px;
  margin: 6px 3px 0 0;

  input {
    min-width: 0;
    flex: 1;
    padding: 5px 8px;
    border: 1px solid #8fa3ad59;
    border-radius: 6px;
    background: #0b141ce6;
    color: #f3eee7;
    font: inherit;
    font-size: 0.8rem;

    &:focus {
      border-color: #a2eeff;
      outline: none;
    }
  }

  button {
    flex: none;
    width: 30px;
    border: 1px solid #a2eeff80;
    border-radius: 6px;
    background: #12303a;
    color: #a2eeff;
    cursor: pointer;

    &:disabled {
      opacity: 0.4;
      cursor: default;
    }
  }
}

.activity-feed__filter {
  display: inline-flex;
  margin-left: auto;
  overflow: hidden;
  border: 1px solid #8fa3ad59;
  border-radius: 5px;

  .activity-feed__header & button {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 1px 6px;
    border: 0;
    border-radius: 0;
    background: #111a22;
    color: #9fb1b9;

    &[aria-pressed="true"] {
      background: #24414d;
      color: #fff;
    }
  }
}

.activity-feed__unread {
  min-width: 14px;
  padding: 0 3px;
  border-radius: 7px;
  background: #e2582a;
  color: #fff;
  font-size: 0.6rem;
  line-height: 14px;
  text-align: center;
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

// The player's colour as a stripe along the whole left edge of the row.
.activity-feed__entry:has(> .activity-feed__marker) {
  position: relative;
  overflow: hidden;
  padding-left: 14px;
}

.activity-feed__marker {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 6px;
  border: 0;
  border-radius: 0;
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

.activity-feed__trigger {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
  color: #b4ffeb;
  font-style: italic;
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
  grid-auto-flow: column;
  align-items: start;
  gap: 14px;
  width: max-content;
  max-width: calc(100vw - 100% - 60px);
}

// The card whose action (or play) revealed the cards, before them in the preview.
.activity-feed__group--action > p {
  color: #9fd4ff;
}

.activity-feed__group--action :deep(.card-container) {
  box-shadow: 0 0 0 3px #3c9be6, 0 0 18px #3c9be699;
}

.activity-feed__action-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-right: 5px;
  padding: 0 7px;
  border: 1px solid #3c9be6;
  border-radius: 6px;
  background: #0f2a40;
  color: #cfe8ff;
  font-size: 0.85em;
  font-weight: 800;
  vertical-align: 1px;

  > span {
    color: #ff7a5c;
  }
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
    zoom: 0.95;
  }
}

.activity-feed__preview-cards {
  display: flex;
  align-items: flex-start;
  gap: 10px;

  // Two or more cards side by side: a bit smaller, so they fit next to the feed.
  &--many :deep(.card-container) {
    zoom: 0.85;

    @media (max-height: 760px) {
      zoom: 0.7;
    }
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

.activity-feed__preview--colony {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.activity-feed__preview--colony .colony-card {
  margin: 0;
  border-radius: 10px;
  box-shadow: 0 0 0 1px #e2c27f, 0 12px 28px #000c;
  zoom: 0.8;
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
