<template>
  <!--
    Every payment in the game looks the same: "Play · 20 M€" pays with M€ alone. When another
    resource can be used too (steel, titanium, heat...), a second button pays with it, and a
    small stepper next to it sets how much of it; the M€ part follows by itself.
  -->
  <section class="pay">
    <div v-if="showsave" class="pay__buttons">
      <button v-if="megacreditsOnly" type="button" class="pay__button" :data-test="usesOtherUnits ? 'save-mc' : 'save'" @click="payWithMegacredits">
        {{ $t(buttonLabel) }}<b v-if="cost > 0"> · {{ cost }} M€</b>
      </button>
      <button v-if="!megacreditsOnly || usesOtherUnits" type="button" class="pay__button pay__button--main" data-test="save"
        @click="handleSave()">
        {{ $t(buttonLabel) }}
        <template v-if="cost > 0">
          ·
          <span v-for="unit in usedUnits" :key="unit" class="pay__part">
            <b>{{ payment[unit] }}</b><i class="resource_icon" :class="iconClass(unit)" :title="$t(descriptions[unit])"></i>
          </span>
          <span v-if="payment.megacredits > 0 || usedUnits.length === 0" class="pay__part"><b>{{ payment.megacredits }}</b> M€</span>
        </template>
      </button>
    </div>
    <!-- How much of each other resource goes into the second button. -->
    <div v-if="cost > 0 && adjustableUnits.length > 0" class="pay__units">
      <small v-i18n>Also pay with</small>
      <PaymentUnitComponent
        v-for="unit in adjustableUnits" :key="unit"
        v-model:count.number="payment[unit]"
        :unit="unit"
        :description="descriptions[unit]"
        :rate="ledger[unit].rate"
        @plus="addValue(unit)"
        @minus="reduceValue(unit)"
        @max="maxValue(unit)" />
      <span v-if="ledger.megacredits.available > 0" class="pay__mc" data-test="megacredits">
        <input :value="payment.megacredits" readonly tabindex="-1" :aria-label="$t('M€')">
        <span>M€</span>
      </span>
      <small v-for="unit in reservedUnits" :key="'reserved-' + unit" class="card-warning" v-i18n="$t(unit)">Some ${0} are reserved and unavailable here.</small>
      <small v-if="totalSpent < cost" class="pay__short">{{ $t('Missing') }} {{ cost - totalSpent }} M€</small>
      <small v-else-if="totalSpent > cost" class="pay__over">{{ $t('Overpaying') }} +{{ totalSpent - cost }} M€</small>
    </div>
    <div v-if="warning !== undefined" class="tm-warning">
      <label class="label label-error">{{ $t(warning) }}</label>
    </div>
  </section>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {Payment} from '@/common/inputs/Payment';
import {SpendableResource} from '@/common/inputs/Spendable';
import PaymentUnitComponent from '@/client/components/PaymentUnit.vue';
import {Ledger} from '@/client/components/PaymentLedger';
import {computeDefaultPayment} from '@/client/components/PaymentDefaults';
import {sum} from '@/common/utils/utils';
import {Message} from '@/common/logs/Message';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';

const DESCRIPTIONS: Record<SpendableResource, string> = {
  steel: 'Steel',
  titanium: 'Titanium',
  heat: 'Heat',
  seeds: 'Seeds',
  auroraiData: 'Data',
  kuiperAsteroids: 'Asteroids',
  spireScience: 'Science',
  megacredits: 'M€',
  floaters: 'Floaters',
  graphene: 'Graphene',
  lunaArchivesScience: 'Science',
  microbes: 'Microbes',
  plants: 'Plants',
};

function mapRecord<T extends string, U, V>(record: Record<T, U>, f: (value: U) => V): Record<T, V> {
  const entries: Array<[T, U]> = Object.entries(record) as Array<[T, U]>;
  const mapped: Array<[T, V]> = entries.map(([k, v]) => [k, f(v)]);
  return Object.fromEntries(mapped) as Record<T, V>;
}

const IN_SENTENCE_DESCRIPTIONS: Record<SpendableResource, string> = {
  ...mapRecord(DESCRIPTIONS, (v) => v.toLowerCase()),
  megacredits: 'M€',
};

