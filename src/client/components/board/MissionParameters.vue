<template>
  <section class="mission-params" :aria-label="$t('Global parameters')" tabindex="0">
    <header class="mission-params__generation">
      <span v-i18n>Generation</span>
      <strong>{{ game.generation }}<template v-if="lastGeneration"> / {{ lastGeneration }}</template></strong>
      <small v-if="game.phase === 'action' && game.turn !== undefined">· <span v-i18n>Turn</span> {{ game.turn }}</small>
    </header>
    <div v-for="track in tracks" :key="track.key" class="mission-params__track" :data-parameter="track.key"
      :class="{'mission-params__track--done': track.value >= track.max}">
      <div class="mission-params__head">
        <img :src="track.icon" alt="">
        <span class="mission-params__label">{{ $t(track.label) }}</span>
        <span class="mission-params__reading">
          <strong class="mission-params__value">{{ formatLevel(track, track.value) }}</strong>
          <small>/ {{ formatLevel(track, track.max) }}</small>
        </span>
      </div>
      <div class="mission-params__bar" role="progressbar" :style="{'--steps': track.steps}"
        :aria-label="$t(track.label)" :aria-valuemin="track.min" :aria-valuemax="track.max" :aria-valuenow="track.value"
        :aria-valuetext="formatLevel(track, track.value) + ' / ' + formatLevel(track, track.max)">
        <span v-for="step in track.steps" :key="step" class="mission-params__step"
          :class="{'mission-params__step--filled': step <= track.filled, 'mission-params__step--bonus': track.bonuses.some((bonus) => bonus.step === step)}"
          aria-hidden="true"></span>
      </div>
      <!-- Bonuses under the bar, one row: each chip names its level and a line leads to its step. -->
      <div v-if="track.bonuses.length" class="mission-params__bonuses" :style="{'--bonus-width': CHIP * 100 + '%'}">
        <template v-for="bonus in track.bonuses" :key="bonus.at">
          <span class="mission-params__lead" :class="{'mission-params__lead--used': track.value >= bonus.at}"
            :style="{'--from': bonus.stepX, '--to': bonus.chipX}" aria-hidden="true"></span>
          <span class="mission-params__bonus" :class="{'mission-params__bonus--used': track.value >= bonus.at}"
            :style="{'--x': bonus.chipX}" role="img" :title="bonus.text + ' ' + $t(bonus.title)"
            :aria-label="formatLevel(track, bonus.at) + ' · ' + bonus.text + ' ' + $t(bonus.title)">
            <span class="mission-params__bonus-at">{{ formatLevel(track, bonus.at) }}</span>
            <img :src="bonus.icon" alt="" :class="{'mission-params__bonus-production': bonus.production}">
            <span class="mission-params__bonus-text">{{ bonus.text }}</span>
          </span>
        </template>
      </div>
    </div>
    <div v-if="$slots.default" class="mission-params__buttons"><slot></slot></div>
  </section>
</template>

<script setup lang="ts">
import {computed} from 'vue';
import {GameModel} from '@/common/models/GameModel';
import {BoardName} from '@/common/boards/BoardName';
import {getGlobalParameterMaximums} from '@/common/boards/GlobalParameterMaximums';
import {
  MIN_TEMPERATURE, OXYGEN_LEVEL_FOR_AMAZONIS_CARD_BONUS, OXYGEN_LEVEL_FOR_AMAZONIS_TEMPERATURE_BONUS,
  OXYGEN_LEVEL_FOR_TEMPERATURE_BONUS, TEMPERATURE_BONUS_FOR_HEAT_1, TEMPERATURE_BONUS_FOR_HEAT_2,
  TEMPERATURE_FOR_OCEAN_BONUS, VENUS_LEVEL_FOR_CARD_BONUS, VENUS_LEVEL_FOR_TR_BONUS,
} from '@/common/constants';

