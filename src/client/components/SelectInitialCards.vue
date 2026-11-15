<template>
  <div class="select-initial-cards setup-wizard">
    <ConfirmDialog
      message="Continue without buying any project cards?"
      ref="confirmation"
      @accept="confirmSelection" />

    <!-- Steps: one choice on screen at a time; each tab shows what is chosen so far. -->
    <nav class="setup-steps" :aria-label="$t('Game setup')">
      <button v-for="(item, index) in steps" :key="item.id" type="button" class="setup-steps__tab"
        :class="{'setup-steps__tab--current': step === item.id, 'setup-steps__tab--done': item.done}"
        :aria-current="step === item.id ? 'step' : undefined" @click="step = item.id">
        <b class="setup-steps__number">{{ item.done ? '✓' : index + 1 }}</b>
        <span class="setup-steps__label">{{ $t(item.label) }}</span>
        <small class="setup-steps__status">{{ item.status }}</small>
      </button>
    </nav>

    <section v-show="step === 'corporation'" class="setup-step">
      <fieldset class="corporation-selection">
        <legend v-i18n>Choose your corporation</legend>
        <div class="corporation-selection__options">
          <article
            v-for="card in corpCardOption.cards"
            :key="card.name"
            class="corporation-selection__option"
            :class="{'corporation-selection__option--selected': selectedCorporations.includes(card.name)}">
            <h2>{{ $t(card.name) }}</h2>
            <Card :card="card" autoTall />
            <label class="corporation-selection__choice">
              <input
                type="radio"
                :name="corporationGroup"
                :checked="selectedCorporations.includes(card.name)"
                :disabled="card.isDisabled"
                :aria-label="$t(card.name)"
                @change="corporationChanged([card.name])">
              <span v-if="selectedCorporations.includes(card.name)" v-i18n>Selected</span>
              <span v-else v-i18n>Select</span>
            </label>
          </article>
        </div>
      </fieldset>
      <div v-if="playerCanChooseAridor" class="player_home_colony_cont">
        <div v-i18n>These are the colony tiles Aridor may choose from:</div>
        <div class="discarded-colonies-for-aridor">
          <div class="player_home_colony small_colony" v-for="colonyName in playerView.game.discardedColonies" :key="colonyName">
            <Colony :colony="getColony(colonyName)" :active="getColony(colonyName).isActive" />
          </div>
        </div>
      </div>
    </section>
    <!-- v-show, not v-if: the card choices keep their selection while another step is shown. -->
    <section v-if="hasPrelude" v-show="step === 'prelude'" class="setup-step">
      <SelectCard :playerView="playerView" :playerinput="preludeCardOption" :onsave="noop" :showtitle="true" @cardschanged="preludesChanged" />
    </section>
    <section v-if="hasCeo" v-show="step === 'ceo'" class="setup-step">
      <SelectCard :playerView="playerView" :playerinput="ceoCardOption" :onsave="noop" :showtitle="true" @cardschanged="ceosChanged" />
    </section>
    <section v-show="step === 'projects'" class="setup-step">
      <SelectCard :playerView="playerView" :playerinput="projectCardOption" :onsave="noop" :showtitle="true" @cardschanged="cardsChanged" />
    </section>

    <!-- Always on screen: what is chosen, what it costs, and the buttons. -->
    <footer class="setup-summary">
      <dl class="setup-summary__facts">
        <div>
          <dt v-i18n>Corporation</dt>
          <dd>{{ selectedCorporations.length === 1 ? $t(selectedCorporations[0]) : '—' }}</dd>
        </div>
        <div v-if="hasPrelude">
          <dt v-i18n>Preludes</dt>
          <dd>{{ selectedPreludes.length }}/2</dd>
        </div>
        <div v-if="hasCeo">
          <dt>CEO</dt>
          <dd>{{ selectedCeos.length }}/1</dd>
        </div>
        <div>
          <dt v-i18n>Project cards</dt>
          <dd>{{ selectedCards.length }} <small>(−{{ selectedCards.length * cardCost }} M€)</small></dd>
        </div>
        <div v-if="selectedCorporations.length === 1">
          <dt v-i18n>Starting M€:</dt>
          <dd class="setup-summary__money">{{ getStartingMegacredits() }}<small v-if="hasPrelude"> → {{ getStartingMegacredits() + getAfterPreludes() }} {{ $t('after preludes') }}</small></dd>
        </div>
      </dl>
      <p v-if="warning !== undefined" class="setup-summary__warning">{{ $t(warning) }}</p>
      <div class="setup-summary__buttons">
        <button v-if="nextStep" type="button" class="setup-summary__next" @click="step = nextStep" v-i18n>Next</button>
        <AppButton :disabled="!valid" v-if="showsave" @click="saveIfConfirmed" type="submit" :title="playerinput.buttonLabel" />
      </div>
    </footer>
  </div>
