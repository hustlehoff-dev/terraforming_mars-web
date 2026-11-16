<template>
  <div class="mission-hud-menus">
    <Teleport to="body">
      <!-- Same window as the card reveal and deck choice. -->
      <dialog v-if="open" ref="dialog" class="wf-root deck-choice-dialog mission-hud-dialog"
        :class="{'mission-hud-dialog--list': maKind, 'mission-hud-dialog--choices': open === 'all'}" :aria-label="dialogTitle"
        @cancel.prevent="open = undefined" @click.self="open = undefined">
        <div v-if="maKind" class="wf-component-title mission-hud-dialog__title">{{ dialogTitle }}</div>
        <DecisionHeading v-else class="mission-hud-dialog__heading" :title="titles[open]" :literal-title="dialogTitle" closable @close="open = undefined" />
        <div class="wf-component deck-deal mission-hud-dialog__scroll">

          <template v-if="maKind">
            <p v-if="maPrices.length" class="mission-hud-dialog__hint mission-hud-dialog__costs">
              {{ $t('Cost') }} <strong>{{ maPrices.map((price) => price + ' M€').join(' → ') }}</strong>
            </p>
            <div v-for="(item, index) in maItems" :key="index" class="mission-hud-dialog__ma" :class="{'mission-hud-dialog__ma--taken': item.owner}">
              <img :src="item.icon" alt="" @error="($event.target as HTMLImageElement).style.visibility = 'hidden'">
              <div class="mission-hud-dialog__ma-text">
                <strong>{{ $t(item.title) }}</strong>
                <small>{{ $t(item.description) }}</small>
                <small v-if="item.scores" class="mission-hud-dialog__scores">{{ item.scores }}</small>
                <small v-if="item.specialPrice !== undefined" class="mission-hud-dialog__costs">{{ item.specialPrice }} M€</small>
              </div>
              <span v-if="item.owner" class="mission-hud-dialog__owner">{{ item.owner }}</span>
              <AppButton v-else-if="item.index >= 0" type="submit" :title="maKind === 'awards' ? 'Fund' : 'Claim'" @click="chooseMa(index)" />
            </div>
            <p v-if="!maSub" class="mission-hud-dialog__hint" v-i18n>Not available now</p>
          </template>

          <template v-else-if="open === 'played'">
            <!-- Filter by tag; the number is how many of that tag the player has. -->
            <div v-if="playedTags.length" class="nofloat mission-tags" role="group" :aria-label="$t('Filter by tag')">
              <button type="button" class="mission-tags__tag" :class="{'mission-tags__tag--on': tagFilter === undefined}" :aria-pressed="tagFilter === undefined"
                @click="tagFilter = undefined">{{ $t('All') }}</button>
              <button v-for="tag in playedTags" :key="tag.tag" type="button" class="mission-tags__tag"
                :class="{'mission-tags__tag--on': tagFilter === tag.tag}" :aria-pressed="tagFilter === tag.tag" :title="$t(tag.tag)"
                @click="tagFilter = tagFilter === tag.tag ? undefined : tag.tag">
                <img :src="'assets/tags/' + tag.tag + '.png'" alt="">
                <b>{{ tag.count }}</b>
              </button>
            </div>
            <p v-if="tagFilter && playedGroups.every((group) => group.hidden || group.cards.length === 0)" class="nofloat mission-hud-dialog__hint" v-i18n>No played cards with this tag.</p>
            <template v-for="group in playedGroups" :key="group.label">
              <div class="nofloat mission-hud-dialog__group">{{ $t(group.label) }} · {{ group.cards.length }}</div>
              <template v-if="group.hidden">
                <div class="nofloat mission-hud-dialog__hint" v-i18n>Event cards are face down: only their number is public.</div>
              </template>
              <div v-else v-for="card in group.cards" :key="card.name" class="cardbox mission-hud-dialog__played" style="cursor: zoom-in"
                :title="$t('Click to view up close')" @click="zoomCard(card)">
                <Card :card="card" autoTall :actionUsed="playedPlayer?.actionsThisGeneration.includes(card.name)" :cubeColor="playedPlayer?.color" />
              </div>
            </template>
          </template>

          <!-- Everything the player can do now, grouped. -->
          <template v-else-if="open === 'all'">
            <p v-if="menuOptions === undefined" class="nofloat mission-hud-dialog__hint" v-i18n>Not available now</p>
            <template v-else>
              <details v-if="turnOptions.length" class="mission-all__section">
                <summary v-i18n>Turn</summary>
                <div class="mission-all__tiles">
                  <button v-for="item in turnOptions" :key="item.index" type="button" class="mission-all__tile mission-all__tile--turn" @click="respondOption(item.index)">
                    {{ $t(item.title) }}
                  </button>
                </div>
              </details>
              <details v-if="playableCards.length" class="mission-all__section">
                <summary v-i18n>Play project card</summary>
                <div class="mission-all__cards">
                  <button v-for="card in playableCards" :key="card.name" type="button" class="cardbox mission-hud-dialog__card" @click="open = undefined; emit('playCard', card)">
                    <Card :card="card" autoTall />
                    <span class="mission-confirm" aria-hidden="true">{{ $t('Play') }}</span>
                  </button>
                </div>
              </details>
              <details v-if="actionCards?.length" class="mission-all__section">
                <summary v-i18n>Card actions</summary>
                <div class="mission-all__cards">
                  <button v-for="card in actionCards" :key="card.name" type="button" class="cardbox mission-hud-dialog__card" @click="open = undefined; emit('cardAction', card)">
                    <Card :card="card" autoTall />
                    <span class="mission-confirm" aria-hidden="true">{{ $t('Use action') }}</span>
                  </button>
                </div>
              </details>
              <details v-if="projectActions.length" class="mission-all__section">
                <summary v-i18n>Standard Projects</summary>
                <div class="mission-all__tiles">
                  <button v-for="action in projectActions" :key="action.id" type="button" class="mission-all__tile" :disabled="action.disabled" @click="chooseProject(action)">
                    <span class="mission-all__effects" aria-hidden="true">
                      <span v-for="(effect, index) in action.effects ?? []" :key="index" :class="{'mission-all__production': effect.production}"><small v-if="effect.text">{{ effect.text }}</small><img :src="effect.img" alt=""></span>
                    </span>
                    <span>{{ $t(action.label) }}</span>
                    <b v-if="action.cost !== undefined" class="mission-all__cost">{{ action.cost }}</b>
                  </button>
                </div>
              </details>
              <details v-if="resourceActions.length || awardOption || milestoneOption || otherOptions.length" class="mission-all__section">
                <summary v-i18n>Other actions</summary>
                <div class="mission-all__tiles">
                  <button v-for="action in resourceActions" :key="action.id" type="button" class="mission-all__tile" :disabled="action.disabled" @click="chooseResource(action)">
                    <span class="mission-all__effects" aria-hidden="true">
                      <span v-for="(effect, index) in action.effects ?? []" :key="index"><small v-if="effect.text">{{ effect.text }}</small><img :src="effect.img" alt=""></span>
                    </span>
                    <span>{{ $t(action.label) }}</span>
                  </button>
                  <button v-if="awardOption" type="button" class="mission-all__tile" @click="open = 'awards'"><span aria-hidden="true">🏆</span>{{ $t('Fund an award') }}</button>
                  <button v-if="milestoneOption" type="button" class="mission-all__tile" @click="open = 'milestones'"><span aria-hidden="true">🏅</span>{{ $t('Claim a milestone') }}</button>
                  <button v-for="item in otherOptions" :key="item.index" type="button" class="mission-all__tile" @click="chooseOther(item)">{{ $t(item.title) }}</button>
                </div>
              </details>
            </template>
          </template>

          <template v-else-if="open === 'sell'">
            <button v-for="card in sellCards" :key="card.name" type="button" class="cardbox mission-hud-dialog__card"
              :class="{'mission-hud-dialog__card--picked': picked.has(card.name)}" :aria-pressed="picked.has(card.name)" @click="togglePick(card.name)">
              <Card :card="card" autoTall />
              <span class="mission-confirm" aria-hidden="true">{{ picked.has(card.name) ? $t('Keep') : $t('Sell') }}</span>
            </button>
          </template>

          <template v-else-if="open === 'actions'">
            <button v-for="card in actionCards" :key="card.name" type="button" class="cardbox mission-hud-dialog__card" @click="open = undefined; emit('cardAction', card)">
              <Card :card="card" autoTall />
              <span class="mission-confirm" aria-hidden="true">{{ $t('Use action') }}</span>
            </button>
          </template>

          <template v-else-if="open === 'projects'">
            <button v-for="project in projectCards" :key="project.name" type="button" class="cardbox mission-hud-dialog__card"
              :disabled="project.action === undefined || project.action.disabled" @click="chooseProject(project.action)">
              <Card :card="{name: project.name, calculatedCost: project.action?.cost}" />
              <span class="mission-confirm" aria-hidden="true">{{ $t('Choose') }}</span>
            </button>
          </template>

        </div>
        <!-- Fixed under the list: never scrolls away, never covers the cards. -->
        <footer class="mission-hud-dialog__footer">
          <AppButton v-if="open === 'sell'" type="submit" :disabled="picked.size === 0" :title="sellLabel" @click="sell" />
          <button type="button" class="mission-close" @click="open = undefined" v-i18n>Close</button>
          <DialogPeek />
        </footer>
      </dialog>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import {zoomCard} from '@/client/components/board/cardZoom';
