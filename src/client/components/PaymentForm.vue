<template>
  <section>
    <div v-if="compact && cost > 0" class="project-payment">
      <label v-for="(option, index) in paymentOptions" :key="index" class="project-payment__option">
        <input v-model="selectedPayment" type="radio" :name="paymentGroup" :value="index">
        <span>
          <strong>{{ option.label }}</strong>
          <small>{{ paymentSummary(option.payment) }}</small>
          <small v-if="paymentValue(option.payment) > cost">{{ $t('Overpaying') }} +{{ paymentValue(option.payment) - cost }} M€</small>
        </span>
      </label>
    </div>
    <!-- Fine-tune: change any other resource and M€ is recalculated straight away. -->
    <div v-if="compact && cost > 0 && adjustableUnits.length > 0" class="project-payment__adjust">
      <div v-for="unit in adjustableUnits" :key="unit" class="project-payment__unit">
        <PaymentUnitComponent
          v-model:count.number="payment[unit]"
          :unit="unit"
          :description="descriptions[unit]"
          :rate="ledger[unit].rate"
          @plus="adjust(() => addValue(unit))"
          @minus="adjust(() => reduceValue(unit))"
          @max="adjust(() => maxValue(unit))" />
      </div>
      <p class="project-payment__total" :class="totalSpentClass">
        <i class="resource_icon resource_icon--megacredits" aria-hidden="true"></i>
        <strong>{{ payment.megacredits }}</strong>
        <span>· {{ $t('Total') }} {{ totalSpent }} / {{ cost }} M€</span>
      </p>
    </div>
    <table v-if="!compact" class="payments_table">
      <tbody>
        <tr>
          <td></td>
          <td><i class="resource_icon payments_type_smallicon resource_icon--megacredits"></i></td>
        </tr>
        <template v-for="unit in order" :key="unit">
          <template v-if="ledger[unit]?.available > 0">
            <tr>
              <td>
                <PaymentUnitComponent
                  v-model:count.number="payment[unit]"
                  :unit="unit"
                  :description="descriptions[unit]"
                  :rate="ledger[unit].rate"
                  @plus="addValue(unit)"
                  @minus="reduceValue(unit)"
                  @max="maxValue(unit)" />
                <div v-if="ledger[unit]?.reserved" class="card-warning" v-i18n="$t(unit)">
                  Some ${0} are reserved and unavailable here.</div>
              </td>
              <td class="payments_unit_subtotal" v-if="ledger[unit].rate !== undefined && payment[unit] !== 0">
                {{ ledger[unit].rate * payment[unit] }}
              </td>
            </tr>
          </template>
        </template>
        <tr :class="totalSpentClass">
          <td class="payments_total_heading"></td>
          <td class="payments_total_value" :title="$t(totalSpentTitle)" :aria-label="$t(totalSpentTitle)">
            {{ totalSpent }}
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="warning !== undefined" class="tm-warning">
      <label class="label label-error">{{ $t(warning) }}</label>
    </div>

    <div v-if="showsave" class="payments_save">
      <AppButton size="big" @click="handleSave()" :title="$t(buttonLabel)" data-test="save" />
    </div>
  </section>
</template>

<script lang="ts">
import {defineComponent, useId} from 'vue';
import {Payment} from '@/common/inputs/Payment';
import {SpendableResource} from '@/common/inputs/Spendable';
import {getPreferences} from '@/client/utils/PreferencesManager';
import AppButton from '@/client/components/common/AppButton.vue';
import PaymentUnitComponent from '@/client/components/PaymentUnit.vue';
import {Ledger} from '@/client/components/PaymentLedger';
import {computeDefaultPayment} from '@/client/components/PaymentDefaults';
import {sum} from '@/common/utils/utils';
import {Message} from '@/common/logs/Message';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {translateTextWithParams} from '@/client/directives/i18n';

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
  selectedPayment: number;
  warning: string | Message | undefined;
  /** Overpayment already warned about; pressing again with the same amount pays. */
  overpayWarned: number | undefined;
};

