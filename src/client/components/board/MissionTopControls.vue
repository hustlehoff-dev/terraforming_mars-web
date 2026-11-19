<template>
  <div class="mission-top-controls">
    <MissionTrTrack :players="viewModel.players" :myColor="viewModel.color" :gameId="viewModel.id" :generation="viewModel.game.generation" />
    <MissionStandardProjects v-if="!placing" :actions="actions" :allProjects="viewModel.game.standardProjects" @select="emit('select', $event)" />
  </div>
</template>

<script setup lang="ts">
import {ViewModel} from '@/common/models/PlayerModel';
import {MissionQuickAction} from './MissionQuickAction';
import MissionTrTrack from './MissionTrTrack.vue';
import MissionStandardProjects from './MissionStandardProjects.vue';

defineProps<{viewModel: ViewModel, actions: ReadonlyArray<MissionQuickAction>, placing: boolean}>();
const emit = defineEmits<{select: [action: MissionQuickAction]}>();
</script>

<style scoped lang="less">
.mission-top-controls {
  position: absolute;
  z-index: 12;
  top: 6px;
  left: 50%;
  display: flex;
  width: min(1100px, 70vw);
  flex-direction: column;
  align-items: center;
  gap: 6px;
  transform: translateX(-50%);
  pointer-events: none;
}

// Keep the existing phone toolbar positioning; the TR rail is hidden there.
@media (max-width: 760px) {
  .mission-top-controls {
    position: static;
    display: contents;
    transform: none;
  }
}
</style>