import {computed, getCurrentInstance, nextTick, ref, watch} from 'vue';
import Card from '@/client/components/card/Card.vue';
import AppButton from '@/client/components/common/AppButton.vue';
import DialogPeek from '@/client/components/common/DialogPeek.vue';
import {vueRoot} from '@/client/components/vueRoot';
import {AWARD_COSTS, MAX_AWARDS, MAX_MILESTONES, MILESTONE_COST} from '@/common/constants';
import {MilestoneName} from '@/common/ma/MilestoneName';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {CardType} from '@/common/cards/CardType';
import {Tag} from '@/common/cards/Tag';
import {Color} from '@/common/Color';
import {getCard} from '@/client/cards/ClientCardManifest';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {InputResponse} from '@/common/inputs/InputResponse';
import {translateText} from '@/client/directives/i18n';
import DecisionHeading from './DecisionHeading.vue';
import {milestoneAwardChoice} from './DecisionChoice';
import {actionMenu, MissionQuickAction} from './MissionQuickAction';

/*
 * HUD entries for standard projects, awards and milestones. Each opens the centre window used for
 * card reveals and lists what can be done now; the choice goes straight to the action menu.
 */
const props = defineProps<{playerView: PlayerViewModel, actions: ReadonlyArray<MissionQuickAction>, actionCards?: ReadonlyArray<CardModel>}>();
const emit = defineEmits<{project: [action: MissionQuickAction], respond: [response: InputResponse], cardAction: [card: CardModel], playCard: [card: CardModel]}>();

