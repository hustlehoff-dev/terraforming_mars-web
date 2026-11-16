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

  it('lists every menu entry without a place on screen (colonies, Turmoil, CEO, delegates, undo)', () => {
    const turmoil = {message: '${0} (Turmoil ${1})', data: []};
    const full = {...menu, options: [
      ...(menu as {options: Array<PlayerInputModel>}).options,
      {type: 'or', title: 'Claim a milestone', options: []},
      {type: 'or', title: {message: 'Fund an award (${0} M€)', data: []}, options: []},
      {type: 'space', title: {message: 'Convert ${0} plants into greenery', data: []}},
      {type: 'option', title: 'Convert 8 heat into temperature', buttonLabel: 'Convert heat'},
      {type: 'card', title: 'Sell patents', cards: []},
      {type: 'and', title: 'Trade with a colony tile', options: []},
      {type: 'option', title: turmoil, buttonLabel: 'Pay'},
      {type: 'card', title: 'Use CEO once per game action', cards: []},
      {type: 'party', title: 'Send a delegate in an area (5 M€)'},
      {type: 'option', title: 'Undo last action', buttonLabel: 'Undo'},
      {type: 'option', title: 'End Turn'},
    ]} as unknown as PlayerInputModel;
    const others = getMissionQuickActions(full).filter((action) => action.id.startsWith('menu:'));
    expect(others.map(({index, title}) => ({index, title}))).deep.eq([
      {index: 9, title: 'Trade with a colony'},
      {index: 10, title: turmoil},
      {index: 11, title: 'Use CEO once per game action'},
      {index: 12, title: 'Send a delegate in an area (5 M€)'},
      {index: 13, title: 'Undo last action'},
    ]);
  });
});