export default defineComponent({
  name: 'PaymentForm',
  components: {
    AppButton,
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
  setup: () => ({paymentGroup: useId()}),
  data(): DataModel {
    return {
      payment: computeDefaultPayment(this.cost, this.order, this.ledger, /* reserveMegacredits=*/ false),
      selectedPayment: 0,
      warning: undefined,
      overpayWarned: undefined,
    };
  },
  computed: {
    paymentOptions(): Array<{label: string; payment: Payment}> {
      const suggested = computeDefaultPayment(this.cost, this.order, this.ledger, false);
      const options = [{label: this.$t('Suggested payment'), payment: suggested}];
      if (this.ledger.megacredits.available >= this.cost && suggested.megacredits !== this.cost) {
        options.push({label: this.$t('Pay with M€'), payment: {...Payment.EMPTY, megacredits: this.cost}});
      }
      if (this.compact && this.cost > this.ledger.megacredits.available) {
        for (const unit of this.order) {
          if (unit === 'megacredits' || suggested[unit] === 0) {
            continue;
          }
          const payment = computeDefaultPayment(this.cost, this.order.filter((resource) => resource !== unit), this.ledger, false);
          const delta = this.paymentValue(payment) - this.cost;
          if (delta >= 0 && this.order.every((resource) => payment[resource] === 0 || delta < this.ledger[resource].rate) &&
            !options.some((option) => this.order.every((resource) => option.payment[resource] === payment[resource]))) {
            options.push({label: translateTextWithParams('Keep ${0}', [this.$t(IN_SENTENCE_DESCRIPTIONS[unit])]), payment});
          }
        }
      }
      return options;
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
    selectedPayment(index: number) {
      if (index >= 0) {
        this.payment = {...this.paymentOptions[index].payment};
      }
    },
    paymentOptions(options: Array<{payment: Payment}>) {
      if (this.compact && this.selectedPayment >= 0) {
        this.selectedPayment = Math.min(this.selectedPayment, options.length - 1);
        this.payment = {...options[this.selectedPayment].payment};
      }
    },
    payment: {
      deep: true,
      immediate: true,
      handler(val: Payment) {
        this.$emit('change', val);
      },
    },
  },
  mounted() {
    if (this.compact && this.autoSave && this.paymentOptions.length <= 1) {
      this.handleSave();
    }
  },
  methods: {
    /** A manual change: no preset is selected any more. */
    adjust(change: () => void): void {
      this.selectedPayment = -1;
      change();
    },
    paymentValue(payment: Payment): number {
      return sum(this.order.map((unit) => payment[unit] * this.ledger[unit].rate));
    },
    paymentSummary(payment: Payment): string {
      return this.order.filter((unit) => payment[unit] > 0).map((unit) => `${payment[unit]} ${this.$t(DESCRIPTIONS[unit])}`).join(' + ');
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
        // Overpaying needs a second click instead of a browser confirm() popup.
        if (!this.compact && getPreferences().show_alerts && this.overpayWarned !== delta) {
          this.overpayWarned = delta;
          this.warning = {
            message: 'You are overpaying by ${0} M€. Press again to confirm.',
            data: [{type: LogMessageDataType.RAW_STRING, value: String(delta)}],
          };
          return;
        }
      }
      this.$emit('save', this.payment);
    },
  },
});
</script>

<style scoped lang="less">
.project-payment__adjust {
  display: grid;
  gap: 6px;
  margin-top: 8px;
  padding: 8px 10px;
  border: 1px solid #6f8c98;
  border-radius: 8px;
  background: #0d1720e6;
}

.project-payment__total {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: #eef6f8;

  .resource_icon {
    width: 24px;
    height: 24px;
  }

  strong {
    font-size: 1.2rem;
  }

  span {
    color: #a9bac2;
    font-size: 0.8rem;
  }

  &.payments_total_under span {
    color: #ff9c8a;
  }

  &.payments_total_over span {
    color: #ffd36b;
  }
}
</style>
