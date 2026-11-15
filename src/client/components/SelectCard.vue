<template>
  <div class="wf-component wf-component--select-card"
    :class="{'deck-deal': playerinput.dealtFromDeck || cardDialog || draftLocked, 'draft-pick': draftPick, 'draft-pick--locked': draftLocked, 'buy-cards': buyingWindow}"
    :aria-busy="draftSubmitting || undefined">
    <div v-if="showtitle === true" class="nofloat wf-component-title">{{ $t(draftLocked ? 'Draft' : preludeChoice ? 'Choose the prelude to play' : playerinput.title) }}</div>
    <p v-if="preludeChoice && selectableCards.length > 1" class="nofloat prelude-choice__hint" v-i18n>Click a card, then Play.</p>
    <MissionDraftClock v-if="(draftPick || buyingCards) && playerView.game.draftDeadline !== undefined" :deadline="playerView.game.draftDeadline"
      :label="draftPick ? 'Time to pick a card' : 'Time to buy cards'" />
    <!-- Buying cards: what you have, what a card costs, what the chosen ones cost. -->
    <div v-if="buyingWindow" class="nofloat buy-cards__summary" :class="{'buy-cards__summary--short': buyCost > megacredits}" role="status">
      <span class="buy-cards__hint" v-i18n>Click the cards you want to buy.</span>
      <span class="buy-cards__facts">
        <span>{{ $t('You have') }} <b>{{ megacredits }} M€</b></span>
        <span>{{ $t('Card') }} <b>{{ cardCost }} M€</b></span>
        <span>{{ $t('Chosen') }} <b>{{ cardsSelected }}</b> → <b>{{ buyCost }} M€</b></span>
      </span>
    </div>
    <div v-if="playerinput.dealtFromDeck && !buyingWindow" class="deck-deal__origin" aria-hidden="true"></div>
    <component :is="draftLocked ? 'div' : 'label'" v-for="(card, index) in getOrderedCards()" :key="card.name"
      :class="[getCardBoxClass(card), {'cardbox--featured': featuredCards, 'draft-pick__card--selected': lockedPicks.has(card.name)}]"
      :style="playerinput.dealtFromDeck ? {'--deal-delay': Math.min(index, 10) * 65 + 'ms'} : undefined">
      <template v-if="!draftLocked && !card.isDisabled && !featuredCards && !nothingToChoose">
        <input v-if="selectOnlyOneCard" type="radio" v-model="cards" :value="card" :name="selectionGroup" :aria-label="$t(card.name)"
          :disabled="draftSubmitting" @click="submitDraftPick(card)" @change="submitDraftPick(card)">
        <input v-else type="checkbox" v-model="cards" :value="card" :aria-label="$t(card.name)"
          :disabled="draftSubmitting || (playerinput.max !== undefined && Array.isArray(cards) && cards.length >= playerinput.max && cards.includes(card) === false)"
          @change="submitDraftPick()">
      </template>
      <Card :card="draftLocked && lockedPicks.has(card.name) ? {...card, isDisabled: false} : card"
        :actionUsed="isCardActivated(card)" :robotCard="robotCard(card)">
        <template v-if="playerinput.showOwner">
          <div :class="'card-owner-label player_translucent_bg_color_'+ getOwner(card).color">
            {{ getOwner(card).name }}
          </div>
        </template>
      </Card>
      <span v-if="lockedPicks.has(card.name)" class="draft-pick__selected" v-i18n>Selected</span>
    </component>
    <div v-if="hasCardWarning()" class="card-warning" v-i18n>{{ warning }}</div>
    <WarningsComponent :warnings="warnings" />
    <div v-if="showsave === true && !draftPick" class="nofloat">
      <AppButton v-if="showSelectAll" @click="toggleSelectAll" type="submit" :title="allSelected ? $t('Deselect All') : $t('Select All')" />
      <!-- Optional choice from the project deck: one card offers Buy / Pass; several cards turn Pass into "Buy N" as they are selected. -->
      <!-- Nothing can be taken (e.g. no M€ to buy the drawn cards): one OK, no selection. -->
      <AppButton v-if="nothingToChoose" type="submit" @click="onsave({type: 'card', cards: []})" :title="$t('OK')" />
      <AppButton v-else-if="allGiven" type="submit" @click="onsave({type: 'card', cards: selectableCards.map((card) => card.name)})"
        :title="preludeChoice ? playLabel(selectableCards[0]) : $t('OK')" />
      <AppButton v-else-if="preludeChoice" type="submit" @click="saveData" :disabled="cardsSelected === 0"
        :title="cardsSelected === 0 ? $t('Choose a prelude') : playLabel(Array.isArray(cards) ? cards[0] : cards)" />
      <template v-else-if="optionalDeckChoice && selectableCards.length === 1">
        <AppButton type="submit" @click="onsave({type: 'card', cards: [selectableCards[0].name]})" :title="$t(playerinput.buttonLabel)" />
        <AppButton type="submit" @click="onsave({type: 'card', cards: []})" :title="$t('Pass')" />
      </template>
      <AppButton v-else-if="buyingWindow" type="submit" @click="saveData" :disabled="buyCost > megacredits" :title="buyButtonLabel" />
      <AppButton v-else-if="optionalDeckChoice" type="submit" @click="saveData" :title="cardsSelected === 0 ? $t('Pass') : buttonLabel" />
      <template v-else>
        <AppButton :disabled="(isOptionalToManyCards && cardsSelected === 0) || (playerinput.dealtFromDeck === true && cardsSelected < playerinput.min)"
          type="submit" @click="saveData" :title="buttonLabel" />
        <AppButton :disabled="isOptionalToManyCards && cardsSelected > 0" v-if="isOptionalToManyCards" @click="saveData" type="submit" :title="$t('Skip this action')" />
      </template>
    </div>
  </div>
