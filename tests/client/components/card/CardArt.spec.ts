import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import CardArt from '@/client/components/card/CardArt.vue';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';

describe('CardArt', () => {
  it('picks a scene from the leading tag', () => {
    const plant = shallowMount(CardArt, {...globalConfig, props: {name: CardName.ANTS, tags: [Tag.MICROBE]}});
    expect(plant.classes()).contains('card-art--microbe');
    expect(plant.attributes('style')).contains('mars-projects.jpg');

    const jovian = shallowMount(CardArt, {...globalConfig, props: {name: CardName.IO_MINING_INDUSTRIES, tags: [Tag.JOVIAN, Tag.SPACE]}});
    expect(jovian.classes()).contains('card-art--jovian');
    expect(jovian.find('.card-art__planet').exists()).is.true;
  });

  it('falls back to the Mars horizon for cards without a themed tag', () => {
    const wrapper = shallowMount(CardArt, {...globalConfig, props: {name: CardName.BUSINESS_NETWORK, tags: []}});
    expect(wrapper.classes()).contains('card-art--mars');
    expect(wrapper.attributes('aria-hidden')).eq('true');
  });
});
