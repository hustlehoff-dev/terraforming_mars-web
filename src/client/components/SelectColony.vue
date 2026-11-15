<template>
  <div class="wf-component wf-component--select-card colony-choice" :class="{'deck-deal': cardDialog}">
    <div v-if="showtitle === true" class="nofloat wf-component-title">{{ $t(playerinput.title) }}</div>
    <p class="nofloat colony-choice__hint" v-i18n>Click a colony to choose it.</p>
    <!-- The whole tile is the choice; the radio keeps it for the keyboard and screen readers. -->
    <label v-for="colony in (playerinput.coloniesModel || [])" class="cardbox colony-choice__option" :key="colony.name"
      :class="{'colony-choice__option--selected': selectedColony === colony.name}">
      <input class="colony-choice__radio" type="radio" v-model="selectedColony" :value="colony.name" :aria-label="$t(colony.name)">
      <Colony :colony="colony" :fadeMarker="playerinput.buttonLabel === 'Build'" />
      <span v-if="selectedColony === colony.name" class="colony-choice__check" aria-hidden="true">✓</span>
    </label>
    <div v-if="showsave === true" class="nofloat">
      <AppButton @click="saveData" :title="playerinput.buttonLabel" :disabled="!canSave()" />
    </div>
  </div>
</template>
<script lang="ts">
import {computed, defineComponent, inject} from 'vue';
import Colony from '@/client/components/colonies/Colony.vue';
import AppButton from '@/client/components/common/AppButton.vue';
import {SelectColonyModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {SelectColonyResponse} from '@/common/inputs/InputResponse';
import {ColonyName} from '@/common/colonies/ColonyName';

type DataModel = {
  selectedColony: ColonyName | undefined,
};

export default defineComponent({
  name: 'SelectColony',
  // In the card window the colonies are laid out like a deal of cards.
  setup: () => ({cardDialog: inject('cardDialog', computed(() => false))}),
  props: {
    playerView: {
      type: Object as () => PlayerViewModel,
      required: true,
    },
    playerinput: {
      type: Object as () => SelectColonyModel,
      required: true,
    },
    onsave: {
      type: Function as unknown as () => (out: SelectColonyResponse) => void,
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
      selectedColony: undefined,
    };
  },
  components: {
    Colony,
    AppButton,
  },
  methods: {
    canSave() {
      return this.selectedColony !== undefined;
    },
    saveData() {
      if (this.selectedColony !== undefined) {
        this.onsave({type: 'colony', colonyName: this.selectedColony});
      }
    },
  },
});
</script>

<style lang="less">
// Choosing a colony: tiles like cards in the card window; a click selects, the chosen one is raised
// with a gold frame and a check, the others step back.
.colony-choice {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: flex-start;
  gap: 14px;
}

.colony-choice__hint {
  flex-basis: 100%;
  margin: -6px 0 4px;
  color: #cfe0e6;
  font-size: 0.9rem;
  text-align: center;
}

.colony-choice__option {
  position: relative;
  margin: 0 !important;
  border-radius: 10px;
  cursor: pointer;
  transition: filter 160ms ease, transform 160ms ease;

  .colony-card {
    margin: 0;
    border-radius: 10px;
    box-shadow: 0 0 0 1px #6f8c98, 0 10px 24px #000a;
    zoom: 0.72;
  }

  &:hover .colony-card {
    box-shadow: 0 0 0 2px #b4ffeb, 0 10px 24px #000a;
  }

  &:focus-within {
    outline: 2px solid #e2c27f;
    outline-offset: 3px;
  }

  &--selected {
    transform: translateY(-6px);

    .colony-card,
    &:hover .colony-card {
      box-shadow: 0 0 0 4px #e2c27f, 0 0 22px #e2c27f99, 0 10px 24px #000a;
    }
  }
}

.colony-choice:has(.colony-choice__option--selected) .colony-choice__option:not(.colony-choice__option--selected) {
  filter: brightness(0.5) saturate(0.6);

  &:hover {
    filter: brightness(0.75) saturate(0.85);
  }
}

.colony-choice__radio {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.colony-choice__check {
  position: absolute;
  z-index: 5;
  top: -10px;
  right: -10px;
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 50%;
  background: #e2c27f;
  color: #1b1200;
  font-weight: 900;
  box-shadow: 0 2px 8px #000a;
}
</style>