</template>

<script lang="ts">

import {computed, defineComponent, inject, useId} from 'vue';
import AppButton from '@/client/components/common/AppButton.vue';
import WarningsComponent from '@/client/components/WarningsComponent.vue';
import {Color} from '@/common/Color';
import {Message} from '@/common/logs/Message';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {CardOrderStorage} from '@/client/utils/CardOrderStorage';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import Card from '@/client/components/card/Card.vue';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {SelectCardModel} from '@/common/models/PlayerInputModel';
import {sortActiveCards} from '@/client/utils/ActiveCardsSortingOrder';
import {SelectCardResponse} from '@/common/inputs/InputResponse';
import {Warning} from '@/common/cards/Warning';
import {Phase} from '@/common/Phase';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import MissionDraftClock from '@/client/components/board/MissionDraftClock.vue';
import {isDraftRepick} from '@/client/components/board/MissionQuickAction';
import {recallChoice, rememberChoice} from '@/client/utils/choiceMemory';

type Owner = {
  name: string;
  color: Color;
}

type WidgetDataModel = {
  // The selected item or items
  cards: CardModel | Array<CardModel>;
  draftSubmitting: boolean;
  warning: string | Message | undefined;
  warnings: ReadonlyArray<Warning> | undefined;
  owners: Map<CardName, Owner>,
}

