<template>
  <button type="button" class="rival-tile" :class="['rival-tile--' + player.color, {'rival-tile--active': active}]" :aria-current="active ? 'true' : undefined" aria-haspopup="dialog">
    <span class="rival-tile__identity">
      <span class="rival-tile__marker" :class="'player_bg_color_' + player.color" aria-hidden="true"></span>
      <span class="rival-tile__person">
        <span class="rival-tile__name" :title="player.name">{{ player.name }}</span>
        <span v-if="active" class="rival-tile__status">
          {{ $t('Now playing') }}
          <span v-if="secondsLeft !== undefined" class="rival-tile__clock" :class="{'rival-tile__clock--warn': secondsLeft <= 20}" role="timer"
            :aria-label="$t('Turn time left')">⏱ {{ clock }}</span>
        </span>
        <span v-else-if="passed" class="rival-tile__status" v-i18n>Passed</span>
      </span>
    </span>
    <span class="rival-tile__rating" :aria-label="$t('Terraform Rating')">{{ player.terraformRating }}</span>
    <span v-for="resource in ALL_RESOURCES" :key="resource" class="rival-tile__resource">
      <ResourceIcon :resource="resource" />
      <span :key="player[resource]" class="mission-status__value">{{ player[resource] }}</span>
    </span>
  </button>
</template>

<script setup lang="ts">
import {computed, onBeforeUnmount, ref} from 'vue';
import ResourceIcon from '@/client/components/common/ResourceIcon.vue';
import {ALL_RESOURCES} from '@/common/Resource';
import {PublicPlayerModel} from '@/common/models/PlayerModel';

const props = defineProps<{player: PublicPlayerModel, active?: boolean, passed?: boolean}>();

// The time left in this player's action turn, when the game has a turn time limit.
const now = ref(Date.now());
const ticker = window.setInterval(() => {
  now.value = Date.now();
}, 500);
onBeforeUnmount(() => window.clearInterval(ticker));
const secondsLeft = computed(() => {
  const deadline = props.player.turnDeadline;
  return deadline === undefined || !props.active ? undefined : Math.max(0, Math.ceil((deadline - now.value) / 1000));
});
const clock = computed(() => {
  const seconds = secondsLeft.value ?? 0;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
});
</script>
