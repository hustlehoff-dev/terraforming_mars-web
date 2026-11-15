<template>
  <section class="mission-players" :aria-label="$t('Players')">
    <div v-for="player in rows" :key="player.color" class="mission-players__entry">
      <button type="button" class="mission-players__row"
        :class="['mission-players__row--' + player.color, {'mission-players__row--active': player.color === activeColor, 'mission-players__row--me': player.color === myColor}]"
        :title="$t('Show played cards')" @click="emit('open', player.color)">
        <span class="mission-players__strip" aria-hidden="true"></span>
        <span class="mission-players__who">
          <span class="mission-players__corp">{{ player.corporation ? $t(player.corporation) : '—' }}</span>
          <strong class="mission-players__name">
            <span class="mission-players__nick">{{ player.name }}</span>
            <span v-if="player.color === activeColor" class="mission-players__turn">{{ player.color === myColor ? $t('Your turn') : $t('Turn') }}</span>
            <span v-if="player.color === activeColor && player.color !== myColor && turnSeconds !== undefined" class="mission-players__clock"
              :class="{'mission-players__clock--warn': turnSeconds <= 20}" role="timer" :aria-label="$t('Turn time left')">⏱ {{ turnClock }}</span>
          </strong>
        </span>
        <span class="mission-players__facts">
          <span class="mission-players__fact mission-players__fact--tr" :title="$t('Terraform Rating')">
            <small>TR</small><strong>{{ player.terraformRating }}</strong>
          </span>
          <span class="mission-players__fact" :title="$t('Cards in hand')">
            <img src="assets/resources/card.png" alt=""><strong>{{ player.cardsInHandNbr }}</strong>
          </span>
          <span class="mission-players__fact mission-players__fact--events" :title="$t('Played events (face down)')">
            <span class="mission-players__event-icon" aria-hidden="true"></span><strong>{{ player.events }}</strong>
          </span>
        </span>
        <ul class="mission-players__stock" :aria-label="$t('Resources')">
          <li v-for="resource in RESOURCES" :key="resource.key" :title="$t(resource.label)">
            <img :src="resource.icon" alt="">
            <strong>{{ player[resource.key] }}</strong>
            <small :class="productionClass(player[resource.production])">{{ formatProduction(player[resource.production]) }}</small>
          </li>
        </ul>
      </button>
      <div v-if="player.played" :key="player.played.key" class="mission-players__played" role="status"
        @pointerenter="hold(player.color)" @pointerleave="release(player.color)" @focusin="hold(player.color)" @focusout="release(player.color)">
        <p class="mission-players__played-label" :class="'player_bg_color_' + player.color">{{ player.name }} <span v-i18n>played</span></p>
        <button type="button" class="mission-players__played-card" :title="$t('Click to view up close')" @click="zoomCard(playedModel(player))">
          <Card :card="playedModel(player)" autoTall />
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import {computed, onBeforeUnmount, reactive, ref} from 'vue';
import Card from '@/client/components/card/Card.vue';
import {zoomCard} from '@/client/components/board/cardZoom';
import {CardModel} from '@/common/models/CardModel';
import {getCard} from '@/client/cards/ClientCardManifest';
import {CardType} from '@/common/cards/CardType';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {PlayedCardLogModel} from '@/common/models/PlayedCardLogModel';

/*
 * Every player in the game as a low, wide card in the top-left corner, showing what is public in
 * the board game: corporation, name, terraform rating, resources and production, the number of
 * cards in hand and the number of played events (their content stays hidden).
 */
const props = defineProps<{players: ReadonlyArray<PublicPlayerModel>, activeColor?: Color, myColor: Color}>();
const emit = defineEmits<{open: [color: Color]}>();
const visible = reactive<Partial<Record<Color, PlayedCardLogModel>>>({});
const queues = new Map<Color, Array<PlayedCardLogModel>>();
const timers = new Map<Color, number>();

/** How long a played card stays next to its player; after the pointer leaves it, a bit more. */
const SHOW_MS = 15000;
const AFTER_HOVER_MS = 4000;
/** Players whose played card is pointed at: it stays until the pointer leaves. */
const held = new Set<Color>();

function showNext(player: Color) {
  if (held.has(player)) {
    timers.set(player, window.setTimeout(() => showNext(player), AFTER_HOVER_MS));
    return;
  }
  const play = queues.get(player)?.shift();
  if (play === undefined) {
    delete visible[player];
    queues.delete(player);
    timers.delete(player);
    return;
  }
  visible[player] = play;
  timers.set(player, window.setTimeout(() => showNext(player), SHOW_MS));
}

function hold(player: Color) {
  held.add(player);
  window.clearTimeout(timers.get(player));
  // Keep the entry so new plays queue behind the one shown.
  timers.set(player, -1);
}

function release(player: Color) {
  if (!held.delete(player)) {
    return;
  }
  window.clearTimeout(timers.get(player));
  timers.set(player, window.setTimeout(() => showNext(player), AFTER_HOVER_MS));
}

