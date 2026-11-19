<template>
  <!-- Terraform rating of every player, as the track around the board: one marker per player. -->
  <section class="tr-track" :aria-label="$t('Terraform Rating')">
    <header class="tr-track__head">
      <span class="tr-track__title" v-i18n>Terraform Rating</span>
      <small class="tr-track__hint">{{ $t('Each TR: +1 M€ every generation and 1 VP at the end') }}</small>
    </header>
    <div class="tr-track__rail">
      <span v-for="step in steps" :key="step" class="tr-track__tick"
        :class="{'tr-track__tick--major': step % 5 === 0, 'tr-track__tick--start': step === 20}" :style="{left: position(step)}">
        <small v-if="step % 5 === 0">{{ step }}</small>
      </span>
      <span v-for="marker in markers" :key="marker.color" class="tr-track__marker"
        :class="['player_bg_color_' + marker.color, {'tr-track__marker--me': marker.color === myColor}]"
        :style="{left: position(marker.tr), bottom: (8 + marker.stack * 24) + 'px'}"
        :title="marker.name + ': ' + $t('TR') + ' ' + marker.tr">
        <b>{{ marker.tr }}</b>
      </span>
    </div>
    <!-- Every player in TR order: name, TR, the gain this generation, the gap to the leader. -->
    <ol class="tr-track__players">
      <li v-for="(row, index) in ranking" :key="row.color" :class="{'tr-track__player--me': row.color === myColor}">
        <span class="tr-track__place">{{ index + 1 }}.</span>
        <span class="tr-track__swatch" :class="'player_bg_color_' + row.color" aria-hidden="true"></span>
        <span class="tr-track__name">{{ row.name }}</span>
        <b class="tr-track__value">{{ row.tr }}</b>
        <small v-if="row.gain !== 0" class="tr-track__gain" :class="{'tr-track__gain--down': row.gain < 0}"
          :title="$t('Change this generation')">{{ row.gain > 0 ? '+' : '' }}{{ row.gain }}</small>
        <small v-if="index > 0" class="tr-track__gap" :title="$t('Behind the leader')">−{{ ranking[0].tr - row.tr }}</small>
      </li>
    </ol>
  </section>
</template>

<script setup lang="ts">
import {computed, ref, watch} from 'vue';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';

/*
 * The terraform rating track at the top centre of the game screen: a rail with every step (major
 * every 5, the start at 20), a marker per player, and the players in TR order with their gain this
 * generation. The rail shows the part of the track the players are on (at least 30 steps).
 */
const props = defineProps<{players: ReadonlyArray<PublicPlayerModel>, myColor: Color, gameId: string, generation: number}>();

const range = computed(() => {
  const values = props.players.map((player) => player.terraformRating);
  let low = Math.floor((Math.min(...values, 20) - 5) / 5) * 5;
  let high = Math.ceil((Math.max(...values, 20) + 5) / 5) * 5;
  if (high - low < 30) {
    high = low + 30;
  }
  low = Math.max(0, low);
  return {low, high};
});

const steps = computed(() => {
  const result: Array<number> = [];
  for (let step = range.value.low; step <= range.value.high; step++) {
    result.push(step);
  }
  return result;
});

function position(value: number): string {
  const {low, high} = range.value;
  return `${((value - low) / (high - low)) * 100}%`;
}

/** Players on the same step stand one above the other, so every marker shows. */
const markers = computed(() => {
  const seen = new Map<number, number>();
  return props.players.map((player) => {
    const stack = seen.get(player.terraformRating) ?? 0;
    seen.set(player.terraformRating, stack + 1);
    return {color: player.color, name: player.name, tr: player.terraformRating, stack};
  });
});

/*
 * TR at the start of this generation, as first seen on this page (kept in the browser), to show
 * how much each player gained since.
 */
function startKey(): string {
  return `tr-start:${props.gameId}:${props.generation}`;
}
function readStart(): Partial<Record<Color, number>> {
  try {
    return JSON.parse(window.localStorage.getItem(startKey()) ?? '{}');
  } catch {
    return {};
  }
}
function rememberStart() {
  const start = readStart();
  let changed = false;
  for (const player of props.players) {
    if (start[player.color] === undefined) {
      start[player.color] = player.terraformRating;
      changed = true;
    }
  }
  if (changed) {
    try {
      window.localStorage.setItem(startKey(), JSON.stringify(start));
    } catch {
      // Only for this page.
    }
  }
  return start;
}
const start = ref<Partial<Record<Color, number>>>({});
watch(() => [props.gameId, props.generation, props.players.length], () => {
  start.value = rememberStart();
}, {immediate: true});

const ranking = computed(() => props.players
  .map((player) => ({
    color: player.color,
    name: player.name,
    tr: player.terraformRating,
    gain: player.terraformRating - (start.value[player.color] ?? player.terraformRating),
  }))
  .sort((a, b) => b.tr - a.tr));
</script>

<style scoped lang="less">
.tr-track {
  position: absolute;
  z-index: 12;
  top: 6px;
  left: 50%;
  display: grid;
  width: min(760px, 56vw);
  gap: 4px;
  padding: 6px 18px 8px;
  border: 1px solid #c9a35d88;
  border-radius: 10px;
  background: #0b131be6;
  box-shadow: 0 6px 18px #000a;
  color: #f6e2b8;
  transform: translateX(-50%);
  pointer-events: auto;
}

.tr-track__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.tr-track__title {
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.tr-track__hint {
  color: #9fb1b9;
  font-size: 0.68rem;
}

.tr-track__rail {
  position: relative;
  height: 40px;
  margin: 0 10px 14px;
  border-bottom: 3px solid #e2c27f;
}

.tr-track__tick {
  position: absolute;
  bottom: -3px;
  width: 1px;
  height: 5px;
  background: #e2c27f88;

  &--major {
    height: 10px;
    background: #e2c27f;
  }

  &--start {
    width: 2px;
    background: #8dffb9;
  }

  small {
    position: absolute;
    top: 12px;
    left: 50%;
    color: #c9b88f;
    font-size: 0.64rem;
    transform: translateX(-50%);
  }
}

.tr-track__marker {
  position: absolute;
  display: grid;
  min-width: 24px;
  height: 22px;
  place-items: center;
  padding: 0 4px;
  border: 2px solid #0b131b;
  border-radius: 11px;
  color: #fff;
  font-size: 0.75rem;
  text-shadow: 0 1px 2px #000;
  transform: translateX(-50%);
  transition: left 600ms ease;

  &::after {
    position: absolute;
    bottom: -8px;
    left: 50%;
    width: 2px;
    height: 7px;
    background: inherit;
    content: "";
    transform: translateX(-50%);
  }

  &--me {
    z-index: 1;
    border-color: #fff3c4;
    box-shadow: 0 0 8px #ffd36baa;
  }
}

.tr-track__players {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px 16px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.78rem;

  li {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
}

.tr-track__player--me .tr-track__name {
  color: #fff3c4;
  font-weight: 800;
}

.tr-track__place {
  color: #9fb1b9;
}

.tr-track__swatch {
  width: 9px;
  height: 9px;
  border-radius: 50%;
}

.tr-track__name {
  color: #eef6f8;
}

.tr-track__value {
  color: #ffe36b;
}

.tr-track__gain {
  color: #8dffb9;
  font-weight: 700;

  &--down {
    color: #ff9c8a;
  }
}

.tr-track__gap {
  color: #9fb1b9;
}

@media (max-width: 760px) {
  .tr-track {
    display: none;
  }
}
</style>