/*
 * Global parameters in the top-right corner: one track per parameter with its steps,
 * the current value and the bonus icons at the positions where the board grants them.
 */
const props = defineProps<{game: GameModel, solo: boolean}>();

type Bonus = {at: number, icon: string, title: string, text: string, production?: boolean};
/** A bonus with the centre of its step and of its chip (fractions of the bar width). */
type PlacedBonus = Bonus & {step: number, stepX: number, chipX: number};
type Track = {key: string, label: string, icon: string, unit: string, value: number, min: number, max: number, steps: number, filled: number, bonuses: PlacedBonus[]};
/** Width of one bonus chip as a fraction of the bar. */
const CHIP = 1 / 3;

const HEAT = 'assets/resources/heat.png';
const OCEAN = 'assets/tiles/ocean.png';
const TEMPERATURE = 'assets/global-parameters/temperature.png';
const OXYGEN = 'assets/global-parameters/oxygen.png';
const VENUS = 'assets/global-parameters/venus.png';
const CARD = 'assets/resources/card.png';
const TR = 'assets/resources/tr.png';

const lastGeneration = computed(() => props.solo ? props.game.lastSoloGeneration : undefined);

function formatLevel(track: Track, value: number): string {
  const sign = value < 0 ? '−' : track.key === 'temperature' && value > 0 ? '+' : '';
  return `${sign}${Math.abs(value)}${track.unit}`;
}

function makeTrack(key: string, label: string, icon: string, unit: string, value: number, min: number, max: number, step: number, bonuses: Bonus[]): Track {
  const steps = Math.max(1, Math.round((max - min) / step));
  const placed: PlacedBonus[] = bonuses
    .filter((candidate) => candidate.at > min && candidate.at <= max)
    .sort((a, b) => a.at - b.at)
    .map((bonus) => {
      const index = Math.round((bonus.at - min) / step);
      const stepX = (index - 0.5) / steps;
      return {...bonus, step: index, stepX, chipX: stepX};
    });
  // Chips sit under their step; neighbours that would overlap are pushed apart, inside the bar.
  for (let i = 0; i < placed.length; i++) {
    const previous = placed[i - 1];
    placed[i].chipX = Math.max(placed[i].chipX, CHIP / 2, previous ? previous.chipX + CHIP : 0);
  }
  for (let i = placed.length - 1; i >= 0; i--) {
    const next = placed[i + 1];
    placed[i].chipX = Math.min(placed[i].chipX, 1 - CHIP / 2, next ? next.chipX - CHIP : 1);
  }
  return {key, label, icon, unit, value, min, max, steps, filled: Math.round((value - min) / step), bonuses: placed};
}

const tracks = computed<Track[]>(() => {
  const game = props.game;
  const max = getGlobalParameterMaximums(game.gameOptions.boardName);
  const amazonis = game.gameOptions.boardName === BoardName.AMAZONIS_PLANITIA;
  const list = [
    makeTrack('temperature', 'Temperature', TEMPERATURE, '°C', game.temperature, MIN_TEMPERATURE, max.temperature, 2, [
      {at: TEMPERATURE_BONUS_FOR_HEAT_1, icon: HEAT, text: '+1', production: true, title: 'Heat production'},
      {at: TEMPERATURE_BONUS_FOR_HEAT_2, icon: HEAT, text: '+1', production: true, title: 'Heat production'},
      {at: TEMPERATURE_FOR_OCEAN_BONUS, icon: OCEAN, text: '+1', title: 'Ocean'},
    ]),
    makeTrack('oxygen', 'Oxygen Level', OXYGEN, '%', game.oxygenLevel, 0, max.oxygen, 1, amazonis ? [
      {at: OXYGEN_LEVEL_FOR_AMAZONIS_CARD_BONUS, icon: CARD, text: '+1', title: 'Draw a card'},
      {at: OXYGEN_LEVEL_FOR_AMAZONIS_TEMPERATURE_BONUS, icon: TEMPERATURE, text: '+1', title: 'Temperature'},
    ] : [
      {at: OXYGEN_LEVEL_FOR_TEMPERATURE_BONUS, icon: TEMPERATURE, text: '+1', title: 'Temperature'},
    ]),
    makeTrack('oceans', 'Oceans', OCEAN, '', game.oceans, 0, max.oceans, 1, []),
  ];
  if (game.gameOptions.expansions.venus) {
    list.push(makeTrack('venus', 'Venus Scale', VENUS, '%', game.venusScaleLevel, 0, max.venus, 2, [
      {at: VENUS_LEVEL_FOR_CARD_BONUS, icon: CARD, text: '+1', title: 'Draw a card'},
      {at: VENUS_LEVEL_FOR_TR_BONUS, icon: TR, text: '+1', title: 'Terraform rating'},
    ]));
  }
  return list;
});
</script>