function show(plays: ReadonlyArray<PlayedCardLogModel>) {
  for (const play of plays) {
    if (getCard(play.card) === undefined || !props.players.some(({color}) => color === play.player)) {
      continue;
    }
    const queue = queues.get(play.player) ?? [];
    queue.push(play);
    queues.set(play.player, queue);
    if (!timers.has(play.player)) {
      showNext(play.player);
    }
  }
}

onBeforeUnmount(() => timers.forEach((timer) => window.clearTimeout(timer)));

// The time left in the turn of the player now playing, when the game has a turn time limit.
const now = ref(Date.now());
const ticker = window.setInterval(() => {
  now.value = Date.now();
}, 500);
onBeforeUnmount(() => window.clearInterval(ticker));
const turnSeconds = computed(() => {
  const deadline = props.players.find((player) => player.color === props.activeColor)?.turnDeadline;
  return deadline === undefined ? undefined : Math.max(0, Math.ceil((deadline - now.value) / 1000));
});
const turnClock = computed(() => {
  const seconds = turnSeconds.value ?? 0;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
});
defineExpose({show});

type StockKey = 'megacredits' | 'steel' | 'titanium' | 'plants' | 'energy' | 'heat';
type ProductionKey = 'megacreditProduction' | 'steelProduction' | 'titaniumProduction' | 'plantProduction' | 'energyProduction' | 'heatProduction';
const RESOURCES: ReadonlyArray<{key: StockKey, production: ProductionKey, icon: string, label: string}> = [
  {key: 'megacredits', production: 'megacreditProduction', icon: 'assets/resources/megacredit.png', label: 'Megacredits'},
  {key: 'steel', production: 'steelProduction', icon: 'assets/resources/steel.png', label: 'Steel'},
  {key: 'titanium', production: 'titaniumProduction', icon: 'assets/resources/titanium.png', label: 'Titanium'},
  {key: 'plants', production: 'plantProduction', icon: 'assets/resources/plant.png', label: 'Plants'},
  {key: 'energy', production: 'energyProduction', icon: 'assets/resources/power.png', label: 'Energy'},
  {key: 'heat', production: 'heatProduction', icon: 'assets/resources/heat.png', label: 'Heat'},
];

const rows = computed(() => props.players.map((player) => ({
  ...player,
  played: visible[player.color],
  corporation: player.tableau.find((card) => getCard(card.name)?.type === CardType.CORPORATION)?.name,
  events: player.tableau.filter((card) => getCard(card.name)?.type === CardType.EVENT).length,
})));

/** The played card as it is on the player's table (with resources), or just its name. */
function playedModel(player: {played?: PlayedCardLogModel, tableau: ReadonlyArray<CardModel>}): CardModel {
  const name = player.played?.card;
  return player.tableau.find((card) => card.name === name) ?? {name} as CardModel;
}

