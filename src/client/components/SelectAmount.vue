<template>
  <div>
    <div v-if="showtitle === true">{{ $t(playerinput.title) }}</div>
    <div class="select-amount">
      <button type="button" class="select-amount__step" :disabled="value <= playerinput.min" :aria-label="$t('Less')" @click="step(-1)">−</button>
      <input type="number" class="select-amount__value nes-input" :min="playerinput.min" :max="playerinput.max" v-model="amount" :aria-label="$t(playerinput.title)">
      <button type="button" class="select-amount__step" :disabled="value >= playerinput.max" :aria-label="$t('More')" @click="step(1)">+</button>
      <button type="button" class="select-amount__max" :disabled="value >= playerinput.max" @click="setMaxValue">MAX</button>
    </div>
    <div v-if="showsave === true" class="select-amount__save">
      <AppButton size="big" @click="saveData" :title="playerinput.buttonLabel" />
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import AppButton from '@/client/components/common/AppButton.vue';
import {SelectAmountModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {SelectAmountResponse} from '@/common/inputs/InputResponse';

interface DataModel {
  // Why is amount type string?
  amount: string;
}

export default defineComponent({
  name: 'SelectAmount',
  components: {
    AppButton,
  },
  props: {
    playerView: {
      type: Object as () => PlayerViewModel,
      required: true,
    },
    playerinput: {
      type: Object as () => SelectAmountModel,
      required: true,
    },
    onsave: {
      type: Function as unknown as () => (out: SelectAmountResponse) => void,
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
      amount: this.playerinput.maxByDefault ? String(this.playerinput.max) : String(this.playerinput.min),
    };
  },
  computed: {
    value(): number {
      const parsed = parseInt(this.amount);
      return Number.isNaN(parsed) ? this.playerinput.min : parsed;
    },
  },
  methods: {
    step(delta: number) {
      this.amount = String(Math.max(this.playerinput.min, Math.min(this.playerinput.max, this.value + delta)));
    },
    saveData() {
      this.onsave({type: 'amount', amount: parseInt(this.amount)});
    },
    setMaxValue() {
      this.amount = String(this.playerinput.max);
    },
  },
});
</script>

<style lang="less">
.select-amount {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 10px 0;

  .select-amount__step,
  .select-amount__max {
    min-width: 44px;
    height: 44px;
    border: 1px solid #6f8c98;
    border-radius: 8px;
    background: linear-gradient(#1c2f3f, #0b141c);
    color: #eef6f8;
    font-size: 1.4rem;
    font-weight: 800;
    cursor: pointer;

    &:hover:not(:disabled) {
      border-color: #b4ffeb;
    }

    &:disabled {
      opacity: 0.4;
      cursor: default;
    }
  }

  .select-amount__max {
    padding: 0 12px;
    border-color: #e2c27f;
    color: #ffe9bd;
    font-size: 0.85rem;
    letter-spacing: 0.08em;
  }

  .select-amount__value {
    width: 90px;
    height: 52px;
    border: 1px solid #e2c27f;
    border-radius: 8px;
    background: #0b141c;
    color: #fff3c4;
    font-size: 1.8rem;
    font-weight: 800;
    text-align: center;
    appearance: textfield;

    &::-webkit-inner-spin-button,
    &::-webkit-outer-spin-button {
      appearance: none;
      margin: 0;
    }
  }
}

.select-amount__save {
  display: flex;
  justify-content: center;
}
</style>
