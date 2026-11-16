<template>
  <!--
    Spending heat with Stormcraft Incorporated, on one line:
      [Pay · 8 heat]   [Pay · 4 heat + 2 floaters]  − 2 + MAX  = 4 heat
    The first button pays with heat alone. The second pays heat plus floaters (2 heat each):
    the stepper sets how many floaters, the heat part follows by itself.
  -->
  <section class="heat-pay">
    <h2 class="heat-pay__title">{{ $t(title) }}</h2>
    <div class="heat-pay__row">
      <button v-if="heatMax >= target" type="button" class="heat-pay__button" data-test="heat-only" @click="pay(target, 0)">
        {{ $t('Pay') }} · <b>{{ target }}</b><i class="resource_icon resource_icon--heat" :title="$t('Heat')"></i>
      </button>
      <div v-if="floatersMax > 0" class="heat-pay__mix">
        <button type="button" class="heat-pay__button heat-pay__button--main" data-test="heat-mixed" :disabled="!valid" @click="pay(heat, floaters)">
          {{ $t('Pay') }} ·
          <template v-if="heat > 0"><b>{{ heat }}</b><i class="resource_icon resource_icon--heat" :title="$t('Heat')"></i> + </template>
          <b>{{ floaters }}</b><i class="card-resource card-resource-floater heat-pay__floater" :title="$t('Floaters')"></i>
        </button>
        <span class="heat-pay__stepper">
          <i class="card-resource card-resource-floater heat-pay__floater" :title="$t('Floaters')"></i>
          <button type="button" class="heat-pay__step" data-test="floaters-minus" :disabled="floaters <= floatersMin" :aria-label="$t('Less')" @click="floaters--">−</button>
          <b class="heat-pay__count">{{ floaters }}</b>
          <button type="button" class="heat-pay__step" data-test="floaters-plus" :disabled="floaters >= floatersMax" :aria-label="$t('More')" @click="floaters++">+</button>
          <button type="button" class="heat-pay__step heat-pay__step--max" @click="floaters = floatersMax">MAX</button>
        </span>
        <small class="heat-pay__worth">= {{ floaters * 2 }}<i class="resource_icon resource_icon--heat"></i> ({{ $t('1 floater = 2 heat') }})</small>
      </div>
    </div>
    <small v-if="!enough" class="heat-pay__short">{{ $t('Not enough heat') }}</small>
  </section>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {AndOptionsModel, SelectAmountModel} from '@/common/models/PlayerInputModel';
import {AndOptionsResponse} from '@/common/inputs/InputResponse';

export default defineComponent({
  name: 'HeatPayment',
  props: {
    playerinput: {
      type: Object as () => AndOptionsModel,
      required: true,
    },
    onsave: {
      type: Function as unknown as () => (out: AndOptionsResponse) => void,
      required: true,
    },
  },
  data() {
    return {floaters: 0};
  },
  computed: {
    title(): AndOptionsModel['title'] {
      return this.playerinput.title;
    },
    target(): number {
      return this.playerinput.heatPayment?.target ?? 0;
    },
    heatMax(): number {
      return (this.playerinput.options[0] as SelectAmountModel | undefined)?.max ?? 0;
    },
    floatersMax(): number {
      return (this.playerinput.options[1] as SelectAmountModel | undefined)?.max ?? 0;
    },
    /** Floaters needed when all the heat goes in. */
    floatersMin(): number {
      return Math.max(0, Math.ceil((this.target - this.heatMax) / 2));
    },
    /** The heat part: what the floaters do not cover. */
    heat(): number {
      return Math.max(0, this.target - this.floaters * 2);
    },
    valid(): boolean {
      return this.heat <= this.heatMax && this.floaters >= 0 && this.floaters <= this.floatersMax;
    },
    enough(): boolean {
      return this.heatMax + this.floatersMax * 2 >= this.target;
    },
  },
  created() {
    // The mixed button starts with the fewest floaters (at least one), so it differs from heat alone.
    this.floaters = Math.min(this.floatersMax, Math.max(this.floatersMin, 1));
  },
  methods: {
    pay(heat: number, floaters: number): void {
      this.onsave({
        type: 'and',
        responses: [{type: 'amount', amount: heat}, {type: 'amount', amount: floaters}],
      });
    },
  },
});
</script>

<style scoped lang="less">
.heat-pay {
  display: grid;
  justify-items: center;
  gap: 12px;
}

.heat-pay__title {
  margin: 0;
  color: #f6e2b8;
  font-size: 1.05rem;
}

.heat-pay__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.heat-pay__button {
  display: inline-flex;
  min-height: 46px;
  align-items: center;
  gap: 5px;
  padding: 0 20px;
  border: 1px solid #49616d;
  border-radius: 9px;
  background: #142630;
  color: #eef6f8;
  font: inherit;
  font-weight: 800;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  white-space: nowrap;
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

  .resource_icon {
    width: 22px;
    height: 22px;
    margin: 0;
  }
}

.heat-pay__floater {
  display: inline-block;
  width: 22px;
  height: 22px;
  background-size: contain;
  background-repeat: no-repeat;
  vertical-align: middle;
}

// The second button and how many floaters go into it, as one block.
.heat-pay__mix {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  padding: 4px 10px 4px 4px;
  border: 1px solid #e2c27f55;
  border-radius: 12px;
  background: #0b141c99;
  color: #cfe0e6;
}

.heat-pay__stepper {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.heat-pay__step {
  min-width: 28px;
  height: 30px;
  padding: 0 6px;
  border: 1px solid #6f8c98;
  border-radius: 6px;
  background: #142630;
  color: #eef6f8;
  font: inherit;
  font-weight: 800;
  cursor: pointer;

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }

  &--max {
    font-size: 0.7rem;
  }
}

.heat-pay__count {
  min-width: 26px;
  text-align: center;
  font-size: 1.1rem;
}

.heat-pay__worth {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: #ffe36b;
  font-size: 0.8rem;
  font-weight: 700;
  white-space: nowrap;

  .resource_icon {
    width: 16px;
    height: 16px;
    margin: 0;
  }
}

.heat-pay__short {
  color: #ff9c8a;
}
</style>
