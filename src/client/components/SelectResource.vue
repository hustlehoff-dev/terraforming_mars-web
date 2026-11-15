<template>
  <div v-if="missionCards" class="wf-component">
    <DecisionTiles :title="showtitle ? playerinput.title : undefined" :choices="resourceChoices" :owns-heading="showtitle && showsave"
      @choose="unit = playerinput.include[$event]" />
    <div v-if="showsave" class="wf-action">
      <AppButton type="submit" :title="playerinput.buttonLabel" :disabled="!canSave()" @click="saveData" />
    </div>
  </div>
  <div v-else class="wf-component wf-options">
    <div v-if="showtitle === true" class="nofloat wf-component-title">{{ $t(playerinput.title) }}</div>
    <div class="form-group">
      <label v-for="included in playerinput.include" :key="included" class="form-inline d-flex align-items-center mb-2">
        <input type="radio" v-model="unit" :value="included" class="form-radio mr-2">
        <i :data-tooltip="included" :class="'resource_icon mr-2 tooltip tooltip-bottom resource_icon--' + included"></i>
        {{ $t(included) }}
      </label>
    </div>
    <div v-if="showsave === true" class="nofloat">
      <AppButton @click="saveData" :title="playerinput.buttonLabel" />
    </div>
  </div>
</template>
<script lang="ts">
import {defineComponent, inject, Ref} from 'vue';
import AppButton from '@/client/components/common/AppButton.vue';
import DecisionTiles from '@/client/components/board/DecisionTiles.vue';
import {DecisionChoice, decisionResourceIcon} from '@/client/components/board/DecisionChoice';
import {SelectResourceModel} from '@/common/models/PlayerInputModel';
import {SelectResourceResponse} from '@/common/inputs/InputResponse';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {Units} from '@/common/Units';

export default defineComponent({
  name: 'SelectResource',
  setup: () => ({missionCards: inject<Ref<boolean>>('missionCards')}),
  props: {
    playerView: {
      type: Object as () => PlayerViewModel,
      required: true,
    },
    playerinput: {
      type: Object as () => SelectResourceModel,
      required: true,
    },
    onsave: {
      type: Function as unknown as () => (out: SelectResourceResponse) => void,
      required: true,
    },
    showsave: {
      type: Boolean,
    },
    showtitle: {
      type: Boolean,
    },
  },
  data() {
    return {
      unit: undefined as keyof Units | undefined,
    };
  },
  components: {
    AppButton,
    DecisionTiles,
  },
  computed: {
    resourceChoices(): ReadonlyArray<DecisionChoice> {
      return this.playerinput.include.map((unit) => ({
        title: unit,
        icon: decisionResourceIcon(unit),
        selected: unit === this.unit,
      }));
    },
  },
  methods: {
    canSave() {
      return this.unit !== undefined;
    },
    saveData() {
      if (this.unit === undefined) {
        return;
      }
      this.onsave({type: 'resource', resource: this.unit});
    },
  },
});
</script>