type Menu = 'all' | 'projects' | 'awards' | 'milestones' | 'played' | 'actions' | 'sell';
const titles: Record<Menu, string> = {all: 'Actions', projects: 'Standard Projects', awards: 'Awards', milestones: 'Milestones', played: 'Played Cards', actions: 'Card actions', sell: 'Sell patents'};
const open = ref<Menu>();
const dialog = ref<HTMLDialogElement>();
const instance = getCurrentInstance()?.proxy;
const requestInProgress = computed(() => instance ? vueRoot(instance).isServerSideRequestInProgress : false);

const BASE_PROJECTS: ReadonlyArray<CardName> = [
  CardName.POWER_PLANT_STANDARD_PROJECT, CardName.ASTEROID_STANDARD_PROJECT, CardName.AQUIFER_STANDARD_PROJECT,
  CardName.GREENERY_STANDARD_PROJECT, CardName.CITY_STANDARD_PROJECT,
];

const projectCards = computed(() => {
  const offered = props.actions.filter((action) => action.card !== undefined);
  const names = offered.length > 0 ? offered.map((action) => action.card as CardName) : BASE_PROJECTS;
  return names.map((name) => ({name, action: offered.find((action) => action.card === name)}));
});
const PLAYED_GROUPS: ReadonlyArray<{type: CardType, label: string}> = [
  {type: CardType.CORPORATION, label: 'Corporation'},
  {type: CardType.PRELUDE, label: 'Preludes'},
  {type: CardType.CEO, label: 'CEO'},
  {type: CardType.ACTIVE, label: 'Active'},
  {type: CardType.AUTOMATED, label: 'Automated'},
  {type: CardType.EVENT, label: 'Events'},
];
const playedColor = ref<Color>();
const playedPlayer = computed(() => props.playerView.players.find((player) => player.color === playedColor.value) ?? props.playerView.thisPlayer);
/** Tag shown in the played cards window, or all of them. */
const tagFilter = ref<Tag>();
/** The player's tags (as counted by the game) that appear on their played cards. */
const playedTags = computed(() => {
  const counts = playedPlayer.value.tags;
  return (Object.keys(counts) as Tag[])
    .filter((tag) => counts[tag] > 0)
    .map((tag) => ({tag, count: counts[tag]}))
    .sort((a, b) => b.count - a.count);
});
const playedGroups = computed(() => {
  const own = playedPlayer.value.color === props.playerView.thisPlayer.color;
  const filter = tagFilter.value;
  return PLAYED_GROUPS.map((group) => ({
    label: group.label,
    // Other players' events are a face-down pile in the board game: show the count, not the cards.
    hidden: group.type === CardType.EVENT && !own,
    cards: playedPlayer.value.tableau.filter((card) => {
      const known = getCard(card.name);
      return known?.type === group.type && (filter === undefined || (known.tags as ReadonlyArray<Tag>).includes(filter));
    }),
  })).filter((group) => group.cards.length > 0);
});
watch(open, () => {
  tagFilter.value = undefined;
});
function showPlayed(color: Color) {
  playedColor.value = color;
  open.value = 'played';
}
const dialogTitle = computed(() => {
  if (open.value === undefined) {
    return '';
  }
  const title = translateText(titles[open.value]);
  return open.value === 'played' && playedPlayer.value.color !== props.playerView.thisPlayer.color ? `${playedPlayer.value.name} · ${title}` : title;
});