</template>

<script lang="ts">

import {defineComponent, useId} from 'vue';

import AppButton from '@/client/components/common/AppButton.vue';
import {getCard, getCardOrThrow} from '@/client/cards/ClientCardManifest';
import {CardName} from '@/common/cards/CardName';
import * as constants from '@/common/constants';
import {PlayerInputModel, SelectCardModel, SelectInitialCardsModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import SelectCard from '@/client/components/SelectCard.vue';
import Card from '@/client/components/card/Card.vue';
import ConfirmDialog from '@/client/components/common/ConfirmDialog.vue';
import {getPreferences, Preferences, PreferencesManager} from '@/client/utils/PreferencesManager';
import {Tag} from '@/common/cards/Tag';
import {SelectInitialCardsResponse} from '@/common/inputs/InputResponse';
import {CardType} from '@/common/cards/CardType';
import Colony from '@/client/components/colonies/Colony.vue';
import {ColonyName} from '@/common/colonies/ColonyName';
import {ColonyModel, simpleColonyModel} from '@/common/models/ColonyModel';
import * as titles from '@/common/inputs/SelectInitialCards';
import {sum} from '@/common/utils/utils';
import {translateText} from '@/client/directives/i18n';
import {recallChoice, rememberChoice} from '@/client/utils/choiceMemory';


type SetupStep = 'corporation' | 'prelude' | 'ceo' | 'projects';
type SetupStepItem = {id: SetupStep, label: string, done: boolean, status: string};

type DataModel = {
  step: SetupStep,
  selectedCards: Array<CardName>,
  // End result will be a single CEO, but the player may select multiple while deciding what to keep.
  selectedCeos: Array<CardName>,
  selectedCorporations: Array<CardName>,
  selectedPreludes: Array<CardName>,
  valid: boolean,
  warning: string | undefined,
}

type Refs = {
  confirmation: InstanceType<typeof ConfirmDialog>;
};

export default defineComponent({
  name: 'SelectInitialCards',
  props: {
    playerView: {
      type: Object as () => PlayerViewModel,
      required: true,
    },
    playerinput: {
      type: Object as () => SelectInitialCardsModel,
      required: true,
    },
    onsave: {
      type: Function as unknown as () => (out: SelectInitialCardsResponse) => void,
      required: true,
    },
    showsave: {
      type: Boolean,
      required: true,
    },
    showtitle: {
      type: Boolean,
      default: true,
    },
    preferences: {
      type: Object as () => Readonly<Preferences>,
      default: () => PreferencesManager.INSTANCE.values(),
    },
  },
  components: {
    AppButton,
    Card,
    SelectCard,
    ConfirmDialog,
    Colony,
  },
  setup() {
    return {corporationGroup: useId()};
  },
  data(): DataModel {
    return {
      step: 'corporation',
      selectedCards: [],
      selectedCeos: [],
      selectedCorporations: [],
      selectedPreludes: [],
      valid: false,
      warning: undefined,
    };
  },
  methods: {
    noop() {
      throw new Error('should not be called');
    },
    getAfterPreludes() {
      return sum(this.selectedPreludes.map((prelude) => {
        const card = getCardOrThrow(prelude);
        const base = card.startingMegaCredits ?? 0;
        return base + this.extra(prelude);
      }));
    },
    extra(prelude: CardName): number {
      const card = getCardOrThrow(prelude);
      switch (this.selectedCorporations.length === 1 ? this.selectedCorporations[0] : undefined) {
      // For each step you increase the production of a resource ... you also gain that resource.
      case CardName.MANUTECH:
        return card.productionBox?.megacredits ?? 0;

      // When you place a city tile, gain 3 M€.
      case CardName.THARSIS_REPUBLIC:
        switch (prelude) {
        case CardName.SELF_SUFFICIENT_SETTLEMENT:
        case CardName.EARLY_SETTLEMENT:
        case CardName.STRATEGIC_BASE_PLANNING:
          return 3;
        }
        return 0;

      // When ANY microbe tag is played ... lose 4 M€ or as much as possible.
      case CardName.PHARMACY_UNION:
        const tags = card.tags.filter((tag) => tag === Tag.MICROBE).length;
        return (-4 * tags);

      // When a microbe tag is played, incl. this, THAT PLAYER gains 2 M€,
      case CardName.SPLICE:
        const microbeTags = card.tags.filter((tag) => tag === Tag.MICROBE).length;
        return (2 * microbeTags);

      // Whenever Venus is terraformed 1 step, you gain 2 M€
      case CardName.APHRODITE:
        switch (prelude) {
        case CardName.VENUS_FIRST:
          return 4;
        case CardName.HYDROGEN_BOMBARDMENT:
          return 2;
        }
        return 0;

      // When any player raises any Moon Rate, gain 1M€ per step.
      case CardName.LUNA_FIRST_INCORPORATED:
        switch (prelude) {
        case CardName.FIRST_LUNAR_SETTLEMENT:
        case CardName.CORE_MINE:
        case CardName.BASIC_INFRASTRUCTURE:
          return 1;
        case CardName.MINING_COMPLEX:
          return 2;
        }
        return 0;

      // When you place an ocean tile, gain 4MC
      case CardName.POLARIS:
        switch (prelude) {
        case CardName.AQUIFER_TURBINES:
        case CardName.POLAR_INDUSTRIES:
          return 4;
        case CardName.GREAT_AQUIFER:
          return 8;
        }
        return 0;

      // Gain 2 MC for each project card in hand.
      case CardName.HEAD_START:
        return this.selectedCards.length * 2;

      // Gain 4MC for playing a card with no tags.
      // Gain 1MC for playing a card with 1 tag.
      case CardName.SAGITTA_FRONTIER_SERVICES:
        const count = card.tags.filter((tag) => tag !== Tag.WILD).length;
        return count === 0 ? 4 : count === 1 ? 1 : 0;

      default:
        return 0;
      }
    },
    getStartingMegacredits() {
      if (this.selectedCorporations.length !== 1) {
        return NaN;
      }
      const corpName = this.selectedCorporations[0];
      const corporation = getCardOrThrow(corpName);
      // The ?? 0 is only because ClientCard applies to _all_ cards.

      let starting = corporation.startingMegaCredits ?? 0;
      const cardCost = corporation.cardCost === undefined ? constants.CARD_COST : corporation.cardCost;
      starting -= this.selectedCards.length * cardCost;

      if (corpName === CardName.SAGITTA_FRONTIER_SERVICES) {
        // Effect for playing itself.
        starting += 4;
      }

      return starting;
    },
    saveIfConfirmed() {
      const projectCards = this.selectedCards.filter((name) => getCard(name)?.type !== CardType.PRELUDE);
      let showAlert = false;
      if (this.preferences.show_alerts && projectCards.length === 0) {
        showAlert = true;
      }
      if (showAlert) {
        this.typedRefs.confirmation.show();
      } else {
        this.saveData();
      }
    },
    saveData() {
      const result: SelectInitialCardsResponse = {
        type: 'initialCards',
        responses: [],
      };

      if (this.selectedCorporations.length === 1) {
        result.responses.push({
          type: 'card',
          cards: [this.selectedCorporations[0]],
        });
      }
      if (this.hasPrelude) {
        result.responses.push({
          type: 'card',
          cards: this.selectedPreludes,
        });
      }
      if (this.hasCeo) {
        result.responses.push({
          type: 'card',
          cards: this.selectedCeos,
        });
      }
      result.responses.push({
        type: 'card',
        cards: this.selectedCards,
      });
      this.onsave(result);
    },

    cardsChanged(cards: Array<CardName>) {
      this.selectedCards = cards;
      this.validate();
    },
    ceosChanged(cards: Array<CardName>) {
      this.selectedCeos = cards;
      this.validate();
    },
    corporationChanged(cards: Array<CardName>) {
      const first = this.selectedCorporations.length === 0;
      this.selectedCorporations = cards;
      this.validate();
      // The first corporation chosen moves on to the next step; changing it later does not.
      if (first && this.nextStep !== undefined) {
        this.step = this.nextStep;
      }
    },
    preludesChanged(cards: Array<CardName>) {
      this.selectedPreludes = cards;
      this.validate();
    },

    calcuateWarning(): boolean {
      // Start with warning being empty.
      this.warning = undefined;
      if (this.selectedCorporations.length === 0) {
        this.warning = 'Select a corporation';
        return false;
      }
      if (this.selectedCorporations.length > 1) {
        this.warning = 'You selected too many corporations';
        return false;
      }
      if (this.hasPrelude) {
        if (this.selectedPreludes.length < 2) {
          this.warning = 'Select 2 preludes';
          return false;
        }
        if (this.selectedPreludes.length > 2) {
          this.warning = 'You selected too many preludes';
          return false;
        }
      }
      if (this.hasCeo) {
        if (this.selectedCeos.length < 1) {
          this.warning = 'Select 1 CEO';
          return false;
        }
        if (this.selectedCeos.length > 1) {
          this.warning = 'You selected too many CEOs';
          return false;
        }
      }
      if (this.selectedCards.length === 0) {
        this.warning = 'You haven\'t selected any project cards';
        return true;
      }
      return true;
    },
    validate() {
      this.valid = this.calcuateWarning();
    },
    confirmSelection() {
      this.saveData();
    },
    rememberSetup() {
      rememberChoice(this.setupQuestion, {corporation: this.selectedCorporations[0], step: this.step});
    },
    getColony(colonyName: ColonyName): ColonyModel {
      return simpleColonyModel(colonyName);
    },
  },
  computed: {
    steps(): Array<SetupStepItem> {
      const steps: Array<SetupStepItem> = [{
        id: 'corporation', label: 'Corporation', done: this.selectedCorporations.length === 1,
        status: this.selectedCorporations.length === 1 ? translateText(this.selectedCorporations[0]) : translateText('Choose 1'),
      }];
      if (this.hasPrelude) {
        steps.push({id: 'prelude', label: 'Preludes', done: this.selectedPreludes.length === 2, status: `${this.selectedPreludes.length}/2`});
      }
      if (this.hasCeo) {
        steps.push({id: 'ceo', label: 'CEO', done: this.selectedCeos.length === 1, status: `${this.selectedCeos.length}/1`});
      }
      steps.push({
        id: 'projects', label: 'Project cards', done: this.selectedCards.length > 0,
        status: `${this.selectedCards.length} · −${this.selectedCards.length * this.cardCost} M€`,
      });
      return steps;
    },
    /** Identifies this setup across page reloads: the corporations dealt. */
    setupQuestion(): string {
      return JSON.stringify(['setup', this.corpCardOption.cards.map((card) => card.name)]);
    },
    nextStep(): SetupStep | undefined {
      const index = this.steps.findIndex((item) => item.id === this.step);
      return this.steps[index + 1]?.id;
    },
    cardCost(): number {
      const corporation = this.selectedCorporations.length === 1 ? getCard(this.selectedCorporations[0]) : undefined;
      return corporation?.cardCost ?? constants.CARD_COST;
    },
    typedRefs(): Refs {
      return this.$refs as Refs;
    },
    playerCanChooseAridor() {
      return this.playerView.dealtCorporationCards.some((card) => card.name === CardName.ARIDOR);
    },
    hasPrelude() {
      return hasOption(this.playerinput.options, titles.SELECT_PRELUDE_TITLE);
    },
    hasCeo() {
      return hasOption(this.playerinput.options, titles.SELECT_CEO_TITLE);
    },
    corpCardOption() {
      return getOption(this.playerinput.options, titles.SELECT_CORPORATION_TITLE);
    },
    preludeCardOption() {
      const option = getOption(this.playerinput.options, titles.SELECT_PRELUDE_TITLE);
      if (getPreferences().experimental_ui) {
        option.max = option.cards.length;
      }
      return option;
    },
    ceoCardOption() {
      const option = getOption(this.playerinput.options, titles.SELECT_CEO_TITLE);
      if (getPreferences().experimental_ui) {
        option.max = option.cards.length;
      }
      return option;
    },
    projectCardOption() {
      return getOption(this.playerinput.options, titles.SELECT_PROJECTS_TITLE);
    },
  },
  mounted() {
    // After a page reload: the corporation and the step chosen before it.
    const saved = recallChoice<{corporation?: CardName, step?: SetupStep}>(this.setupQuestion);
    if (saved?.corporation !== undefined && this.corpCardOption.cards.some((card) => card.name === saved.corporation && !card.isDisabled)) {
      this.selectedCorporations = [saved.corporation];
    }
    if (saved?.step !== undefined && this.steps.some((item) => item.id === saved.step)) {
      this.step = saved.step;
    }
    this.validate();
  },
  watch: {
    selectedCorporations() {
      this.rememberSetup();
    },
    step() {
      this.rememberSetup();
    },
  },
});

function getOption(options: Array<PlayerInputModel>, title: string): SelectCardModel {
  const option = options.find((option) => option.title === title);
  if (option === undefined) {
    throw new Error('invalid input, missing option');
  }
  if (option.type !== 'card') {
    throw new Error('invalid input, Not a SelectCard option');
  }
  return option;
}

function hasOption(options: Array<PlayerInputModel>, title: string): boolean {
  const option = options.find((option) => option.title === title);
  return option !== undefined;
}
</script>

<style lang="less">
// Game setup in steps, with a summary bar that stays at the bottom of the screen.
.setup-wizard {
  display: grid;
  gap: 14px;
}

.setup-steps {
  position: sticky;
  z-index: 5;
  top: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 0;
  background: linear-gradient(#0b131bf2 70%, transparent);
}

.setup-steps__tab {
  display: grid;
  min-width: 150px;
  flex: 1 1 0;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 0 10px;
  padding: 8px 12px;
  border: 1px solid #6f8c98;
  border-radius: 10px;
  background: linear-gradient(#1c2f3f, #0b141c);
  color: #cfe0e6;
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:hover {
    border-color: #b4ffeb;
  }

  &--current {
    border-color: #e2c27f;
    box-shadow: 0 0 0 1px #e2c27f, 0 0 14px #e2c27f55;
    color: #fff3c4;
  }

  &--done .setup-steps__number {
    background: #3cae3a;
    color: #fff;
  }
}

.setup-steps__number {
  display: grid;
  width: 28px;
  height: 28px;
  grid-row: span 2;
  place-items: center;
  border-radius: 50%;
  background: #e2c27f;
  color: #1b1200;
}

.setup-steps__label {
  font-weight: 800;
}

.setup-steps__status {
  overflow: hidden;
  color: #9fb8c2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.setup-summary {
  position: sticky;
  z-index: 5;
  bottom: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 20px;
  padding: 12px 16px;
  border: 1px solid #e2c27f;
  border-radius: 12px;
  background: #0b131bf5;
  box-shadow: 0 -8px 24px #000a;
  color: #eef6f8;
}

.setup-summary__facts {
  display: flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  gap: 8px 22px;
  margin: 0;

  dt {
    color: #9fb8c2;
    font-size: 0.75rem;
    text-transform: uppercase;
  }

  dd {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 800;

    small {
      color: #cfe0e6;
      font-weight: 400;
    }
  }
}

.setup-summary__money {
  color: #ffe9bd;
}

.setup-summary__warning {
  margin: 0;
  color: #ffd2c4;
}

.setup-summary__buttons {
  display: flex;
  align-items: center;
  gap: 10px;
}

.setup-summary__next {
  padding: 9px 18px;
  border: 1px solid #6f8c98;
  border-radius: 9px;
  background: linear-gradient(#1c2f3f, #0b141c);
  color: #eef6f8;
  font: inherit;
  font-weight: 700;
  cursor: pointer;

  &:hover {
    border-color: #b4ffeb;
  }
}
</style>