export default defineComponent({
  name: 'SelectCard',
  setup: () => ({selectionGroup: useId(), cardDialog: inject('cardDialog', computed(() => false))}),
  emits: ['cardschanged'],
  props: {
    playerView: {
      type: Object as () => PlayerViewModel,
      required: true,
    },
    playerinput: {
      type: Object as () => SelectCardModel,
      required: true,
    },
    onsave: {
      type: Function as unknown as () => (out: SelectCardResponse) => void | Promise<void>,
      required: true,
    },
    showsave: {
      type: Boolean,
      required: false,
      default: false,
    },
    showtitle: {
      type: Boolean,
    },
  },
  data(): WidgetDataModel {
    return {
      cards: [],
      draftSubmitting: false,
      warning: undefined,
      owners: new Map(),
      warnings: undefined,
    };
  },
  components: {
    Card,
    WarningsComponent,
    AppButton,
    MissionDraftClock,
  },
  mounted() {
    // A page reload keeps the cards ticked before it (draft picks are sent at once, nothing to keep).
    if (this.draftPick || this.draftLocked) {
      return;
    }
    const names = recallChoice<Array<CardName>>(this.question);
    if (!Array.isArray(names) || names.length === 0) {
      return;
    }
    const chosen = this.playerinput.cards.filter((card) => names.includes(card.name) && !card.isDisabled);
    if (chosen.length === 0) {
      return;
    }
    this.cards = this.selectOnlyOneCard ? chosen[0] : chosen.slice(0, this.playerinput.max ?? chosen.length);
  },
  watch: {
    cards() {
      this.$emit('cardschanged', this.cardNames);
      if (!this.draftPick && !this.draftLocked) {
        rememberChoice(this.question, this.cardNames);
      }
    },
  },
  methods: {
    playLabel(card: CardModel | undefined): string {
      return card === undefined ? translateText('Play') : translateTextWithParams('Play ${0}', [translateText(card.name)]);
    },
    getOrderedCards(): ReadonlyArray<CardModel> {
      if (this.playerinput.dealtFromDeck || this.draftLocked) {
        return this.playerinput.cards;
      }
      let cards: ReadonlyArray<CardModel> = [];
      if (this.playerinput.cards !== undefined) {
        if (this.playerinput.selectBlueCardAction) {
          cards = sortActiveCards(this.playerinput.cards);
        } else {
          cards = CardOrderStorage.getOrdered(
            CardOrderStorage.getCardOrder(this.playerView.id),
            this.playerinput.cards,
          );
        }
      }

      if (this.playerinput.showOwner) {
        // Optimization so getOwners isn't repeatedly called.
        this.owners.clear();
        this.playerinput.cards.forEach((card) => {
          const owner = this.findOwner(card);
          if (owner !== undefined) {
            this.owners.set(card.name, owner);
          }
        });
      }
      return cards;
    },
    hasCardWarning() {
      // This is pretty clunky, to be honest.
      if (Array.isArray(this.cards)) {
        if (this.cards.length === 1) {
          this.warnings = this.cards[0].warnings;
        }
        return false;
      } else if (typeof this.cards === 'object') {
        this.warnings = this.cards.warnings;
      }
      return false;
    },

    canSave() {
      const len = this.cardNames.length;
      if (len > this.playerinput.min) {
        return false;
      }
      if (len < this.playerinput.max) {
        return false;
      }
      return true;
    },
    saveData() {
      return this.onsave({type: 'card', cards: this.cardNames});
    },
    async submitDraftPick(card?: CardModel) {
      if (!this.draftPick || this.draftSubmitting) {
        return;
      }
      if (card !== undefined) {
        this.cards = card;
      }
      if (this.cardsSelected === this.playerinput.min) {
        this.draftSubmitting = true;
        try {
          await this.saveData();
        } finally {
          this.draftSubmitting = false;
        }
      }
    },
    getCardBoxClass(card: CardModel): string {
      if (this.playerinput.showOwner && this.getOwner(card) !== undefined) {
        return 'cardbox cardbox-with-owner-label';
      }
      return 'cardbox';
    },
    findOwner(card: CardModel): Owner | undefined {
      for (const player of this.playerView.players) {
        if (player.tableau.find((c) => c.name === card.name)) {
          return {name: player.name, color: player.color};
        }
      }
      return undefined;
    },
    getOwner(card: CardModel): Owner {
      return this.owners.get(card.name) ?? {name: 'unknown', color: 'neutral'};
    },
    isCardActivated(card: CardModel): boolean {
      // Copied from PlayerMixin.
      return this.playerView.thisPlayer.actionsThisGeneration.includes(card.name);
    },
    robotCard(card: CardModel): CardModel | undefined {
      return this.playerView.thisPlayer.selfReplicatingRobotsCards?.find((r) => r.name === card.name);
    },
    toggleSelectAll() {
      if (this.allSelected) {
        this.cards = [];
      } else {
        this.cards = this.selectableCards.slice();
      }
    },
  },
  computed: {
    /** Buying the drafted or dealt cards in the research phase (may have a time limit). */
    buyingCards(): boolean {
      return this.playerinput.dealtFromDeck === true && this.playerView.game.phase === Phase.RESEARCH;
    },
    /** The window to buy cards in the research phase (not the first choice of the game, which has its own summary). */
    buyingWindow(): boolean {
      return this.buyingCards && this.showsave === true && this.playerView.game.generation > 1;
    },
    /** Choosing which prelude to play (start of the game, or a card that plays one). */
    preludeChoice(): boolean {
      return this.playerinput.title === 'Select prelude card to play';
    },
    cardCost(): number {
      return this.playerView.thisPlayer?.cardCost ?? 3;
    },
    megacredits(): number {
      return this.playerView.thisPlayer?.megacredits ?? 0;
    },
    buyCost(): number {
      return this.cardsSelected * this.cardCost;
    },
    /** "Buy no cards" or "Buy 2 card(s) for 6 M€": never "Pass", which reads like passing the turn. */
    buyButtonLabel(): string {
      if (this.cardsSelected === 0) {
        return translateText('Buy no cards');
      }
      return translateTextWithParams('Buy ${0} card(s) for ${1} M€', [String(this.cardsSelected), String(this.buyCost)]);
    },
    draftPick(): boolean {
      const phase = this.playerView.game.phase;
      return this.showsave && this.playerView.thisPlayer.needsToDraft === true && (phase === Phase.DRAFTING || phase === Phase.INITIALDRAFTING);
    },
    draftLocked(): boolean {
      return isDraftRepick(this.playerinput);
    },
    lockedPicks(): ReadonlySet<CardName> {
      const count = this.playerinput.max;
      return new Set(this.draftLocked && count > 0 ?
        this.playerView.draftedCards.slice(-count).map((card) => card.name) : []);
    },
    /** No card can be taken at all (max 0), e.g. drawn cards the player cannot afford. */
    nothingToChoose(): boolean {
      return this.playerinput.max === 0;
    },
    /** Every offered card has to be taken: nothing to choose. */
    allGiven(): boolean {
      const count = this.selectableCards.length;
      return count > 0 && count === this.playerinput.cards.length && this.playerinput.min === count && (this.playerinput.max ?? count) === count;
    },
    /** Shown with a gold frame and without a selection box: a single optional card, or cards that are all given. */
    featuredCards(): boolean {
      return !this.draftPick && !this.draftLocked && !this.nothingToChoose && (this.allGiven || (this.optionalDeckChoice && this.selectableCards.length === 1));
    },
    optionalDeckChoice(): boolean {
      return this.playerinput.dealtFromDeck === true && this.playerinput.min === 0;
    },
    /** Identifies this question across page reloads: its title, limits and cards. */
    question(): string {
      const input = this.playerinput;
      return JSON.stringify(['card', input.title, input.min, input.max, input.cards.map((card) => card.name)]);
    },
    selectOnlyOneCard() : boolean {
      return this.playerinput.max === 1 && this.playerinput.min === 1;
    },
    isOptionalToManyCards(): boolean {
      return this.playerinput.max !== undefined &&
             this.playerinput.max > 1 &&
             this.playerinput.min === 0;
    },
    selectableCards(): Array<CardModel> {
      return this.playerinput.cards.filter((card) => !card.isDisabled);
    },
    showSelectAll(): boolean {
      return this.playerinput.showSelectAll === true &&
             !this.selectOnlyOneCard &&
             this.selectableCards.length > 1;
    },
    allSelected(): boolean {
      return Array.isArray(this.cards) && this.cards.length === this.selectableCards.length;
    },
    cardsSelected(): number {
      if (Array.isArray(this.cards)) {
        return this.cards.length;
      } else if (this.cards === undefined) {
        return 0;
      }
      return 1;
    },
    cardNames(): Array<CardName> {
      if (this.$data.cards === undefined) {
        return [];
      }
      return Array.isArray(this.$data.cards) ? this.$data.cards.map((card) => card.name) : [this.$data.cards.name];
    },
    buttonLabel(): string | Message {
      if (this.selectOnlyOneCard) {
        return this.playerinput.buttonLabel;
      }
      return {
        message: this.playerinput.buttonLabel + ' ${0}',
        data: [{
          type: LogMessageDataType.RAW_STRING,
          value: String(this.cardsSelected),
        }],
      };
    },
  },
});