<style scoped lang="less">
.mission-params {
  position: absolute;
  z-index: 9;
  top: clamp(56px, 7dvh, 70px);
  right: clamp(12px, 2vw, 30px);
  display: grid;
  width: 300px;
  min-height: 0;
  overflow-y: auto;
  align-content: start;
  gap: 8px;
  padding: 10px 12px 12px;
  border: 1px solid #8aa5af80;
  border-radius: 10px;
  background: linear-gradient(#142330f0, #0a1219f0);
  box-shadow: inset 0 1px 0 #ffffff1c, 0 10px 26px #000a;
  color: #eef4f6;
  overscroll-behavior-y: contain;
  scrollbar-width: thin;
  scrollbar-color: #7793a4 transparent;

  &:focus-visible {
    outline: 2px solid #8bcad8;
    outline-offset: 2px;
  }
}

.mission-params__generation {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding-bottom: 6px;
  border-bottom: 1px solid #ffffff1f;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;

  strong {
    font-size: 1.3rem;
    letter-spacing: 0;
  }

  small {
    color: #a9bac2;
  }
}

.mission-params__track--done .mission-params__value {
  color: #8dffb9;
}

.mission-params__track {
  --track-light: #ffd479;
  --track-mid: #ee9c39;
  --track-dark: #a84c14;
  --bonus-height: 35px;
  --lead-height: 9px;

  & + & {
    padding-top: 7px;
    border-top: 1px solid #ffffff1a;
  }

  &[data-parameter='oxygen'] {
    --track-light: #ebf697;
    --track-mid: #9ebc49;
    --track-dark: #577525;
  }

  &[data-parameter='oceans'] {
    --track-light: #a4e3ff;
    --track-mid: #489edb;
    --track-dark: #1c569b;
  }

  &[data-parameter='venus'] {
    --track-light: #9ef7fb;
    --track-mid: #27bfdb;
    --track-dark: #147891;
  }
}

.mission-params__head {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 0.98rem;

  img {
    flex: none;
    width: 27px;
    height: 27px;
    object-fit: contain;
  }
}

.mission-params__label {
  flex: 1;
  min-width: 0;
  font-weight: 700;
  line-height: 1.15;
  overflow-wrap: anywhere;
}

.mission-params__reading {
  display: flex;
  align-items: baseline;
  flex: none;
  gap: 4px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;

  small {
    color: #c3d3dc;
    font-size: 0.76rem;
  }
}

.mission-params__value {
  font-size: clamp(1.38rem, 2.9dvh, 1.8rem);
  line-height: 1;
}

.mission-params__bar {
  display: grid;
  height: clamp(27px, 4.5dvh, 48px);
  margin-top: 5px;
  grid-template-columns: repeat(var(--steps), minmax(0, 1fr));
  gap: 2px;
}

.mission-params__step {
  border-radius: 3px;
  background: linear-gradient(#3b4852, #202b34);
  box-shadow: inset 0 1px 0 #c8e1eb40, inset 0 -2px 0 #080e15a6;

  &--filled {
    background: linear-gradient(var(--track-light), var(--track-mid) 52%, var(--track-dark));
    box-shadow: inset 0 1px 0 #ffffffa6, inset 0 -2px 0 #0005;
  }

  // The step that grants a bonus.
  &--bonus {
    outline: 1px solid #fff0c1;
    outline-offset: -1px;
  }
}

.mission-params__bonuses {
  position: relative;
  height: calc(var(--lead-height) + var(--bonus-height));
}

// Elbow from the bonus step down to its chip.
.mission-params__lead {
  position: absolute;
  top: 0;
  left: ~"calc(min(var(--from), var(--to)) * 100%)";
  width: ~"calc(max(var(--from) - var(--to), var(--to) - var(--from)) * 100%)";
  height: var(--lead-height);
  border: 1px solid #e4c67f;
  border-top: 0;
  border-radius: 0 0 3px 3px;

  &--used {
    border-color: #83a7b8;
  }
}

.mission-params__bonus {
  position: absolute;
  top: var(--lead-height);
  left: calc(var(--x) * 100%);
  display: flex;
  width: calc(var(--bonus-width) - 3px);
  height: var(--bonus-height);
  align-items: center;
  justify-content: center;
  gap: 2px;
  white-space: nowrap;
  border: 1px solid #e4c67f;
  border-radius: 6px;
  background: linear-gradient(#243c4a, #14252f);
  color: #f5fafc;
  font-size: 0.875rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  transform: translateX(-50%);

  img {
    flex: none;
    width: 22px;
    height: 22px;
    object-fit: contain;
  }

  &--used {
    border-color: #83a7b8;
  }
}

.mission-params__bonus-text {
  color: #bfe9f2;
}

.mission-params__bonus-production {
  padding: 2px;
  border: 1px solid #d79a5a;
  border-radius: 3px;
  background: #8a5a2b;
}

.mission-params__buttons {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  padding-top: 8px;
  border-top: 1px solid #ffffff1f;

  :slotted(button) {
    display: flex;
    min-height: 34px;
    align-items: center;
    justify-content: center;
    min-width: 0;
    gap: 4px;
    padding: 4px 5px;
    border: 1px solid #6f8c98;
    border-radius: 6px;
    background: linear-gradient(#1b2e3d, #0d1720);
    color: #eef6f8;
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0;
    line-height: 1.15;
    text-align: center;
    text-transform: uppercase;
    overflow-wrap: anywhere;
    cursor: pointer;
  }

  :slotted(button:hover),
  :slotted(button:focus-visible) {
    outline: none;
    border-color: #b4ffeb;
    background: #1f3c48;
  }

  :slotted(.lit) {
    border-color: #e2c27f;
    box-shadow: 0 0 10px #e2c27f66;
  }

  :slotted(.primary) {
    grid-column: 1 / -1;
    border-color: #e2c27f;
    background: linear-gradient(#5a4116, #2f220c);
  }
}

@media (max-width: 760px) {
  .mission-params {
    top: 8px;
    width: 200px;
    gap: 5px;
    padding: 6px 8px 8px;
  }

  .mission-params__track {
    --bonus-height: 42px;
    --lead-height: 6px;
  }

  .mission-params__head {
    gap: 4px;
    font-size: 0.82rem;

    img {
      width: 20px;
      height: 20px;
    }
  }

  .mission-params__reading {
    gap: 3px;

    small {
      font-size: 0.62rem;
    }
  }

  .mission-params__value {
    font-size: 1.22rem;
  }

  .mission-params__bar {
    height: clamp(20px, 3.6dvh, 32px);
  }

  .mission-params__bonus {
    display: grid;
    grid-template-columns: auto auto;
    align-content: center;
    justify-items: center;
    gap: 2px 4px;
    font-size: 0.82rem;

    img {
      width: 17px;
      height: 17px;
    }
  }

  .mission-params__bonus-at {
    grid-column: 1 / -1;
  }
}
</style>