type DataModel = {
  payment: Payment;
  warning: string | Message | undefined;
};

const ICONS: Partial<Record<SpendableResource, string>> = {
  kuiperAsteroids: 'resource_icon--asteroid',
  lunaArchivesScience: 'resource_icon--science',
  spireScience: 'resource_icon--science',
  auroraiData: 'resource_icon--auroraidata',
  seeds: 'resource_icon--seed',
};

export default defineComponent({
  name: 'PaymentForm',
  components: {
    PaymentUnitComponent,
  },
  props: {
    cost: {
      type: Number,
      required: true,
    },
    // Rename to something related to how it is both display order and documents the
    // resources in use.
    order: {
      type: Array as () => ReadonlyArray<SpendableResource>,
      required: true,
    },
    ledger: {
      type: Object as () => Ledger,
      required: true,
    },
    showsave: {
      type: Boolean,
      default: false,
    },
    compact: Boolean,
    autoSave: Boolean,
    buttonLabel: {
      type: String,
      required: true,
    },
  },
  emits: ['save', 'change'],
  data(): DataModel {
    return {
      payment: computeDefaultPayment(this.cost, this.order, this.ledger, /* reserveMegacredits=*/ false),
      warning: undefined,
    };
  },
  computed: {
    /** M€ alone cover the cost: the first button pays with them. */
    megacreditsOnly(): boolean {
      return this.ledger.megacredits.available >= this.cost;
    },
    /** Other resources in the payment, in the order shown. */
    usedUnits(): Array<SpendableResource> {
      return this.order.filter((unit) => unit !== 'megacredits' && this.payment[unit] > 0);
    },
    reservedUnits(): Array<SpendableResource> {
      return this.adjustableUnits.filter((unit) => this.ledger[unit]?.reserved);
    },
    usesOtherUnits(): boolean {
      return this.usedUnits.length > 0;
    },
    adjustableUnits(): Array<SpendableResource> {
      return this.order.filter((unit) => unit !== 'megacredits' && (this.ledger[unit]?.available ?? 0) > 0);
    },
    descriptions(): Record<SpendableResource, string> {
      return DESCRIPTIONS;
    },
    megaCreditsMax(): number {
      return Math.min(this.ledger['megacredits'].available, this.cost);
    },
    totalSpent(): number {
      return sum(this.order.map((unit) => this.payment[unit] * this.ledger[unit].rate));
    },
    totalSpentClass(): string {
      const total = this.totalSpent;
      if (total < this.cost) {
        return 'payments_total_under';
      } else if (total > this.cost) {
        return 'payments_total_over';
      } else {
        return 'payments_total_exact';
      }
    },
    totalSpentTitle(): string {
      const total = this.totalSpent;
      if (total < this.cost) {
        return 'Underpaying';
      } else if (total > this.cost) {
        return 'Overpaying';
      }
      return '';
    },
  },
  watch: {
    payment: {
      deep: true,
      immediate: true,
      handler(val: Payment) {
        this.$emit('change', val);
      },
    },
  },
  mounted() {
    // Nothing to choose (M€ only): playing a card dropped on the table goes straight through.
    if (this.autoSave && this.adjustableUnits.length === 0 && this.megacreditsOnly) {
      this.handleSave();
    }
  },
  methods: {
    iconClass(unit: SpendableResource): string {
      return ICONS[unit] ?? 'resource_icon--' + unit;
    },
    payWithMegacredits(): void {
      this.payment = {...Payment.EMPTY, megacredits: this.cost};
      this.handleSave();
    },
    /**
     * Returns the most MC necessary, capped by the cost of the payment.
     */
    addValue(unit: SpendableResource): void {
      // MC is special-cased because it's the currency being spent.
      if (unit === 'megacredits') {
        if (this.payment[unit] < this.megaCreditsMax) {
          this.payment[unit] += 1;
        }
      } else {
        if (this.payment[unit] < this.ledger[unit].available) {
          this.payment[unit] += 1;
          this.setRemainingMCValue();
        }
      }
    },
    reduceValue(unit: SpendableResource): void {
      if (this.payment[unit] > 0) {
        this.payment[unit] -= 1;
        if (unit !== 'megacredits') {
          this.setRemainingMCValue();
        }
      }
    },
    setRemainingMCValue(): void {
      // Amount of money non-megacredit resources account for.
      const nonMCspend = this.totalSpent - this.payment.megacredits;

      // Amount MC has to make up for
      const remainingMC = Math.max(0, this.cost - nonMCspend);

      // If MC has to make up for more than it has, this caps it.
      const megacredits = Math.min(this.ledger.megacredits.available, remainingMC);
      this.payment.megacredits = megacredits;
    },
    maxValue(unit: SpendableResource): void {
      const target = Math.min(this.ledger[unit].available, Math.floor(this.cost / this.ledger[unit].rate));

      if (this.payment[unit] < target) {
        this.payment[unit] = target;

        if (unit !== 'megacredits') {
          this.setRemainingMCValue();
        } else {
          const saved = this.payment.megacredits;
          this.payment = computeDefaultPayment(this.cost, this.order, this.ledger, /* reserveMegacredits=*/ true);
          this.payment.megacredits = saved;
        }
      }
    },
    handleSave(): void {
      this.warning = undefined;
      if (this.cost === 0) {
        this.$emit('save', this.payment);
        return;
      }
      for (const unit of this.order) {
        if (this.payment[unit] > this.ledger[unit].available) {
          this.warning = {
            message: 'You do not have enough ${0}',
            data: [{type: LogMessageDataType.STRING, value: IN_SENTENCE_DESCRIPTIONS[unit]}],
          };
          return;
        }
      }
      const delta = this.totalSpent - this.cost;
      if (delta < 0) {
        this.warning = 'Haven\'t spent enough';
        return;
      }
      if (delta > 0) {
        for (const unit of this.order) {
          if (this.payment[unit] > 0 && delta >= this.ledger[unit].rate) {
            this.warning = {
              message: 'You cannot overspend ${0}',
              data: [{type: LogMessageDataType.STRING, value: IN_SENTENCE_DESCRIPTIONS[unit]}],
            };
            return;
          }
        }
      }
      this.$emit('save', this.payment);
    },
  },
});
</script>