</script>

<style scoped lang="less">
.draft-pick input {
  display: block;
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;

  &:focus-visible + :deep(.card-container) {
    outline: 2px solid #a8edff;
    outline-offset: 4px;
  }

  &:checked + :deep(.card-container)::after {
    content: none;
  }
}

.draft-pick--locked .cardbox {
  cursor: default;

  &:not(.draft-pick__card--selected) :deep(.card-container) {
    filter: grayscale(0.9) brightness(0.68);
  }
}

.draft-pick__card--selected :deep(.card-container) {
  outline: 2px solid #f3c46b;
  outline-offset: 2px;
}

.draft-pick__selected {
  display: block;
  width: fit-content;
  margin: 6px auto 0;
  padding: 4px 8px;
  border: 1px solid #f3c46b;
  border-radius: 5px;
  background: #291c10;
  color: #ffe5ab;
  font-size: 0.8rem;
  font-weight: 800;
}

// Buying cards: a summary line over the cards, a check mark on the chosen ones, bigger cards.
.buy-cards__summary {
  display: flex;
  flex-basis: 100%;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin: -4px 0 12px;
}

.buy-cards__hint {
  color: #cfe0e6;
  font-size: 0.9rem;
}

.buy-cards__facts {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px 18px;
  padding: 6px 16px;
  border: 1px solid #e2c27f66;
  border-radius: 10px;
  background: #0b131bd9;
  color: #cfe0e6;
  font-size: 0.95rem;

  b {
    color: #fff3c4;
  }

  .buy-cards__summary--short & {
    border-color: #ff7a5c;

    b:last-child {
      color: #ffb4a3;
    }
  }
}

.buy-cards > .cardbox {
  position: relative;
  cursor: pointer;

  :deep(.card-container) {
    zoom: 1.15;
  }

  &:has(input:checked)::after {
    content: '✓';
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
}

.prelude-choice__hint {
  flex-basis: 100%;
  margin: -6px 0 6px;
  color: #cfe0e6;
  font-size: 0.9rem;
  text-align: center;
}
</style>
