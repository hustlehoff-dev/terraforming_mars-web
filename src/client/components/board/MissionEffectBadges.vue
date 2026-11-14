<template>
  <Teleport to="body">
    <div class="mission-effect-badges" aria-live="polite">
      <div v-for="badge in badges" :key="badge.id" class="mission-effect-badge" :style="badge.style">
        <span class="mission-effect-badge__name" :class="'player_bg_color_' + badge.player">{{ badge.name }}</span>
        <span class="mission-effect-badge__gain" v-html="renderIcons(badge.effects)"></span>
        <span class="mission-effect-badge__card">{{ $t(badge.card) }}</span>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import {CSSProperties, ref} from 'vue';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {renderIcons} from '@/client/markdown/markdown';

/*
 * A short badge when a played card's effect gives something (e.g. Rover Construction: +2 M€ when
 * any city is placed): who got what from which card, shown beside that player's tile for a few
 * seconds. The activity feed reports the gains (its `triggers` event).
 */
const props = defineProps<{playerName: (color: Color) => string}>();
const emit = defineEmits<{shown: [card: CardName, player: Color]}>();

type Badge = {id: number, player: Color, name: string, card: CardName, effects: string, style: CSSProperties};
const badges = ref<Badge[]>([]);
let nextId = 0;

function anchor(player: Color, stack: number): CSSProperties {
  const row = document.querySelector(`.mission-players__row--${player}`)?.getBoundingClientRect();
  const top = (row ? row.top + row.height / 2 : 120) + stack * 40;
  const left = row ? row.right + 12 : 24;
  return {top: `${top}px`, left: `${left}px`};
}

function show(triggers: ReadonlyArray<{player: Color, card: CardName, effects: string}>) {
  const perPlayer = new Map<Color, number>();
  for (const trigger of triggers) {
    const stack = perPlayer.get(trigger.player) ?? 0;
    perPlayer.set(trigger.player, stack + 1);
    const badge = {id: nextId++, player: trigger.player, name: props.playerName(trigger.player), card: trigger.card, effects: trigger.effects, style: anchor(trigger.player, stack)};
    badges.value = [...badges.value, badge];
    emit('shown', trigger.card, trigger.player);
    window.setTimeout(() => {
      badges.value = badges.value.filter((candidate) => candidate.id !== badge.id);
    }, 3200);
  }
}

defineExpose({show});
</script>

<style lang="less">
.mission-effect-badges {
  position: fixed;
  z-index: 35;
  inset: 0;
  pointer-events: none;
}

.mission-effect-badge {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px 6px 6px;
  border: 1px solid #e2c27f;
  border-radius: 10px;
  background: linear-gradient(#1b2d3cf5, #0b141cf5);
  box-shadow: 0 0 18px #e2c27f66, 0 8px 20px #000b;
  color: #eef6f8;
  font-weight: 700;
  white-space: nowrap;
  transform: translateY(-50%);
  animation: mission-effect-badge 3.2s ease both;
}

.mission-effect-badge__name {
  padding: 2px 8px;
  border-radius: 6px;
  color: #fff;
  font-size: 0.8rem;
  text-shadow: 0 1px 2px #000;
}

.mission-effect-badge__gain {
  font-size: 1.05rem;
}

.mission-effect-badge__card {
  color: #ffe9bd;
  font-size: 0.8rem;
}

@keyframes mission-effect-badge {
  0% { opacity: 0; transform: translate(-12px, -50%) scale(0.9); }
  10% { opacity: 1; transform: translate(0, -50%) scale(1.06); }
  18% { transform: translate(0, -50%) scale(1); }
  82% { opacity: 1; }
  100% { opacity: 0; transform: translate(0, -80%); }
}
</style>
