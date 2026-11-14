<template>
  <div class="card-container filterDiv hover-hide-res" :class="cardClasses">
    <div class="card-content-wrapper" v-i18n @mouseover="hovering = true" @mouseleave="hovering = false">
      <div v-if="!isStandardProject" class="card-cost-and-tags">
        <CardCost :amount="cost" :newCost="reducedCost" />
        <div v-if="showPlayerCube" :class="playerCubeClass"></div>
        <CardHelp v-if="helpText !== undefined" :name="card.name" :helpText="helpText" :hovering="hovering" />
        <CardTags :tags="tags" />
        <span v-if="framed && cardSkin !== 'arena' && cardMetadata.cardNumber" class="card-printed-number" aria-hidden="true">#{{ cardMetadata.cardNumber }}</span>
      </div>
      <CardArt v-if="showArt && cardSkin === 'arena'" :name="card.name" :tags="tags" />
      <CardTitle :title="card.name" :type="cardType" />
      <CardArt v-if="showArt && cardSkin !== 'arena'" :name="card.name" :tags="tags" />
      <div v-if="showArt && cardSkin === 'printed'" class="card-printed-band" aria-hidden="true">{{ moduleName }}</div>
      <CardContent
        :metadata="cardMetadata"
        :requirements="cardRequirements"
        :isCorporation="isCorporationCard"
        :bottomPadding="bottomPadding" />
    </div>
    <CardExpansion :expansion="cardExpansion" :isCorporation="isCorporationCard" :isResourceCard="isResourceCard" :compatibility="cardCompatibility" />
    <CardResourceCounter v-if="hasResourceType" :amount="resourceAmount" :type="resourceType" />
    <CardVictoryPoints v-if="cardMetadata.victoryPoints" :victoryPoints="cardMetadata.victoryPoints" />
    <CardExtraContent :card="card" />
    <slot></slot>
  </div>
</template>

<script lang="ts">

import {computed, defineComponent, inject} from 'vue';

import {CardModel} from '@/common/models/CardModel';
import CardTitle from './CardTitle.vue';
import CardResourceCounter from './CardResourceCounter.vue';
import CardCost from './CardCost.vue';
import CardExtraContent from './CardExtraContent.vue';
import CardExpansion from './CardExpansion.vue';
import CardTags from './CardTags.vue';
import CardVictoryPoints from './CardVictoryPoints.vue';
import CardContent from './CardContent.vue';
import CardHelp from './CardHelp.vue';
import CardArt from './CardArt.vue';
import {CardType} from '@/common/cards/CardType';
import {CardMetadata} from '@/common/cards/CardMetadata';
import {Tag} from '@/common/cards/Tag';
import {CardSkin, getPreferences} from '@/client/utils/PreferencesManager';
import {CardResource} from '@/common/CardResource';
import {getCardOrThrow} from '@/client/cards/ClientCardManifest';
import {ClientCard} from '@/common/cards/ClientCard';
import {Color} from '@/common/Color';
import {CardRequirementDescriptor} from '@/common/cards/CardRequirementDescriptor';
import {GameModule, MODULE_NAMES} from '@/common/cards/GameModule';


