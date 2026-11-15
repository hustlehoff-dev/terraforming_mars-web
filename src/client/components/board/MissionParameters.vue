<template>
  <section class="mission-params" :aria-label="$t('Global parameters')">
    <header class="mission-params__generation">
      <span v-i18n>Generation</span>
      <strong>{{ game.generation }}<template v-if="lastGeneration"> / {{ lastGeneration }}</template></strong>
      <small v-if="game.phase === 'action' && game.turn !== undefined">· <span v-i18n>Turn</span> {{ game.turn }}</small>
    </header>
    <div v-for="track in tracks" :key="track.key" class="mission-params__track" :class="{'mission-params__track--done': track.value >= track.max}">
      <div class="mission-params__head">
        <img :src="track.icon" alt="">
        <span class="mission-params__label">{{ $t(track.label) }}</span>
        <strong class="mission-params__value">{{ track.value }}{{ track.unit }}</strong>
        <small>/ {{ track.max }}{{ track.unit }}</small>
      </div>
      <div class="mission-params__bar" :style="{'--steps': track.steps}">
        <span v-for="step in track.steps" :key="step" class="mission-params__step"
          :class="{'mission-params__step--filled': step <= track.filled, 'mission-params__step--bonus': track.bonuses.some((bonus) => bonus.step === step)}"></span>
      </div>
      <!-- Bonuses under the bar, one row: each chip names its level and a line leads to its step. -->
      <div v-if="track.bonuses.length" class="mission-params__bonuses">
        <template v-for="bonus in track.bonuses" :key="bonus.at">
          <span class="mission-params__lead" :class="{'mission-params__lead--used': track.value >= bonus.at}"
            :style="{'--from': bonus.stepX, '--to': bonus.chipX}"></span>
          <span class="mission-params__bonus" :class="{'mission-params__bonus--used': track.value >= bonus.at}"
            :style="{'--x': bonus.chipX}" :title="$t(bonus.title) + ' (' + bonus.at + track.unit + ')'">
            <em class="mission-params__bonus-at">{{ bonus.at }}{{ track.unit }}</em>
            <img :src="bonus.icon" alt="" :class="{'mission-params__bonus-production': bonus.production}">
            <small v-if="bonus.text">{{ bonus.text }}</small>
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
 * Global parameters in the top-right corner: one compact track per parameter with its steps,
 * the current value and the bonus icons at the positions where the board grants them.
 */
const props = defineProps<{game: GameModel, solo: boolean}>();

type Bonus = {at: number, icon: string, title: string, text?: string, production?: boolean};
/** A bonus with the centre of its step and of its chip (fractions of the bar width). */
type PlacedBonus = Bonus & {step: number, stepX: number, chipX: number};
type Track = {key: string, label: string, icon: string, unit: string, value: number, min: number, max: number, steps: number, filled: number, bonuses: PlacedBonus[]};
/** Width of one bonus chip as a fraction of the bar. */
const CHIP = 0.32;

const HEAT = 'assets/resources/heat.png';
const OCEAN = 'assets/tiles/ocean.png';
const TEMPERATURE = 'assets/global-parameters/temperature.png';
const OXYGEN = 'assets/global-parameters/oxygen.png';
const VENUS = 'assets/global-parameters/venus.png';
const CARD = 'assets/resources/card.png';
const TR = 'assets/resources/tr.png';

const lastGeneration = computed(() => props.solo ? props.game.lastSoloGeneration : undefined);

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
      {at: TEMPERATURE_FOR_OCEAN_BONUS, icon: OCEAN, title: 'Ocean'},
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
  gap: 8px;
  padding: 10px 12px 12px;
  border: 1px solid #8aa5af80;
  border-radius: 10px;
  background: linear-gradient(#142330f0, #0a1219f0);
  box-shadow: inset 0 1px 0 #ffffff1c, 0 10px 26px #000a;
  color: #eef4f6;
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

.mission-params__head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;

  img {
    width: 22px;
    height: 22px;
    object-fit: contain;
  }

  small {
    color: #9fb1b9;
  }
}

.mission-params__label {
  flex: 1;
  color: #c9d6dc;
  font-weight: 600;
}

.mission-params__value {
  font-size: 1.15rem;
}

.mission-params__bar {
  position: relative;
  display: grid;
  height: 10px;
  margin-top: 8px;
  grid-template-columns: repeat(var(--steps), 1fr);
  gap: 2px;
}

.mission-params__step {
  border-radius: 2px;
  background: #ffffff1c;

  &--filled {
    background: linear-gradient(#ffcf7a, #e2862e);
    box-shadow: 0 0 6px #ffb05a66;
  }

  // The step that grants a bonus.
  &--bonus {
    outline: 1px solid #fff3c4;
    outline-offset: 1px;
  }
}

.mission-params__track:nth-of-type(3) .mission-params__step--filled {
  background: linear-gradient(#9fe8ff, #2f9fd6);
  box-shadow: 0 0 6px #5fc7ff66;
}

.mission-params__track:nth-of-type(4) .mission-params__step--filled {
  background: linear-gradient(#7ad7ff, #1f6fb8);
}

.mission-params__bonuses {
  position: relative;
  height: 40px;
}

// Elbow from the bonus step down to its chip.
.mission-params__lead {
  position: absolute;
  top: 0;
  left: ~"calc(min(var(--from), var(--to)) * 100%)";
  width: ~"calc(max(var(--from) - var(--to), var(--to) - var(--from)) * 100%)";
  height: 8px;
  border: 1px solid #fff3c4aa;
  border-top: 0;
  border-radius: 0 0 3px 3px;

  &--used {
    opacity: 0.3;
  }
}

.mission-params__bonus {
  position: absolute;
  top: 8px;
  left: calc(var(--x) * 100%);
  display: flex;
  width: calc(32% - 4px);
  height: 28px;
  overflow: hidden;
  align-items: center;
  justify-content: center;
  gap: 3px;
  white-space: nowrap;
  border: 1px solid #fff3c455;
  border-radius: 6px;
  background: #0b141ce6;
  transform: translateX(-50%);

  img {
    flex: none;
    width: 18px;
    height: 18px;
    object-fit: contain;
  }

  small {
    font-size: 0.72rem;
    font-weight: 800;
  }

  // Reached bonuses: dimmed but solid, so nothing shows through.
  &--used {
    border-color: #ffffff1f;
    color: #8a979d;

    img {
      filter: grayscale(1);
      opacity: 0.5;
    }

    .mission-params__bonus-at {
      color: #8a979d;
    }
  }
}

.mission-params__bonus-at {
  color: #fff3c4;
  font-size: 0.7rem;
  font-style: normal;
  font-weight: 800;
  white-space: nowrap;
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
}
</style>

