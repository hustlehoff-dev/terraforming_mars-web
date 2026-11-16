<template>
  <!-- One card to pick from (e.g. to discard) or skip: just the cards, then two plain buttons. -->
  <div v-if="cardPick" class="card-pick">
    <h2 v-if="showtitle" class="card-pick__title">{{ $t(playerinput.title) }}</h2>
    <div class="card-pick__cards">
      <button v-for="card in cardPick.option.cards" :key="card.name" type="button" class="card-pick__card"
        :class="{'card-pick__card--picked': pickedCard === card.name, 'card-pick__card--other': pickedCard !== undefined && pickedCard !== card.name}"
        :aria-pressed="pickedCard === card.name" @click="pickedCard = pickedCard === card.name ? undefined : card.name">
        <Card :card="card" />
      </button>
    </div>
    <div class="card-pick__buttons">
      <button v-for="skip in cardPick.skips" :key="skip.index" type="button" class="card-pick__button" :disabled="requestInProgress"
        @click="playerFactorySaved(skip.index)({type: 'option'})">{{ $t(skip.title) }}</button>
      <button type="button" class="card-pick__button card-pick__button--main" :disabled="pickedCard === undefined || requestInProgress"
        @click="playerFactorySaved(cardPick.index)({type: 'card', cards: [pickedCard!]})">
        {{ pickedCard === undefined ? $t('Click a card') : $t(cardPick.option.buttonLabel) + ': ' + $t(pickedCard) }}
      </button>
    </div>
  </div>
  <div v-else-if="tileChoices" class="decision-options">
    <DecisionTiles :title="tileTitle" :warning="playerinput.warning" :choices="decisionChoices" :busy="requestInProgress"
      :owns-heading="showtitle && showsave" @choose="chooseTile" />
    <PlayerInputFactory v-if="selectedOption && !isImmediateChoice(selectedOption)" :key="selectedIdx"
      class="decision-options__detail" ref="inputfactory" :playerView="playerView" :playerinput="selectedOption"
      :onsave="playerFactorySaved(selectedIdx)" :showsave="showsave && showChildSaveButton(selectedOption)" :showtitle="false" />
    <div v-if="showsave && selectedOption && !isImmediateChoice(selectedOption) && selectedOption.type !== 'space' && !showChildSaveButton(selectedOption)" class="wf-action">
      <AppButton :title="selectedOption.buttonLabel" type="submit" @click="saveData" />
    </div>
    <AppButton v-if="canCancelMapChoice && !mapPlacement?.cancel" title="Cancel" @click="clearSelection" />
  </div>
  <div v-else class="wf-options">
    <label v-if="showtitle"><div>{{ $t(playerinput.title) }}</div></label>
    <label v-if="playerinput.warning !== undefined" class="card-warning"><div>({{ $t(playerinput.warning) }})</div></label>
    <div v-for="(option, idx) in displayedOptions" :key="idx">
      <label class="form-radio" ref="optionLabels" @click="chooseAtOnce(option, idx, $event)">
        <input v-model="selectedOption" type="radio" :name="radioElementName" :value="option">
        <i class="form-icon"></i>
        <span>{{ $t(option.title) }}</span>
      </label>
      <div v-if="selectedIdx === idx" style="margin-left: 30px">
        <PlayerInputFactory ref="inputfactory"
          :playerView="playerView"
          :playerinput="option"
          :onsave="playerFactorySaved(idx)"
          :showsave="showsave && showChildSaveButton(option)"
          :showtitle="false" />
      </div>
    </div>
    <button v-if="canCancelMapChoice && !mapPlacement?.cancel" type="button" @click="clearSelection" v-i18n>Cancel</button>
    <div v-if="showsave && selectedOption && !canCancelMapChoice && !showChildSaveButton(selectedOption)">
      <div style="margin: 5px 30px 10px" class="wf-action">
        <AppButton :title="$t(selectedOption.buttonLabel)" type="submit" size="normal" @click="saveData" />
      </div>
    </div>
  </div>