function titleOf(input: PlayerInputModel): string {
  return typeof input.title === 'string' ? input.title : input.title.message;
}

/** The fund-award or claim-milestone sub-menu of the action menu, with its index there. */
function subMenu(prefix: string) {
  const menu = actionMenu(props.playerView.waitingFor);
  const index = menu?.options.findIndex((option) => option.type === 'or' && titleOf(option).startsWith(prefix)) ?? -1;
  const option = index >= 0 ? menu?.options[index] : undefined;
  return option?.type === 'or' ? {index, option} : undefined;
}
const awardOption = computed(() => subMenu('Fund an award'));
const milestoneOption = computed(() => subMenu('Claim a milestone'));

const maKind = computed(() => open.value === 'awards' || open.value === 'milestones' ? open.value : undefined);
const maSub = computed(() => maKind.value === 'awards' ? awardOption.value : milestoneOption.value);
const maEntries = computed(() => {
  const {game} = props.playerView;
  return maKind.value === 'awards' ? game.awards : game.milestones;
});
const maPrices = computed(() => {
  if (!maKind.value || props.playerView.players.length < 2 || !maEntries.value.length) {
    return [];
  }
  const awards = maKind.value === 'awards';
  const used = maEntries.value.filter((entry) => entry.color !== undefined || entry.playerName !== undefined).length;
  const costs = props.playerView.milestoneAwardCosts;
  if (awards) {
    return used < MAX_AWARDS ? costs?.awards ?? AWARD_COSTS.slice(used) : [];
  }
  return used < MAX_MILESTONES ? [costs?.milestone ?? MILESTONE_COST] : [];
});

