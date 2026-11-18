<template>
  <Teleport to="body">
    <div class="mission-placement" :class="{'mission-placement--ready': ready}" role="status" aria-live="polite">
      <img v-if="tileImage" class="mission-placement__tile" :src="tileImage" alt="">
      <div class="mission-placement__text">
        <span class="mission-placement__caption" v-i18n>Current action</span>
        <strong class="mission-placement__title">{{ $t(title) }}</strong>
        <small v-if="ready" v-i18n>Select this sector to place the tile.</small>
        <small v-else v-i18n>Choose a highlighted sector.</small>
      </div>
      <button v-if="cancel" type="button" class="mission-placement__cancel" @click="cancel" v-i18n>Cancel</button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import {computed} from 'vue';
import {Message} from '@/common/logs/Message';

/*
 * The one banner for every tile placement on the map (greenery, ocean, city, special tiles):
 * what is being placed, with the tile's picture when the action names it, at the top centre.
 */
const props = defineProps<{title: string | Message, ready: boolean, cancel?: () => void}>();

const TILES: ReadonlyArray<[RegExp, string]> = [
  [/ocean|aquifer/, 'ocean'],
  [/greenery|forest/, 'greenery'],
  [/city/, 'city'],
];

const tileImage = computed(() => {
  const text = JSON.stringify(props.title).toLowerCase();
  const tile = TILES.find(([pattern]) => pattern.test(text))?.[1];
  return tile === undefined ? undefined : `assets/tiles/${tile}.png`;
});
</script>

<style lang="less">
.mission-placement {
  position: fixed;
  z-index: 30;
  top: 16px;
  left: 50%;
  display: flex;
  width: min(560px, calc(100vw - 32px));
  align-items: center;
  gap: 18px;
  padding: 14px 22px;
  border: 1px solid #b4ffeb;
  border-radius: 14px;
  background: linear-gradient(#152330f2, #0b131bf2);
  box-shadow: 0 0 0 1px #b4ffeb44, 0 0 26px #5fe6ff44, 0 18px 40px #000c;
  color: #eef6f8;
  pointer-events: none;
  transform: translateX(-50%);

  &--ready {
    border-color: #e2c27f;
  }
}

.mission-placement__tile {
  flex: none;
  width: 64px;
  height: 64px;
  object-fit: contain;
  filter: drop-shadow(0 0 10px #b4ffeb88);
  animation: mission-placement-pulse 1.6s ease-in-out infinite;
}

.mission-placement__text {
  display: grid;
  min-width: 0;
  gap: 2px;

  small {
    color: #b4ffeb;
    font-size: 0.9rem;
  }
}

.mission-placement__cancel {
  flex: none;
  min-height: 44px;
  margin-inline-start: auto;
  padding: 6px 12px;
  border: 1px solid #aac8c8;
  border-radius: 6px;
  background: #101b23;
  color: #f2f5f5;
  cursor: pointer;
  pointer-events: auto;
}

.mission-placement__caption {
  color: #9fb8c2;
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.mission-placement__title {
  color: #fff3c4;
  font-size: 1.35rem;
  font-weight: 800;
  line-height: 1.2;
}

@keyframes mission-placement-pulse {
  50% { transform: scale(1.08); }
}

@media (max-width: 760px) {
  .mission-placement {
    inset: auto 10px calc(var(--mobile-dock-height, 230px) + 8px);
    box-sizing: border-box;
    width: auto;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 8px;
    background: #0d202bed;
    box-shadow: 0 3px 12px #0008;
    transform: none;
  }

  .mission-placement__tile {
    width: 32px;
    height: 32px;
    animation: none;
    filter: none;
  }

  .mission-placement__caption { display: none; }
  .mission-placement__title {
    display: -webkit-box;
    overflow: hidden;
    font-size: 14px;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }
  .mission-placement__text small { font-size: 12px; line-height: 1.25; }
  .mission-placement__cancel { min-height: 36px; padding: 5px 8px; font-size: 13px; }
}
</style>