</template>

<script lang="ts">

import {defineComponent, inject, Ref} from 'vue';
import AppButton from '@/client/components/common/AppButton.vue';
import Card from '@/client/components/card/Card.vue';
import {CardName} from '@/common/cards/CardName';
import DecisionTiles from '@/client/components/board/DecisionTiles.vue';
import {DecisionChoice, decisionChoice} from '@/client/components/board/DecisionChoice';
import {actionMenu} from '@/client/components/board/MissionQuickAction';
import {vueRoot} from '@/client/components/vueRoot';
import {isHTMLElement} from '@/client/utils/vueUtils';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {OrOptionsModel, PlayerInputModel, SelectCardModel} from '@/common/models/PlayerInputModel';
import {getPreferences} from '@/client/utils/PreferencesManager';
import {InputResponse, OrOptionsResponse} from '@/common/inputs/InputResponse';
import {isGreeneryChoice, mapPlacementKey} from '@/client/components/board/MapPlacement';

let unique = 0;
const WORLD_GOVERNMENT_TITLE = 'Select action for World Government Terraforming';

function isDisplayed(option: PlayerInputModel): boolean {
  return !(option.type === 'card' && option.showOnlyInLearnerMode !== false && !getPreferences().learner_mode);
}

export default defineComponent({
  name: 'OrOptions',
  setup: () => ({
    mapPlacement: inject(mapPlacementKey, undefined),
    missionCards: inject<Ref<boolean>>('missionCards'),
    cardDialog: inject<Ref<boolean>>('cardDialog'),
  }),
  props: {
    playerView: {
      type: Object as () => PlayerViewModel,
      required: true,
    },
    playerinput: {
      type: Object as () => OrOptionsModel,
      required: true,
    },
    onsave: {
      type: Function as unknown as () => (out: OrOptionsResponse) => void,
      required: true,
    },
    showsave: {
      type: Boolean,
    },
    showtitle: {
      type: Boolean,
    },
  },
  components: {
    AppButton,
    Card,
    DecisionTiles,
  },
  data() {
    const displayedOptions = this.playerinput.options.filter(isDisplayed);
    const initialIdx = this.playerinput.initialIdx ?? 0;
    // Special case: If the first recommended displayed option is SelectProjectCardToPlay, and none of them are enabled, skip it.
    let selectedIdx = initialIdx;
    if (displayedOptions.length > 1 &&
      displayedOptions[initialIdx]?.type === 'projectCard' &&
      !displayedOptions[initialIdx].cards.some((card) => card.isDisabled !== true)) {
      selectedIdx = initialIdx + 1;
    }
    return {
      pickedCard: undefined as CardName | undefined,
      radioElementName: 'selectOption' + unique++,
      selectedOption: this.defaultOption(displayedOptions[selectedIdx], displayedOptions),
    };
  },
  computed: {
    displayedOptions(): Array<PlayerInputModel> {
      return this.playerinput.options.filter(isDisplayed);
    },
    originalIndices(): Array<number> {
      return this.displayedOptions.map((option) => this.playerinput.options.indexOf(option));
    },
    selectedIdx(): number {
      if (this.selectedOption === undefined) {
        return -1;
      }
      return this.displayedOptions.indexOf(this.selectedOption);
    },
    /**
     * In the game's windows: exactly one card to pick (one of a few) and the rest plain options
     * ("Do nothing"). Shown as the cards and two buttons instead of option tiles.
     */
    cardPick(): {index: number, option: SelectCardModel, skips: Array<{index: number, title: PlayerInputModel['title']}>} | undefined {
      if (!this.showsave || !(this.missionCards || this.cardDialog)) {
        return undefined;
      }
      const options = this.displayedOptions;
      const cards = options.filter((option) => option.type === 'card');
      const card = cards[0];
      if (cards.length !== 1 || card?.type !== 'card' || card.min !== 1 || card.max !== 1 || card.cards.length === 0 ||
        !options.every((option) => option === card || this.isImmediateChoice(option))) {
        return undefined;
      }
      return {
        index: options.indexOf(card),
        option: card,
        skips: options.flatMap((option, index) => option === card ? [] : [{index, title: option.title}]),
      };
    },
    worldGovernmentChoice(): boolean {
      return this.showsave && this.showtitle && this.playerinput.title === WORLD_GOVERNMENT_TITLE;
    },
    tileChoices(): boolean {
      return this.worldGovernmentChoice || (Boolean(this.missionCards || this.cardDialog) && actionMenu(this.playerinput) === undefined);
    },
    tileTitle(): PlayerInputModel['title'] | undefined {
      if (this.showtitle) {
        return this.worldGovernmentChoice ? 'World Government Terraforming' : this.playerinput.title;
      }
      return undefined;
    },
    decisionChoices(): ReadonlyArray<DecisionChoice> {
      return this.displayedOptions.map((option) => ({
        ...decisionChoice(option),
        selected: this.isImmediateChoice(option) ? undefined : option === this.selectedOption,
      }));
    },
    requestInProgress(): boolean {
      return vueRoot(this).isServerSideRequestInProgress;
    },
    canCancelMapChoice(): boolean {
      return this.showsave && (
        (this.worldGovernmentChoice && this.selectedOption?.type === 'space') ||
        (this.displayedOptions.length > 1 && isGreeneryChoice(this.selectedOption))
      );
    },
  },
  watch: {
    displayedOptions(newOptions: Array<PlayerInputModel>) {
      // Learner mode can hide the selected option.
      if (this.selectedOption !== undefined && !newOptions.includes(this.selectedOption)) {
        this.selectedOption = this.defaultOption(newOptions[0], newOptions);
      }
    },
    canCancelMapChoice(active: boolean) {
      const cancel = this.mapPlacement?.cancel;
      if (active && cancel) {
        cancel.value = this.clearSelection;
      } else if (cancel?.value === this.clearSelection) {
        cancel.value = undefined;
      }
    },
    selectedOption() {
      // Clicking the option can shift elements on the page.
      // This preserves the location of the option button the user just clicked by
      // tracking where it was on the screen, where it moved, and then repositioning it.
      const anchorTop = this.getSelectedOptionTop();
      this.$nextTick(() => {
        const newTop = this.getSelectedOptionTop();
        if (anchorTop !== undefined && newTop !== undefined) {
          const delta = newTop - anchorTop;
          if (Math.abs(delta) > 0.5) {
            window.scrollBy(0, delta);
          }
        }
      });
    },
  },
  beforeUnmount() {
    const cancel = this.mapPlacement?.cancel;
    if (cancel?.value === this.clearSelection) {
      cancel.value = undefined;
    }
  },
  methods: {
    // Takes the options explicitly: data() calls this before computed properties exist.
    defaultOption(option: PlayerInputModel | undefined, options: ReadonlyArray<PlayerInputModel>): PlayerInputModel | undefined {
      if (this.showsave && (options.length > 1 && isGreeneryChoice(option) || this.showtitle && this.playerinput.title === WORLD_GOVERNMENT_TITLE)) {
        return undefined;
      }
      if (this.showsave && (this.missionCards || this.cardDialog) && options.some((choice) => decisionChoice(choice).targetColor !== undefined)) {
        return undefined;
      }
      return option;
    },
    isImmediateChoice(option: PlayerInputModel): boolean {
      return this.showsave && option.type === 'option' && (option.warnings?.length ?? 0) === 0 && option.warning === undefined;
    },
    chooseTile(index: number) {
      const option = this.displayedOptions[index];
      if (this.isImmediateChoice(option)) {
        this.playerFactorySaved(index)({type: 'option'});
      } else {
        this.selectedOption = option;
      }
    },
    clearSelection() {
      this.selectedOption = undefined;
    },
    getSelectedOptionTop(): number | undefined {
      const element = this.getSelectedOptionLabelElement();
      return element?.getBoundingClientRect().top;
    },
    getSelectedOptionLabelElement(): HTMLElement | undefined {
      const idx = this.selectedIdx;
      const optionLabels = this.$refs.optionLabels as HTMLElement | HTMLElement[] | undefined;
      if (idx === -1 || !optionLabels) {
        return undefined;
      }

      const val = Array.isArray(optionLabels) ? optionLabels[idx] : optionLabels;
      return isHTMLElement(val) ? val : undefined;
    },
    playerFactorySaved(displayedIdx: number) {
      const idx = this.originalIndices[displayedIdx];
      return (out: InputResponse) => {
        return this.onsave({
          type: 'or',
          index: idx,
          response: out,
        });
      };
    },
    // When the child component is a multi-select card, let it render its own save button.
    // This allows the child to control the button label (e.g. "Sell 3 patents").
    showChildSaveButton(option: PlayerInputModel): boolean {
      return option.type === 'card' && !(option.max === 1 && option.min === 1);
    },
    /** In the game's HUD windows a plain option (no further input) is chosen with one click. */
    chooseAtOnce(option: PlayerInputModel, displayedIdx: number, event: MouseEvent) {
      const label = event.currentTarget;
      if (!this.showsave || option.type !== 'option' || (option.warnings?.length ?? 0) > 0 || !(label instanceof HTMLElement)) {
        return;
      }
      if (label.closest('#player-home.mission-cinematic, dialog.deck-choice-dialog') === null) {
        return;
      }
      event.preventDefault();
      this.playerFactorySaved(displayedIdx)({type: 'option'});
    },
    saveData() {
      let ref = this.$refs['inputfactory'] as {saveData: () => void} | Array<{saveData: () => void}>;
      if (Array.isArray(ref)) {
        ref = ref[0];
      }
      ref.saveData();
    },
  },
});