const maItems = computed(() => {
  const kind = maKind.value;
  if (!kind) {
    return [];
  }
  const sub = maSub.value;
  const nextPrice = maPrices.value[0];
  const costs = props.playerView.milestoneAwardCosts;
  const playerNames = new Map(props.playerView.players.map((player) => [player.color, player.name]));
  return maEntries.value.map((entry) => {
    const index = sub?.option.options.findIndex((option) => titleOf(option) === entry.name) ?? -1;
    const owner = entry.playerName ?? (entry.color === undefined ? undefined : playerNames.get(entry.color) ?? entry.color);
    const price = kind === 'milestones' ? costs?.milestoneOverrides[entry.name as MilestoneName] : undefined;
    return {
      ...milestoneAwardChoice(entry.name, kind),
      owner,
      scores: entry.scores.map((score) => `${playerNames.get(score.color) ?? score.color}: ${score.score}`).join(' · '),
      specialPrice: owner === undefined && nextPrice !== undefined && price !== nextPrice ? price : undefined,
      index,
    };
  });
});

watch(open, async (menu) => {
  if (menu) {
    await nextTick();
    try {
      dialog.value?.showModal();
    } catch {
      dialog.value?.setAttribute('open', '');
    }
  }
});
watch(() => props.playerView.requestId, () => {
  open.value = undefined;
});

defineExpose({show: (menu: Menu) => {
  open.value = menu;
}, showPlayed});

// Sell patents: pick cards from the hand, then sell them in one go.
const picked = ref(new Set<CardName>());
const sellOption = computed(() => {
  const menu = actionMenu(props.playerView.waitingFor);
  const index = menu?.options.findIndex((option) => option.type === 'card' && titleOf(option) === 'Sell patents') ?? -1;
  const option = index >= 0 ? menu?.options[index] : undefined;
  return option?.type === 'card' ? {index, option} : undefined;
});
const sellCards = computed(() => sellOption.value?.option.cards ?? []);
const sellLabel = computed(() => `${translateText('Sell')} ${picked.value.size} (+${picked.value.size} M€)`);
function togglePick(name: CardName) {
  const next = new Set(picked.value);
  if (!next.delete(name)) {
    next.add(name);
  }
  picked.value = next;
}
function sell() {
  const sub = sellOption.value;
  if (sub && picked.value.size > 0) {
    open.value = undefined;
    emit('respond', {type: 'or', index: sub.index, response: {type: 'card', cards: [...picked.value]}});
  }
}
watch(open, (menu) => {
  if (menu === 'sell') {
    picked.value = new Set();
  }
});

function chooseProject(action: MissionQuickAction | undefined) {
  if (action && !action.disabled) {
    open.value = undefined;
    emit('project', action);
  }
}

// "Actions": the whole action menu, grouped.
const menuOptions = computed(() => actionMenu(props.playerView.waitingFor)?.options);
const TURN_TITLES = new Set(['Pass for this generation', 'End Turn']);
const COVERED_TITLES = new Set([...TURN_TITLES, 'Play project card', 'Perform an action from a played card', 'Standard projects', 'Sell patents']);
const turnOptions = computed(() => (menuOptions.value ?? [])
  .map((option, index) => ({index, title: titleOf(option), type: option.type}))
  .filter((item) => item.type === 'option' && TURN_TITLES.has(item.title)));
