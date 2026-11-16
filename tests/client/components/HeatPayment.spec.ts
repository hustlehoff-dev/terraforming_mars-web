import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import HeatPayment from '@/client/components/HeatPayment.vue';
import {AndOptionsModel} from '@/common/models/PlayerInputModel';
import {InputResponse} from '@/common/inputs/InputResponse';

function input(heat: number, floaters: number): AndOptionsModel {
  const amount = (max: number) => ({type: 'amount' as const, title: '', buttonLabel: '', min: 0, max, maxByDefault: false});
  return {type: 'and', title: 'Select how to spend ${0} heat', buttonLabel: 'Save', options: [amount(heat), amount(floaters)], heatPayment: {target: 8}};
}

describe('HeatPayment', () => {
  it('pays with heat alone, or heat and floaters set with the stepper', async () => {
    const saved: Array<InputResponse> = [];
    const wrapper = mount(HeatPayment, {...globalConfig, props: {playerinput: input(8, 3), onsave: (out: InputResponse) => saved.push(out)}});
    await wrapper.get('[data-test=heat-only]').trigger('click');
    await wrapper.get('[data-test=floaters-plus]').trigger('click');
    await wrapper.get('[data-test=heat-mixed]').trigger('click');
    expect(saved).deep.eq([
      {type: 'and', responses: [{type: 'amount', amount: 8}, {type: 'amount', amount: 0}]},
      {type: 'and', responses: [{type: 'amount', amount: 4}, {type: 'amount', amount: 2}]},
    ]);
  });

  it('starts with the floaters needed when the heat is short', () => {
    const wrapper = mount(HeatPayment, {...globalConfig, props: {playerinput: input(7, 3), onsave: () => {}}});
    expect(wrapper.find('[data-test=heat-only]').exists()).is.false;
    expect(wrapper.get('[data-test=heat-mixed]').text()).contains('6').and.contains('1');
  });
});
