<template>
  <div v-if="missionCards" class="wf-component">
    <DecisionTiles :title="showtitle ? playerinput.title : undefined" :choices="playerChoices" :owns-heading="showtitle && showsave"
      @choose="selectedPlayer = playerinput.players[$event]" />
    <div v-if="showsave" class="wf-action">
      <AppButton type="submit" :title="playerinput.buttonLabel" :disabled="selectedPlayer === undefined" @click="saveData" />
    </div>
  </div>
  <div v-else>
    <div v-if="showtitle === true">{{ $t(playerinput.title) }}</div>
    <label v-for="player in (playerinput.players || [])" :key="player" class="form-radio form-inline">
      <input type="radio" v-model="selectedPlayer" :value="player">
      <i class="form-icon"></i>
      <SelectPlayerRow :player="playerView.players.find((otherPlayer) => otherPlayer.color === player)" />
    </label>
    <AppButton v-if="showsave === true" size="big" @click="saveData" :title="$t(playerinput.buttonLabel)" />
  </div>
</template>

<script lang="ts">

import {defineComponent, inject, Ref} from 'vue';
import AppButton from '@/client/components/common/AppButton.vue';
import DecisionTiles from '@/client/components/board/DecisionTiles.vue';
import {DecisionChoice, decisionPlayerChoices} from '@/client/components/board/DecisionChoice';
import {SelectPlayerModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import SelectPlayerRow from '@/client/components/SelectPlayerRow.vue';
import {SelectPlayerResponse} from '@/common/inputs/InputResponse';
import {ColorWithNeutral} from '@/common/Color';

type DataModel = {
  selectedPlayer: ColorWithNeutral | undefined;
}

export default defineComponent({
  name: 'SelectPlayer',
  setup: () => ({missionCards: inject<Ref<boolean>>('missionCards')}),
  props: {
    playerView: {
      type: Object as () => PlayerViewModel,
      required: true,
    },
    playerinput: {
      type: Object as () => SelectPlayerModel,
      required: true,
    },
    onsave: {
      type: Function as unknown as () => (out: SelectPlayerResponse) => void,
      required: true,
    },
    showsave: {
      type: Boolean,
    },
    showtitle: {
      type: Boolean,
    },
  },
  data(): DataModel {
    return {
      selectedPlayer: undefined,
    };
  },
  components: {
    SelectPlayerRow,
    AppButton,
    DecisionTiles,
  },
  computed: {
    playerChoices(): ReadonlyArray<DecisionChoice> {
      return decisionPlayerChoices(this.playerinput.players, this.playerView.players, this.selectedPlayer);
    },
  },
  methods: {
    saveData() {
      if (this.selectedPlayer === undefined) {
        return;
      }
      this.onsave({type: 'player', player: this.selectedPlayer});
    },
  },
});

</script>
