<template>
  <!-- Terraform rating of every player, as the track around the board: one marker per player. -->
  <section class="tr-track" :aria-label="$t('Terraform Rating')">
    <span class="tr-track__title" v-i18n>Terraform Rating</span>
    <div class="tr-track__rail">
      <span v-for="tick in ticks" :key="tick" class="tr-track__tick" :style="{left: position(tick)}">
        <small>{{ tick }}</small>
      </span>
      <span v-for="marker in markers" :key="marker.color" class="tr-track__marker"
        :class="['player_bg_color_' + marker.color, {'tr-track__marker--me': marker.color === myColor}]"
        :style="{left: position(marker.tr), top: (2 + marker.stack * 7) + 'px'}"
        :title="marker.name + ': ' + $t('TR') + ' ' + marker.tr">
        {{ marker.tr }}
      </span>
    </div>
  </section>
</template>

<script setup lang="ts">
import {computed} from 'vue';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';

/*
 * The terraform rating track at the top centre of the game screen: a rail with a marker per
 * player at their TR. The rail shows the part of the track the players are on (at least 30 steps).
 */
const props = defineProps<{players: ReadonlyArray<PublicPlayerModel>, myColor: Color}>();

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

const ticks = computed(() => {
  const result: Array<number> = [];
  for (let tick = range.value.low; tick <= range.value.high; tick += 5) {
    result.push(tick);
  }
  return result;
});

function position(value: number): string {
  const {low, high} = range.value;
  return `${((value - low) / (high - low)) * 100}%`;
}

/** Players on the same step are stacked a little, so every marker shows. */
const markers = computed(() => {
  const seen = new Map<number, number>();
  return props.players.map((player) => {
    const stack = seen.get(player.terraformRating) ?? 0;
    seen.set(player.terraformRating, stack + 1);
    return {color: player.color, name: player.name, tr: player.terraformRating, stack};
  });
});
</script>

<style scoped lang="less">
.tr-track {
  position: absolute;
  z-index: 12;
  top: 6px;
  left: 50%;
  display: flex;
  width: min(620px, 46vw);
  align-items: center;
  gap: 12px;
  padding: 6px 14px 18px;
  border: 1px solid #c9a35d88;
  border-radius: 10px;
  background: #0b131be6;
  box-shadow: 0 6px 18px #000a;
  color: #f6e2b8;
  transform: translateX(-50%);
  pointer-events: auto;
}

.tr-track__title {
  flex: none;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.tr-track__rail {
  position: relative;
  height: 34px;
  flex: 1;
  margin: 0 12px;
  border-bottom: 3px solid #e2c27f;
}

.tr-track__tick {
  position: absolute;
  bottom: -3px;
  width: 1px;
  height: 9px;
  background: #e2c27f;

  small {
    position: absolute;
    top: 11px;
    left: 50%;
    color: #b9a77f;
    font-size: 0.62rem;
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
  font-weight: 800;
  text-shadow: 0 1px 2px #000;
  transform: translateX(-50%);
  transition: left 600ms ease;

  &--me {
    z-index: 1;
    border-color: #fff3c4;
    box-shadow: 0 0 8px #ffd36baa;
  }
}

@media (max-width: 760px) {
  .tr-track {
    display: none;
  }
}
</style>
