<template>
  <div class="card-art" :class="'card-art--' + theme.name" :style="style" aria-hidden="true">
    <span v-if="theme.planet" class="card-art__planet" :style="planetStyle"></span>
    <span class="card-art__shade"></span>
  </div>
</template>

<script setup lang="ts">
import {computed, CSSProperties} from 'vue';
import {Tag} from '@/common/cards/Tag';
import {CardName} from '@/common/cards/CardName';

/*
 * Illustration window for a card. The game has no per-card artwork, so each card gets a scene chosen
 * from its leading tag, cropped and framed differently per card name so neighbouring cards in a hand
 * do not look identical.
 */
const props = defineProps<{name: CardName, tags: ReadonlyArray<Tag>}>();

type Theme = {name: string, image: string, quadrant?: [number, number], planet?: ReadonlyArray<string>};

const PROJECTS = 'assets/board/mars-projects.jpg';
const ORBIT = 'assets/board/mars-orbit.jpg';
const STARS = 'assets/stars.jpg';
const planet = (name: string) => `assets/colonies-planets/${name}`;

const THEMES: Partial<Record<Tag, Theme>> = {
  [Tag.CITY]: {name: 'city', image: PROJECTS, quadrant: [0, 0]},
  [Tag.BUILDING]: {name: 'building', image: PROJECTS, quadrant: [0, 0]},
  [Tag.POWER]: {name: 'power', image: PROJECTS, quadrant: [1, 0]},
  [Tag.PLANT]: {name: 'plant', image: PROJECTS, quadrant: [0, 1]},
  [Tag.MICROBE]: {name: 'microbe', image: PROJECTS, quadrant: [0, 1]},
  [Tag.ANIMAL]: {name: 'animal', image: PROJECTS, quadrant: [0, 1]},
  [Tag.SCIENCE]: {name: 'science', image: PROJECTS, quadrant: [1, 1]},
  [Tag.JOVIAN]: {name: 'jovian', image: STARS, planet: ['io.jpg', 'europa.png', 'ganymede.jpg', 'callisto.png']},
  [Tag.EARTH]: {name: 'earth', image: STARS, planet: ['terra.jpg']},
  [Tag.VENUS]: {name: 'venus', image: STARS, planet: ['venus.jpg']},
  [Tag.MOON]: {name: 'moon', image: STARS, planet: ['luna.jpg']},
  [Tag.SPACE]: {name: 'space', image: ORBIT},
  [Tag.MARS]: {name: 'mars', image: ORBIT},
};
const FALLBACK: Theme = {name: 'mars', image: ORBIT};

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

const seed = computed(() => hash(props.name));
const theme = computed<Theme>(() => {
  for (const tag of props.tags) {
    const found = THEMES[tag];
    if (found !== undefined) {
      return found;
    }
  }
  return FALLBACK;
});

const style = computed<CSSProperties>(() => {
  const {image, quadrant} = theme.value;
  const s = seed.value;
  const jitterX = (s % 37) / 36;
  const jitterY = ((s >> 6) % 29) / 28;
  if (quadrant !== undefined) {
    // The project sheet is a 2 × 2 grid; zoom into one quadrant and pan within it.
    const zoom = 215 + (s >> 12) % 40;
    const span = 100 / (zoom / 100 * 2 - 1);
    return {
      backgroundImage: `url(${image})`,
      backgroundSize: `${zoom}% auto`,
      backgroundPosition: `${quadrant[0] * 100 + (quadrant[0] ? -1 : 1) * jitterX * span * 0.35}% ${quadrant[1] * 100 + (quadrant[1] ? -1 : 1) * jitterY * span * 0.35}%`,
    };
  }
  return {
    backgroundImage: `url(${image})`,
    backgroundSize: image === STARS ? '340px auto' : `${150 + (s >> 12) % 70}% auto`,
    backgroundPosition: `${jitterX * 100}% ${jitterY * 100}%`,
  };
});

const planetStyle = computed<CSSProperties>(() => {
  const planets = theme.value.planet ?? [];
  const s = seed.value;
  const size = 92 + (s >> 9) % 70;
  return {
    backgroundImage: `url(${planet(planets[s % planets.length])})`,
    width: `${size}px`,
    height: `${size}px`,
    left: `${8 + (s >> 4) % 60}%`,
    top: `${18 + (s >> 14) % 40}%`,
  };
});
</script>