const playableCards = computed(() => {
  const option = menuOptions.value?.find((candidate) => candidate.type === 'projectCard' && titleOf(candidate) === 'Play project card');
  return option?.type === 'projectCard' ? option.cards.filter((card) => card.isDisabled !== true) : [];
});
const projectActions = computed(() => props.actions.filter((action) => action.card !== undefined));
const resourceActions = computed(() => props.actions.filter((action) => action.card === undefined));
/** Menu entries without a place of their own (colonies, delegates, expansion actions...). */
const otherOptions = computed(() => {
  const used = new Set(props.actions.map((action) => action.index));
  return (menuOptions.value ?? [])
    .map((option, index) => ({index, title: titleOf(option), type: option.type}))
    .filter((item) => !used.has(item.index) && !COVERED_TITLES.has(item.title) &&
      !item.title.startsWith('Fund an award') && !item.title.startsWith('Claim a milestone'));
});
function respondOption(index: number) {
  open.value = undefined;
  emit('respond', {type: 'or', index, response: {type: 'option'}});
}
function chooseResource(action: MissionQuickAction) {
  if (action.id === 'sell') {
    open.value = 'sell';
  } else {
    chooseProject(action);
  }
}
function chooseOther(item: {index: number, title: string, type: string}) {
  if (item.type === 'option') {
    respondOption(item.index);
    return;
  }
  open.value = undefined;
  emit('project', {id: 'menu:' + item.index, label: item.title, index: item.index});
}

function chooseMa(index: number) {
  const sub = maSub.value;
  const item = maItems.value[index];
  if (sub && item && item.owner === undefined && item.index >= 0 && !requestInProgress.value) {
    open.value = undefined;
    emit('respond', {type: 'or', index: sub.index, response: {type: 'or', index: item.index, response: {type: 'option'}}});
  }
}
</script>

<style scoped lang="less">
// A 2 × 2 block of large tiles in the free left column of the dock.
.mission-hud-menus {
  display: none;
  width: min(100%, 290px);
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  align-self: end;
  margin-bottom: 8px;
  pointer-events: auto;
}

