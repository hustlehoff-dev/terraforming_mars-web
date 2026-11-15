import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import ActivityCardReveal from '@/client/components/logpanel/ActivityCardReveal.vue';
import {CardName} from '@/common/cards/CardName';

describe('ActivityCardReveal', () => {
  it('shows two draws of the same player as one group: one title, the cards side by side', () => {
    const wrapper = mount(ActivityCardReveal, {
      ...globalConfig,
      props: {batches: [{kind: 'drawn', cards: [CardName.CORPORATE_STRONGHOLD]}, {kind: 'drawn', cards: [CardName.IMPACTOR_SWARM]}]},
    });
    try {
      const titles = document.body.querySelectorAll('.activity-card-reveal .wf-component-title');
      expect(titles).has.length(1);
      expect(document.body.querySelectorAll('.activity-card-reveal .cardbox')).has.length(2);
    } finally {
      wrapper.unmount();
    }
  });
});