</script>

<style scoped lang="less">
.card-pick {
  display: grid;
  justify-items: center;
  gap: 18px;
  padding: 8px 0 4px;
}

.card-pick__title {
  margin: 0;
  padding: 0;
  color: #f6e2b8;
  font-size: 1.15rem;
  font-weight: 700;
  text-align: center;
  filter: none;
}

.card-pick__cards {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
}

.card-pick__card {
  padding: 0;
  border: 0;
  border-radius: 12px;
  background: none;
  cursor: pointer;
  transition: transform 150ms ease, filter 150ms ease;

  :deep(.card-container) {
    margin: 0 !important;
  }

  &:hover {
    transform: translateY(-4px);
  }

  &--picked {
    transform: translateY(-8px);

    :deep(.card-container) {
      box-shadow: 0 0 0 4px #e2c27f, 0 0 24px #e2c27f99 !important;
    }
  }

  &--other {
    filter: brightness(0.45) saturate(0.6);
  }
}

.card-pick__buttons {
  position: sticky;
  z-index: 3;
  bottom: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  padding: 14px 0 6px;
  background: radial-gradient(ellipse 360px 60px at 50% 70%, #0b131be6, transparent);
}

.card-pick__button {
  min-width: 180px;
  min-height: 46px;
  padding: 0 24px;
  border: 1px solid #49616d;
  border-radius: 9px;
  background: #142630;
  color: #eef6f8;
  font: inherit;
  font-weight: 800;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  cursor: pointer;

  &:hover:not(:disabled) {
    border-color: #92dbe5;
    background: #1d3945;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &--main {
    border-color: #e2c27f;
    color: #ffedc6;
  }
}

.decision-options__detail {
  width: 100%;
  max-width: 680px;
  margin: 14px auto 0;
}
</style>

