<template>
  <div class="ma-block">
    <div class="ma-player" v-if="award.playerName">
      <i :title="$t('Funded by') + ' ' + award.playerName" class="board-cube" :class="`board-cube--${award.color}`"></i>
    </div>

    <div class="ma-name ma-name--awards award-block" :class="nameCss">
      <span ref="name" v-i18n>{{ award.name }}</span>
      <div v-if="showScores" class="ma-scores player_home_block--milestones-and-awards-scores">
        <template v-for="score in sortedScores" :key="score.color">
          <p
            v-if="playerSymbol(score.color).length > 0"
            class="ma-score"
            :class="`player_bg_color_${score.color}`"
            v-text="playerSymbol(score.color)"
            data-test="player-score"
          ></p>
          <p
            class="ma-score"
            :class="`player_bg_color_${score.color}`"
            v-text="score.score"
            data-test="player-score"
          ></p>
          <p v-if="award.playerName && points(score) > 0" class="ma-score ma-score--vp" :title="$t('Victory points for this place')">+{{ points(score) }}</p>
        </template>
      </div>
    </div>

    <div v-if="showDescription" class="ma-description">
      <span v-i18n>{{ description }}</span>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {FundedAwardModel, AwardScore} from '@/common/models/FundedAwardModel';
import {getAward} from '@/client/MilestoneAwardManifest';
import {playerSymbol} from '@/client/utils/playerSymbol';
import {Color} from '@/common/Color';
import {fitTextWhenReady} from '@/client/utils/textFit';
import {comparing, reversed} from '@/common/utils/Ordering';

type Refs = {
  name: HTMLElement | undefined;
};

export default defineComponent({
  name: 'Award',
  props: {
    award: {
      type: Object as () => FundedAwardModel,
      required: true,
    },
    showScores: {
      type: Boolean,
      default: true,
    },
    showDescription: {
      type: Boolean,
    },
  },
  mounted() {
    this.fitName();
  },
  watch: {
    'award.name'() {
      this.fitName();
    },
  },
  methods: {
    /** VP the score earns now: 5 for 1st (every tied player), 2 for 2nd with 3+ players and no tie for 1st. */
    points(score: AwardScore): number {
      const values = this.sortedScores.map((s) => s.score);
      const top = values[0];
      if (score.score === top) {
        return 5;
      }
      const tiedFirst = values.filter((v) => v === top).length > 1;
      const second = values.find((v) => v < top);
      return values.length > 2 && !tiedFirst && score.score === second ? 2 : 0;
    },
    playerSymbol(color: Color) {
      return playerSymbol(color);
    },
    // Size the name to fit its medal box by measuring the rendered text rather
    // than guessing from its length.
    fitName(): void {
      fitTextWhenReady(this.typedRefs.name, 'award-name');
    },
  },
  computed: {
    typedRefs(): Refs {
      return this.$refs as unknown as Refs;
    },
    nameCss(): string {
      return 'ma-name--' + this.award.name.replaceAll(' ', '-').replaceAll('.', '').toLowerCase();
    },
    sortedScores(): Array<AwardScore> {
      return this.award.scores.toSorted(reversed(comparing((score) => score.score)));
    },
    description(): string {
      return getAward(this.award.name).description;
    },
  },
});
</script>

<style lang="less">
.ma-score--vp {
  background: #e2c27f;
  color: #1b1200;
  font-weight: 800;
}
</style>
