import {expect} from 'chai';
import {cardPlayBlockers} from '@/client/utils/CardPlayBlockers';
import {CardName} from '@/common/cards/CardName';
import {Phase} from '@/common/Phase';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardModel} from '@/common/models/CardModel';

function view(overrides: {phase?: Phase, isActive?: boolean, passed?: boolean, oxygen?: number, megacredits?: number, waitingFor?: unknown}): PlayerViewModel {
  return {
    color: 'red',
    game: {phase: overrides.phase ?? Phase.ACTION, passedPlayers: overrides.passed ? ['red'] : [], oxygenLevel: overrides.oxygen ?? 0, temperature: -30, oceans: 0, venusScaleLevel: 0},
    thisPlayer: {isActive: overrides.isActive ?? true, megacredits: overrides.megacredits ?? 50, steel: 0, titanium: 0, steelValue: 2, titaniumValue: 3, tags: {}, terraformRating: 20},
    waitingFor: overrides.waitingFor ?? {type: 'or', options: [{type: 'projectCard', cards: [{name: CardName.BIRDS, isDisabled: true, calculatedCost: 10}]}]},
  } as unknown as PlayerViewModel;
}
const birds = {name: CardName.BIRDS, calculatedCost: 10} as CardModel;

describe('CardPlayBlockers', () => {
  it('explains turn and phase blockers', () => {
    expect(cardPlayBlockers(view({phase: Phase.RESEARCH}), birds)[0].text).to.match(/action phase/);
    expect(cardPlayBlockers(view({passed: true}), birds)[0].text).to.match(/passed/);
    expect(cardPlayBlockers(view({isActive: false}), birds)[0].text).to.match(/Wait for your turn/);
    expect(cardPlayBlockers(view({waitingFor: {type: 'space', spaces: []}}), birds)[0].text).to.match(/current decision/);
  });

  it('names an unmet global requirement and missing money', () => {
    const blockers = cardPlayBlockers(view({oxygen: 4, megacredits: 3}), birds);
    expect(blockers.map((b) => [b.text, b.params])).to.deep.eq([
      ['Requires at least ${0}% oxygen (now ${1}%)', ['13', '4']],
      ['Not enough M€: costs ${0}, you can pay ${1}', ['10', '3']],
    ]);
  });

  it('has no blockers for a card the server offers', () => {
    const playable = view({waitingFor: {type: 'projectCard', cards: [{name: CardName.BIRDS}]}});
    expect(cardPlayBlockers(playable, birds)).to.deep.eq([]);
  });
});
