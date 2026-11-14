import {expect} from 'chai';
import {actionMenu, cardActionOption, getMissionQuickActions, passOptionIndex} from '@/client/components/board/MissionQuickAction';
import {CardName} from '@/common/cards/CardName';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';

const menu = {
  type: 'or',
  title: 'Take your next action',
  options: [
    {type: 'card', title: 'Perform an action from a played card', selectBlueCardAction: true,
      cards: [{name: CardName.ANTS}, {name: CardName.BIRDS, isDisabled: true}]},
    {type: 'projectCard', title: 'Play project card', cards: []},
    {type: 'projectCard', title: 'Standard projects', cards: [
      {name: CardName.POWER_PLANT_STANDARD_PROJECT, calculatedCost: 11},
      {name: CardName.CITY_STANDARD_PROJECT, calculatedCost: 25, isDisabled: true},
    ]},
    {type: 'option', title: 'Pass for this generation'},
  ],
} as unknown as PlayerInputModel;

describe('Mission actions', () => {
  it('recognises the action menu and finds its options', () => {
    expect(actionMenu(menu)).eq(menu);
    expect(actionMenu({...menu, title: 'Select one option'} as PlayerInputModel)).is.undefined;
    expect(passOptionIndex(menu)).eq(3);
    const cards = cardActionOption(menu);
    expect(cards?.index).eq(0);
    expect(cards?.cards.map((card) => card.name)).deep.eq([CardName.ANTS]);
  });

  it('lists every standard project with its cost and whether it can be used', () => {
    const projects = getMissionQuickActions(menu).filter((action) => action.card !== undefined);
    expect(projects.map(({label, cost, disabled, index}) => ({label, cost, disabled, index}))).deep.eq([
      {label: 'Power Plant', cost: 11, disabled: false, index: 2},
      {label: 'City', cost: 25, disabled: true, index: 2},
    ]);
  });
});
