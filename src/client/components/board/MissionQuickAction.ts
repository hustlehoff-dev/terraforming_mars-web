import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {Resource} from '@/common/Resource';

/** One element of what an action gives: an icon image, optional text before it, and whether it is production. */
export type ActionEffect = {img: string, text?: string, production?: boolean};

export type MissionQuickAction = {
  id: string;
  label: string;
  icon?: Resource;
  /** What the action gives, shown as icons (e.g. a greenery tile, +1 temperature). */
  effects?: ReadonlyArray<ActionEffect>;
  index: number;
  card?: CardName;
  /** M€ cost of a standard project. */
  cost?: number;
  /** Shown but not usable now. */
  disabled?: boolean;
};

const ACTION_MENU_TITLES = new Set(['Take your first action', 'Take your next action']);

function titleOf(input: PlayerInputModel): string {
  return typeof input.title === 'string' ? input.title : input.title.message;
}

/** The player's main "take an action" menu, if that is what the server is waiting for. */
export function actionMenu(input: PlayerInputModel | undefined): Extract<PlayerInputModel, {type: 'or'}> | undefined {
  return input?.type === 'or' && !input.optional && ACTION_MENU_TITLES.has(titleOf(input)) ? input : undefined;
}

/** The optional "change your draft pick" input the game offers after a pick (shown as locked in instead). */
export function isDraftRepick(input: PlayerInputModel | undefined): boolean {
  return input?.type === 'card' && titleOf(input).startsWith('You can change your selection');
}

/**
 * A choice that involves cards (choosing, discarding, putting resources on a card, the start of the
 * game, a card inside a list of options). It opens in the card window, like cards dealt from the deck.
 * The main action menu has its own places on screen.
 */
export function showsCards(input: PlayerInputModel | undefined): boolean {
  if (input === undefined || actionMenu(input) !== undefined) {
    return false;
  }
  switch (input.type) {
  case 'card':
  case 'initialCards':
  case 'projectCard':
  case 'colony':
    return true;
  case 'or':
  case 'and':
    return input.options.some(showsCards);
  default:
    return false;
  }
}

/** Index of the "Pass for this generation" option of the action menu, or -1. */
export function passOptionIndex(input: PlayerInputModel | undefined): number {
  return actionMenu(input)?.options.findIndex((option) => option.type === 'option' && titleOf(option) === 'Pass for this generation') ?? -1;
}

/** The "Perform an action from a played card" option: its index and the cards whose action can be used. */
export function cardActionOption(input: PlayerInputModel | undefined): {index: number, cards: ReadonlyArray<CardModel>} | undefined {
  const menu = actionMenu(input);
  const index = menu?.options.findIndex((option) => option.type === 'card' && option.selectBlueCardAction === true) ?? -1;
  const option = index >= 0 ? menu?.options[index] : undefined;
  return option?.type === 'card' ? {index, cards: option.cards.filter((card) => card.isDisabled !== true)} : undefined;
}

const tileImage = (name: string) => `assets/tiles/${name}.png`;
const resourceImage = (name: string) => `assets/resources/${name}.png`;
const TEMPERATURE = 'assets/global-parameters/temperature.png';

// Short labels and what each standard project gives; others fall back to the card name.
export const STANDARD_PROJECTS: Partial<Record<CardName, {label: string, effects: ReadonlyArray<ActionEffect>}>> = {
  [CardName.POWER_PLANT_STANDARD_PROJECT]: {label: 'Power Plant', effects: [{img: resourceImage('power'), text: '+1', production: true}]},
  [CardName.ASTEROID_STANDARD_PROJECT]: {label: 'Asteroid', effects: [{img: TEMPERATURE, text: '+1'}]},
  [CardName.AQUIFER_STANDARD_PROJECT]: {label: 'Aquifer', effects: [{img: tileImage('ocean'), text: '+'}]},
  [CardName.GREENERY_STANDARD_PROJECT]: {label: 'Greenery', effects: [{img: tileImage('greenery'), text: '+'}]},
  [CardName.CITY_STANDARD_PROJECT]: {label: 'City', effects: [{img: tileImage('city'), text: '+'}, {img: resourceImage('megacredit'), text: '+1', production: true}]},
};

/**
 * A standard project whose only point is a global parameter that is already at its maximum
 * (Aquifer with every ocean placed, Asteroid at the top temperature, Air Scrapping at full Venus):
 * the game would take the M€ and do nothing, so it is not offered.
 */
const PARAMETER_MAXED: ReadonlyArray<string> = ['maxoceans', 'maxtemp', 'maxvenus'];
function pointless(card: CardModel): boolean {
  return (card.warnings ?? []).some((warning) => PARAMETER_MAXED.includes(warning));
}

/** Which global parameters are already at their maximum (actions that only raise them are pointless). */
export type MaxedParameters = {temperature?: boolean, oceans?: boolean, venus?: boolean};

const MAXED_PROJECTS: Partial<Record<CardName, keyof MaxedParameters>> = {
  [CardName.AQUIFER_STANDARD_PROJECT]: 'oceans',
  [CardName.ASTEROID_STANDARD_PROJECT]: 'temperature',
  [CardName.AIR_SCRAPPING_STANDARD_PROJECT]: 'venus',
};

export function getMissionQuickActions(input: PlayerInputModel | undefined, maxed: MaxedParameters = {}): MissionQuickAction[] {
  if (input?.type !== 'or' || input.optional) {
    return [];
  }
  const actions: MissionQuickAction[] = [];
  input.options.forEach((option, index) => {
    const title = titleOf(option);
    if (option.type === 'space' && title === 'Convert ${0} plants into greenery') {
      actions.push({id: 'plants', label: 'Plant greenery', index, effects: [{img: resourceImage('plant'), text: '−8'}, {img: tileImage('greenery'), text: '+'}]});
    }
    // At the top temperature, converting heat does nothing: not offered (nor lit on the heat tile).
    if (option.type === 'option' && option.buttonLabel === 'Convert heat' && !maxed.temperature && !(option.warnings ?? []).includes('maxtemp')) {
      actions.push({id: 'heat', label: 'Raise temperature', index, effects: [{img: resourceImage('heat'), text: '−8'}, {img: TEMPERATURE, text: '+1'}]});
    }
    if (option.type === 'card' && title === 'Sell patents') {
      actions.push({id: 'sell', label: 'Sell patents', index, effects: [{img: resourceImage('card'), text: '−'}, {img: resourceImage('megacredit'), text: '+'}]});
    }
    if (option.type === 'projectCard' && title === 'Standard projects') {
      for (const card of option.cards) {
        const known = STANDARD_PROJECTS[card.name];
        actions.push({
          id: card.name,
          index,
          card: card.name,
          label: known?.label ?? card.name.replace(':SP', ''),
          effects: known?.effects,
          cost: card.calculatedCost,
          disabled: card.isDisabled === true || pointless(card) || maxed[MAXED_PROJECTS[card.name] ?? 'none' as keyof MaxedParameters] === true,
        });
      }
    }
  });
  return actions;
}
