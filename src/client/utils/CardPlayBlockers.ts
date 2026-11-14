import {PlayerViewModel} from '@/common/models/PlayerModel';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {Phase} from '@/common/Phase';
import {Resource} from '@/common/Resource';
import {CardRequirementDescriptor} from '@/common/cards/CardRequirementDescriptor';
import {getCard} from '@/client/cards/ClientCardManifest';

/** One reason a card cannot be played now, as an English message with ${n} parameters for translation. */
export type Blocker = {text: string, params: Array<string>};

const reason = (text: string, ...params: Array<string | number>): Blocker => ({text, params: params.map(String)});

function findProjectInput(input: PlayerInputModel | undefined): Extract<PlayerInputModel, {type: 'projectCard'}> | undefined {
  if (input === undefined || input.optional) {
    return undefined;
  }
  if (input.type === 'projectCard') {
    return input;
  }
  if (input.type === 'or') {
    for (const option of input.options) {
      const found = findProjectInput(option);
      if (found !== undefined) {
        return found;
      }
    }
  }
  return undefined;
}

function productionOf(view: PlayerViewModel, resource: Resource): number {
  const player = view.thisPlayer;
  switch (resource) {
  case Resource.MEGACREDITS: return player.megacreditProduction;
  case Resource.STEEL: return player.steelProduction;
  case Resource.TITANIUM: return player.titaniumProduction;
  case Resource.PLANTS: return player.plantProduction;
  case Resource.ENERGY: return player.energyProduction;
  case Resource.HEAT: return player.heatProduction;
  default: return 0;
  }
}

/** Requirements the client can check from the public game state. Others are left to the generic reason. */
function requirementBlockers(view: PlayerViewModel, requirements: ReadonlyArray<CardRequirementDescriptor>): Array<Blocker> {
  const game = view.game;
  const blockers: Array<Blocker> = [];
  const global = (value: number, need: number, max: boolean | undefined, minText: string, maxText: string) => {
    if (max === true ? value > need : value < need) {
      blockers.push(reason(max === true ? maxText : minText, need, value));
    }
  };
  for (const req of requirements) {
    if (req.oxygen !== undefined) {
      global(game.oxygenLevel, req.oxygen, req.max, 'Requires at least ${0}% oxygen (now ${1}%)', 'Requires at most ${0}% oxygen (now ${1}%)');
    } else if (req.temperature !== undefined) {
      global(game.temperature, req.temperature, req.max, 'Requires at least ${0}°C (now ${1}°C)', 'Requires at most ${0}°C (now ${1}°C)');
    } else if (req.oceans !== undefined) {
      global(game.oceans, req.oceans, req.max, 'Requires at least ${0} oceans (now ${1})', 'Requires at most ${0} oceans (now ${1})');
    } else if (req.venus !== undefined) {
      global(game.venusScaleLevel, req.venus, req.max, 'Requires Venus at least ${0}% (now ${1}%)', 'Requires Venus at most ${0}% (now ${1}%)');
    } else if (req.tag !== undefined && req.all !== true) {
      const need = req.count ?? 1;
      const have = (view.thisPlayer.tags[req.tag] ?? 0) + (req.tag === Tag.WILD ? 0 : (view.thisPlayer.tags[Tag.WILD] ?? 0));
      if (have < need) {
        blockers.push(reason('Requires ${0} ${1} tag(s) (you have ${2})', need, req.tag, have));
      }
    } else if (req.production !== undefined) {
      const need = req.count ?? 1;
      const have = productionOf(view, req.production);
      if (have < need) {
        blockers.push(reason('Requires ${0} production of at least ${1} (you have ${2})', req.production, need, have));
      }
    } else if (req.tr !== undefined && view.thisPlayer.terraformRating < req.tr) {
      blockers.push(reason('Requires terraform rating ${0} (you have ${1})', req.tr, view.thisPlayer.terraformRating));
    }
  }
  return blockers;
}

/**
 * Why `card` cannot be played right now. Empty when the server offers it for play.
 * The server decides playability; this explains its decision from the state the client has.
 */
export function cardPlayBlockers(view: PlayerViewModel, card: CardModel): Array<Blocker> {
  const game = view.game;
  if (game === undefined || view.thisPlayer === undefined) {
    return [];
  }
  if (game.phase !== Phase.ACTION) {
    return [reason('Project cards are played in the action phase')];
  }
  if (game.passedPlayers.includes(view.color)) {
    return [reason('You passed this generation')];
  }
  if (!view.thisPlayer.isActive) {
    return [reason('Wait for your turn')];
  }
  const input = findProjectInput(view.waitingFor);
  if (input === undefined) {
    return [reason('Finish the current decision first')];
  }
  const offered = input.cards.find((c) => c.name === card.name);
  if (offered !== undefined && offered.isDisabled !== true) {
    return [];
  }

  const blockers: Array<Blocker> = [];
  const manifest = getCard(card.name as CardName);
  blockers.push(...requirementBlockers(view, manifest?.requirements ?? []));

  const cost = offered?.calculatedCost ?? card.calculatedCost ?? manifest?.cost ?? 0;
  const tags = manifest?.tags ?? [];
  const player = view.thisPlayer;
  let budget = player.megacredits;
  if (tags.includes(Tag.BUILDING)) {
    budget += player.steel * player.steelValue;
  }
  if (tags.includes(Tag.SPACE)) {
    budget += player.titanium * player.titaniumValue;
  }
  if (budget < cost) {
    blockers.push(reason('Not enough M€: costs ${0}, you can pay ${1}', cost, budget));
  }
  if (blockers.length === 0) {
    blockers.push(reason('Its effect cannot be carried out now, for example a production you must decrease or no space for its tile'));
  }
  return blockers;
}
