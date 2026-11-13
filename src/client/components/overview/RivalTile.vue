<template>
  <button type="button" class="rival-tile" :class="['rival-tile--' + player.color, {'rival-tile--active': active}]" :aria-current="active ? 'true' : undefined" aria-haspopup="dialog">
    <span class="rival-tile__identity">
      <span class="rival-tile__marker" :class="'player_bg_color_' + player.color" aria-hidden="true"></span>
      <span class="rival-tile__person">
        <span class="rival-tile__name" :title="player.name">{{ player.name }}</span>
        <span v-if="active" class="rival-tile__status" v-i18n>Now playing</span>
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
import ResourceIcon from '@/client/components/common/ResourceIcon.vue';
import {ALL_RESOURCES} from '@/common/Resource';
import {PublicPlayerModel} from '@/common/models/PlayerModel';

defineProps<{player: PublicPlayerModel, active?: boolean, passed?: boolean}>();
</script>