<style scoped lang="less">
.pay {
  display: grid;
  justify-items: center;
  gap: 10px;
}

.pay__buttons {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
}

.pay__button {
  display: inline-flex;
  min-height: 46px;
  align-items: center;
  gap: 6px;
  padding: 0 22px;
  border: 1px solid #49616d;
  border-radius: 9px;
  background: #142630;
  color: #eef6f8;
  font: inherit;
  font-weight: 800;
  letter-spacing: 0.02em;
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

  .resource_icon {
    width: 22px;
    height: 22px;
    margin: 0;
    vertical-align: middle;
  }
}

.pay__part {
  display: inline-flex;
  align-items: center;
  gap: 2px;

  & + & {
    margin-left: 4px;
  }
}

.pay__units {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 6px 12px;
  color: #cfe0e6;

  > small {
    font-size: 0.8rem;
  }

  // The stepper of a resource: small, icon then − count +.
  :deep(.payments_type) {
    display: inline-flex;
    width: auto;
    align-items: center;
    gap: 3px;
    margin: 0;

    .payments_type_icon {
      width: 26px;
      height: 26px;
      margin: 0 2px 0 0;
    }

    .payments_input {
      width: 38px;
      min-height: 30px;
      padding: 2px 4px;
      text-align: center;
    }

    .btn {
      min-width: 28px;
      height: 30px;
      padding: 0 6px;
    }
  }
}

.pay__mc {
  display: inline-flex;
  align-items: center;
  gap: 4px;

  input {
    width: 38px;
    min-height: 30px;
    padding: 2px 4px;
    border: 1px solid #6f8c9866;
    border-radius: 6px;
    background: #0b141c;
    color: #ffe36b;
    font-weight: 800;
    text-align: center;
  }
}

.pay__short {
  color: #ff9c8a;
}

.pay__over {
  color: #ffd36b;
}
</style>