export default defineComponent({
  name: 'Card',
  setup() {
    return {missionCards: inject('missionCards', computed(() => false))};
  },
  components: {
    CardTitle,
    CardArt,
    CardHelp,
    CardResourceCounter,
    CardCost,
    CardExtraContent,
    CardExpansion,
    CardTags,
    CardContent,
    CardVictoryPoints,
  },
  props: {
    card: {
      type: Object as () => CardModel,
      required: true,
    },
    actionUsed: {
      type: Boolean,
      required: false,
      default: false,
    },
    robotCard: {
      type: Object as () => CardModel | undefined,
      required: false,
    },
    // Cube is only shown when actionUsed is true.
    cubeColor: {
      type: String as () => Color,
      required: false,
      default: 'neutral',
    },
    // When true, project cards use the illustrated game frame.
    art: {
      type: Boolean,
      required: false,
      default: false,
    },
    // When true, the card is automatically sized regardless of hover.
    autoTall: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  data() {
    return {
      hovering: false,
    };
  },
  computed: {
    cardInstance(): ClientCard {
      return getCardOrThrow(this.card.name);
    },
    cardExpansion(): GameModule {
      return this.cardInstance.module;
    },
    cardCompatibility(): Array<GameModule> {
      return this.cardInstance.compatibility;
    },
    isResourceCard(): boolean {
      if (this.cardInstance.resourceType !== undefined) {
        return true;
      } else {
        return false;
      }
    },
    tags(): Array<Tag> {
      const type = this.cardType;
      const tags = [...this.cardInstance.tags || []];
      tags.forEach((tag, idx) => {
        // Clone are changed on card implementations but that's not passed down directly through the
        // model, however, it sends down the `cloneTag` field. So this function does the substitution.
        if (tag === Tag.CLONE && this.card.cloneTag !== undefined) {
          tags[idx] = this.card.cloneTag;
        }
      });
      if (type === CardType.EVENT) {
        tags.push(Tag.EVENT);
      }
      return tags;
    },
    cost(): number | undefined {
      return this.isProjectCard ? this.cardInstance.cost : undefined;
    },
    reducedCost(): number | undefined {
      return this.isProjectCard ? this.card.calculatedCost : undefined;
    },
    cardType(): CardType {
      return this.cardInstance.type;
    },
    cardClasses(): string {
      const classes = [];
      classes.push('card-' + this.card.name.toLowerCase().replaceAll(' ', '-'));

      if (this.card.isDisabled) {
        classes.push('card-unavailable');
      } else if (!getPreferences().experimental_ui && this.actionUsed) {
        classes.push('card-unavailable');
      }

      if (this.isStandardProject) {
        classes.push('card-standard-project');
      }
      if (this.showArt) {
        classes.push('card-container--art', 'card-container--' + this.cardType, 'card-skin--' + this.cardSkin);
      } else if (this.framed) {
        classes.push('card-container--' + this.cardType, 'card-skin--' + this.cardSkin);
      }
      if (this.autoTall) {
        classes.push('card-auto-tall');
      } else if (getPreferences().experimental_ui) {
        classes.push('card-hover-tall');
      }
      const learnerModeOff = !getPreferences().learner_mode;
      if (learnerModeOff && this.isStandardProject && this.card.isDisabled) {
        classes.push('card-hide');
      }
      return classes.join(' ');
    },
    cardMetadata(): CardMetadata {
      return this.cardInstance.metadata;
    },
    cardRequirements(): ReadonlyArray<CardRequirementDescriptor> | undefined {
      return this.cardInstance.requirements;
    },
    resourceAmount(): number {
      return this.card.resources || this.robotCard?.resources || 0;
    },
    isCorporationCard() : boolean {
      return this.cardType === CardType.CORPORATION;
    },
    isProjectCard(): boolean {
      const type = this.cardType;
      return type === CardType.AUTOMATED || type === CardType.ACTIVE || type === CardType.EVENT;
    },
    moduleName(): string {
      return MODULE_NAMES[this.cardExpansion];
    },
    cardSkin(): CardSkin {
      return getPreferences().card_skin;
    },
    /** A project card shown in the mission hand or card stage, styled by the chosen skin. */
    framed(): boolean {
      if (this.art) {
        return this.isProjectCard;
      }
      // Elsewhere in the game (windows, choices) the classic skin covers every player card.
      return this.missionCards && this.cardSkin === 'classic' && (this.isProjectCard || this.isPlayerCard);
    },
    /** Corporations, preludes and CEOs: framed with the same skin as project cards during the game. */
    isPlayerCard(): boolean {
      const type = this.cardType;
      return type === CardType.CORPORATION || type === CardType.PRELUDE || type === CardType.CEO;
    },
    showArt(): boolean {
      // The classic skin is the original card, so it never gets the illustrated frame.
      return this.art && this.isProjectCard && this.cardSkin !== 'classic';
    },
    isStandardProject() : boolean {
      return this.cardType === CardType.STANDARD_PROJECT || this.cardType === CardType.STANDARD_ACTION;
    },
    hasResourceType(): boolean {
      return this.card.isSelfReplicatingRobotsCard === true || this.cardInstance.resourceType !== undefined || this.robotCard !== undefined;
    },
    resourceType(): CardResource {
      if (this.robotCard !== undefined || this.card.isSelfReplicatingRobotsCard === true) {
        return CardResource.RESOURCE_CUBE;
      }
      // This last RESOURCE_CUBE is functionally unnecessary and serves to satisfy the type contract.
      return this.cardInstance.resourceType ?? CardResource.RESOURCE_CUBE;
    },
    bottomPadding(): string {
      if (this.cardMetadata.victoryPoints !== undefined) {
        return 'long';
      }
      if (this.hasResourceType) {
        return 'short';
      }
      return '';
    },
    helpText(): string | undefined {
      return this.cardInstance.metadata.helpText;
    },
    showPlayerCube(): boolean {
      return getPreferences().experimental_ui && this.actionUsed;
    },
    playerCubeClass(): string {
      return `board-cube board-cube--${this.cubeColor}`;
    },
  },
});

</script>