.mission-hud-menus__button {
  display: grid;
  min-height: 96px;
  place-items: center;
  align-content: center;
  gap: 6px;
  padding: 10px 6px;
  border: 1px solid #6f8c98;
  border-radius: 10px;
  background:
    radial-gradient(120% 90% at 50% 0%, #2a4458, transparent 70%),
    linear-gradient(#18293a, #0b141c);
  box-shadow: inset 0 1px 0 #ffffff24, 0 6px 16px #0009;
  color: #eef6f8;
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  line-height: 1.15;
  text-align: center;
  text-transform: uppercase;
  overflow-wrap: anywhere;
  cursor: pointer;

  img,
  .mission-hud-menus__glyph {
    width: 44px;
    height: 44px;
    font-size: 36px;
    line-height: 44px;
    object-fit: contain;
    text-align: center;
    filter: drop-shadow(0 2px 3px #000a);
  }

  &--lit {
    border-color: #e2c27f;
    box-shadow: inset 0 1px 0 #ffffff24, 0 0 0 1px #e2c27f80, 0 0 18px #e2c27f66;
  }

  &:hover,
  &:focus-visible {
    outline: none;
    border-color: #b4ffeb;
    background: linear-gradient(#24465a, #12232e);
  }
}

@media (max-width: 760px) {
  .mission-hud-menus {
    width: 150px;
    gap: 4px;
  }

  .mission-hud-menus__button {
    min-height: 58px;
    padding: 4px;
    font-size: 0.55rem;

    img,
    .mission-hud-menus__glyph {
      width: 24px;
      height: 24px;
      font-size: 20px;
      line-height: 24px;
    }
  }
}
</style>

<style lang="less">
.mission-hud-dialog {
  // A centred window, not the whole screen: content scrolls inside it. No panel of its own:
  // the cards float over the blurred game.
  &.deck-choice-dialog {
    width: min(1400px, 95vw);
    max-width: min(1400px, 95vw);
    max-height: 92dvh;
    overflow: hidden;
    border: 0;
    background: none;
    box-shadow: none;

    &[open] {
      display: flex;
      flex-direction: column;
    }

    // A plain dim instead of a blur: blurring the live 3D scene made scrolling lag.
    &::backdrop {
      background: #03070cd9;
      backdrop-filter: none;
    }
  }

  .mission-hud-dialog__heading {
    flex: none;
    margin-bottom: 12px;
  }

  .mission-hud-dialog__title {
    flex: none;
    margin-bottom: 10px;
    text-align: center;
  }

  // Only the list scrolls, without a visible scrollbar; edges fade out.
  .mission-hud-dialog__scroll {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
    padding: 30px 12px 24px;
    scrollbar-width: none;
    mask-image: linear-gradient(transparent, #000 18px, #000 calc(100% - 18px), transparent);

    &::-webkit-scrollbar {
      display: none;
    }

    // Cost and tags stick out of the cards: room for them, and no clipping per card.
    > .cardbox {
      animation: none !important;
    }
  }

  .mission-hud-dialog__footer {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding-top: 12px;

    .dialog-peek {
      position: static;
      margin: 0;
    }
  }

  &.mission-hud-dialog--choices.deck-choice-dialog:not(.dialog--peek) {
    border: 1px solid #e2c27f99;
    border-radius: 14px;
    background: linear-gradient(#152330f5, #0b131bf5);
    box-shadow: 0 24px 64px #000b;
  }

  &.mission-hud-dialog--list.deck-choice-dialog {
    width: min(620px, 92vw);
    max-width: min(620px, 92vw);
  }

  .mission-hud-dialog__ma {
    display: flex;
    flex-basis: min(560px, 100%) !important;
    min-width: 0;
    align-items: center;
    gap: 12px;
    min-height: 76px;
    padding: 8px 10px;
    border: 1px solid #5f7d8a;
    border-radius: 6px;
    background: #142430;
    text-align: left;

    // The tile of the award or milestone (140 x 83) as tall as the row, at its own proportions.
    img {
      width: auto;
      height: auto;
      min-height: 58px;
      flex: none;
      align-self: stretch;
      aspect-ratio: 140 / 83;
      object-fit: contain;
    }

    &--taken {
      opacity: 0.7;
    }
  }

  .mission-hud-dialog__ma-text {
    display: grid;
    min-width: 0;
    flex: 1;
    gap: 2px;
    overflow-wrap: anywhere;

    small {
      color: #b9c8ce;
    }
  }

  .mission-hud-dialog__scores,
  .mission-hud-dialog__costs strong,
  .mission-hud-dialog__ma-text .mission-hud-dialog__costs {
    color: #f6e2b8;
  }

  .mission-hud-dialog__owner {
    max-width: 35%;
    padding: 3px 8px;
    border-radius: 4px;
    background: #3a2614;
    color: #ffd9a1;
    font-weight: 700;
    overflow-wrap: anywhere;
  }

  .wf-component-title {
    text-shadow: 0 2px 6px #000;
  }

  .cardbox,
  .cardbox:focus-within {
    outline: none !important;
    box-shadow: none !important;
    border: 0 !important;
  }

  .mission-hud-dialog__card {
    position: relative;
    padding: 0;
    border: 0;
    background: none;
    cursor: pointer;

    &:disabled {
      cursor: not-allowed;
      filter: grayscale(0.85);
      opacity: 0.55;
    }

    &:not(:disabled):hover .card-container,
    &:focus-visible .card-container {
      filter: brightness(0.6);
    }

    &:not(:disabled):hover .mission-confirm,
    &:focus-visible .mission-confirm {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
  }

  .mission-hud-dialog__card--picked .card-container {
    box-shadow: 0 0 0 4px #e2c27f, 0 0 22px #e2c27f99;
  }

  .mission-confirm {
    position: absolute;
    z-index: 100;
    top: 50%;
    left: 50%;
    padding: 9px 20px;
    border: 1px solid #e2c27f;
    border-radius: 8px;
    background: linear-gradient(#6a4c18, #33240b);
    box-shadow: 0 0 16px #e2c27f66, 0 6px 16px #000a;
    color: #ffe9bd;
    font-size: 0.95rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    white-space: nowrap;
    text-transform: uppercase;
    opacity: 0;
    pointer-events: none;
    transform: translate(-50%, -50%) scale(0.92);
    transition: opacity 120ms ease, transform 120ms ease;
  }

  .mission-hud-dialog__group {
    color: #f6e2b8;
    font-size: 0.95rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-align: left;
    text-transform: uppercase;
  }

  .mission-hud-dialog__played .card-container {
    margin: 0;
    zoom: 0.95;

    @media (max-height: 760px) {
      zoom: 0.8;
    }
  }

  .mission-hud-dialog__hint {
    margin: 0;
    color: #c9d4d8;
  }
}
</style>

<style lang="less">
// "Actions" window: sections of tiles and cards.
.mission-hud-dialog {
  .mission-all__section {
    min-width: 0;
    border: 1px solid #657884;
    border-radius: 8px;
    background: #0d1721d9;

    > summary {
      padding: 12px 16px;
      color: #f6e2b8;
      font-size: 0.9rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-align: start;
      text-transform: uppercase;
      cursor: pointer;

      &:focus-visible {
        outline: 2px solid #a8edff;
        outline-offset: -3px;
      }
    }
  }

  .mission-all__tiles,
  .mission-all__cards {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    padding: 10px 12px 14px;
  }

  .mission-all__cards > .cardbox {
    animation: none;
  }

  @media (max-width: 800px) {
    .mission-all__cards > .cardbox {
      zoom: 0.78;
    }
  }

  .mission-all__tile {
    display: inline-flex;
    min-height: 44px;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    font-family: inherit;
    font-size: 0.9rem;
    line-height: 1.2;
    border: 1px solid #6f8c98;
    border-radius: 10px;
    background: linear-gradient(#1c2f3fe6, #0b141ce6);
    color: #eef6f8;
    font-weight: 700;
    cursor: pointer;

    &:hover:not(:disabled) {
      border-color: #b4ffeb;
    }

    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    &--turn {
      border-color: #e2c27f;
      color: #ffe9bd;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
  }

  .mission-all__effects {
    display: inline-flex;
    gap: 4px;

    > span {
      display: inline-flex;
      align-items: center;
      gap: 1px;
    }

    img {
      width: 22px;
      height: 22px;
      object-fit: contain;
    }

    small {
      font-size: 0.75rem;
      font-weight: 800;
    }
  }

  .mission-all__production img {
    padding: 2px;
    border: 1px solid #d79a5a;
    border-radius: 3px;
    background: #8a5a2b;
  }

  .mission-all__cost {
    display: inline-grid;
    min-width: 26px;
    height: 22px;
    font-size: 0.8rem;
    place-items: center;
    padding: 0 4px;
    border-radius: 4px;
    background: linear-gradient(#ffe36b, #f0b20f);
    color: #1b1200;
  }
}
</style>

<style lang="less">
// Tag filter of the played cards window.
.mission-hud-dialog .mission-tags {
  display: flex !important;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  margin-bottom: 6px;
}

.mission-tags__tag {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  gap: 5px;
  padding: 3px 10px 3px 4px;
  border: 1px solid #6f8c98;
  border-radius: 18px;
  background: #0b141ce6;
  color: #eef6f8;
  font-weight: 800;
  cursor: pointer;

  &:first-child {
    padding-left: 12px;
  }

  img {
    width: 28px;
    height: 28px;
    object-fit: contain;
  }

  &:hover {
    border-color: #b4ffeb;
  }

  &--on {
    border-color: #e2c27f;
    box-shadow: 0 0 0 1px #e2c27f, 0 0 12px #e2c27f66;
    color: #fff3c4;
  }
}
</style>