function formatProduction(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function productionClass(value: number): string {
  return value > 0 ? 'up' : value < 0 ? 'down' : 'zero';
}
</script>

<style scoped lang="less">
.mission-players {
  position: absolute;
  z-index: 9;
  top: clamp(12px, 2dvh, 20px);
  left: clamp(10px, 2vw, 30px);
  display: grid;
  width: min(440px, 36vw);
  justify-items: start;
  gap: 6px;
}

.mission-players__row {
  --player: #9aa4ab;

  display: grid;
  width: 92%;
  grid-template-columns: 5px minmax(0, 1fr) auto;
  grid-template-areas:
    'strip who facts'
    'strip stock stock';
  align-items: center;
  gap: 4px 10px;
  padding: 5px 8px 5px 0;
  overflow: hidden;
  border: 1px solid #ffffff24;
  border-radius: 8px;
  background: linear-gradient(100deg, #132230f0, #0b131bd9);
  box-shadow: inset 0 1px 0 #ffffff14, 0 4px 12px #0008;
  color: #eef4f6;
  text-align: left;
  cursor: pointer;
  transition: width 160ms ease;

  &--red { --player: #e2462f; }
  &--green { --player: #3fb44a; }
  &--yellow { --player: #f2c22e; }
  &--blue { --player: #3a8fe6; }
  &--black { --player: #9aa4ab; }
  &--purple { --player: #a057d8; }
  &--orange { --player: #f08a2c; }
  &--pink { --player: #ee6fb0; }

  &--active {
    width: 100%;
    padding-block: 7px;
    border-color: var(--player);
    box-shadow: 0 0 0 1px var(--player), 0 0 16px color-mix(in srgb, var(--player) 50%, transparent), 0 4px 12px #0008;
  }

  &:hover,
  &:focus-visible {
    outline: none;
    background: linear-gradient(100deg, #1b3242f0, #0f1c26d9);
  }
}

.mission-players__entry {
  position: relative;
  width: 100%;
}

.mission-players__entry:has(.mission-players__played) {
  z-index: 1;
}

.mission-players__played {
  position: absolute;
  inset-block-start: 0;
  inset-inline-start: calc(100% + 12px);
  display: grid;
  justify-items: start;
  gap: 6px;
  pointer-events: none;
  filter: drop-shadow(0 10px 24px #000d) drop-shadow(0 0 14px #e2c27f55);

  > :deep(.card-container) {
    margin: 0;
    // Full size; a little smaller on short screens so the card stays on screen.
    zoom: 1;

    @media (max-height: 760px) {
      zoom: 0.8;
    }
  }
}

.mission-players__played-card {
  padding: 0;
  border: 0;
  background: none;
  pointer-events: auto;
  cursor: zoom-in;
}

.mission-players__played-label {
  margin: 0;
  padding: 4px 12px;
  border-radius: 8px;
  color: #fff;
  font-size: 1rem;
  font-weight: 800;
  text-shadow: 0 1px 2px #000;
  white-space: nowrap;
}

@media (prefers-reduced-motion: no-preference) {
  .mission-players__played {
    animation: played-card-in 170ms ease-out both;
  }

  @keyframes played-card-in {
    from { opacity: 0; transform: translateX(-8px); }
    to { opacity: 1; transform: none; }
  }
}

.mission-players__strip {
  grid-area: strip;
  align-self: stretch;
  margin: -10px 0;
  background: var(--player);
}

.mission-players__who {
  display: grid;
  min-width: 0;
  grid-area: who;
  justify-items: start;
  gap: 1px;
}

.mission-players__corp {
  max-width: 100%;
  overflow: hidden;
  color: #f6e2b8;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.mission-players__name {
  display: flex;
  max-width: 100%;
  align-items: center;
  gap: 8px;
  font-size: 1.2rem;
  line-height: 1.1;
  white-space: nowrap;
}

.mission-players__nick {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mission-players__row--active .mission-players__name {
  font-size: 1.35rem;
}

.mission-players__turn {
  flex: none;
  padding: 1px 6px;
  border: 1px solid var(--player);
  border-radius: 4px;
  background: color-mix(in srgb, var(--player) 30%, #0b131b);
  color: #fff;
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

// The opponent's turn clock, next to "Turn".
.mission-players__clock {
  flex: none;
  padding: 1px 8px;
  border: 1px solid #ffffff55;
  border-radius: 5px;
  background: #0b131bf0;
  color: #fff;
  font-size: 0.9rem;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;

  &--warn {
    border-color: #ff7a5c;
    background: #4a140b;
    color: #ffd2c4;
    animation: mission-players-clock-warn 0.8s ease-in-out infinite alternate;
  }
}

@keyframes mission-players-clock-warn {
  from { box-shadow: 0 0 2px #ff7a5c55; }
  to { box-shadow: 0 0 10px #ff7a5ccc; }
}

.mission-players__row--me .mission-players__turn {
  border-color: #e2c27f;
  background: #5a4116;
  color: #ffe2a8;
}

// Terraform rating, cards in hand and face-down events as three labelled boxes.
.mission-players__facts {
  display: flex;
  grid-area: facts;
  gap: 5px;
}

.mission-players__fact {
  display: grid;
  min-width: 40px;
  grid-template-columns: auto auto;
  align-items: center;
  justify-content: center;
  column-gap: 3px;
  padding: 3px 6px;
  border: 1px solid #ffffff1f;
  border-radius: 6px;
  background: #0b141c;

  img {
    width: 14px;
    height: 19px;
  }

  strong {
    font-size: 1.15rem;
    line-height: 1;
  }

  small {
    grid-column: 1 / -1;
    color: #9fb1b9;
    font-size: 0.55rem;
    letter-spacing: 0.06em;
    text-align: center;
    text-transform: uppercase;
  }

  &--tr {
    grid-template-columns: auto;
    border-color: #d27a20;
    background: linear-gradient(#ffcf7a, #d27a20);
    color: #241200;

    small {
      grid-row: 1;
      color: #5a3200;
      font-weight: 800;
    }

    strong {
      font-size: 1.35rem;
    }
  }
}

.mission-players__event-icon {
  width: 12px;
  height: 17px;
  border: 1px solid #ffffff59;
  border-radius: 2px;
  background: linear-gradient(135deg, #e2582a, #8a2a10);
}

// Resources: six equal tiles across the full width.
.mission-players__stock {
  display: grid;
  grid-area: stock;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 3px 2px;
    border-radius: 5px;
    background: #ffffff0d;
    font-variant-numeric: tabular-nums;
  }

  img {
    width: 20px;
    height: 20px;
    object-fit: contain;
  }

  strong {
    font-size: 1rem;
  }

  small {
    font-size: 0.68rem;
    font-weight: 700;

    &.up { color: #8dffb9; }
    &.zero { color: #7d8b92; }
    &.down { color: #ff9c8a; }
  }
}

@media (max-width: 760px) {
  .mission-players {
    display: none;
  }
}
</style>

