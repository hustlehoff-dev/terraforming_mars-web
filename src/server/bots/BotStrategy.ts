import {SpaceBonus} from '../../common/boards/SpaceBonus';
import {CardName} from '../../common/cards/CardName';
import {Tag} from '../../common/cards/Tag';
import {ColonyBenefit} from '../../common/colonies/ColonyBenefit';
import {CITY_TILES, GREENERY_TILES, OCEAN_TILES} from '../../common/TileType';
import {Units} from '../../common/Units';
import {IPlayer} from '../IPlayer';
import {Behavior} from '../behavior/Behavior';
import {Counter} from '../behavior/Counter';
import {Space} from '../boards/Space';
import {ActionCard} from '../cards/ActionCard';
import {ICard, isIActionCard} from '../cards/ICard';
import {isIProjectCard} from '../cards/IProjectCard';
import {isIStandardProjectCard} from '../cards/IStandardProjectCard';
import {ICorporationCard, isICorporationCard} from '../cards/corporation/ICorporationCard';
import {IColony} from '../colonies/IColony';

// Bespoke engines whose benefits aren't in a data-defined behavior. Values diminish near game end.
const ENGINE_VALUE: Partial<Record<CardName, number>> = {
  [CardName.EARTH_CATAPULT]: 14,
  [CardName.RESEARCH_OUTPOST]: 8,
  [CardName.EARTH_OFFICE]: 5,
  [CardName.OPTIMAL_AEROBRAKING]: 7,
  [CardName.STANDARD_TECHNOLOGY]: 5,
  [CardName.ROVER_CONSTRUCTION]: 5,
  [CardName.DECOMPOSERS]: 9,
};

/** A cheap, read-only heuristic. Uses own dealt cards and public state, never opponents' hands or the deck. */
export class BotStrategy {
  public static rounds(player: IPlayer): number {
    const game = player.game;
    const steps = (game.max.temperature - game.getTemperature()) / 2 + game.max.oxygen - game.getOxygenLevel() +
      game.max.oceans - game.board.getOceanSpaces().length;
    return Math.max(1, Math.min(9, Math.ceil(steps / Math.max(3, game.players.length * 1.3))));
  }

  public static resource(resource: keyof Units, player: IPlayer): number {
    switch (resource) {
    case 'megacredits': return 1;
    case 'steel': return player.steel > 20 ? 0.6 : this.rounds(player) <= 2 && !player.cardsInHand.some((card) => card.tags.includes(Tag.BUILDING)) ? 0.8 : 1.7;
    case 'titanium': return player.titanium > 15 ? 0.8 : this.rounds(player) <= 2 && !player.cardsInHand.some((card) => card.tags.includes(Tag.SPACE)) ? 1 : 2.5;
    case 'plants': return this.rounds(player) === 1 && player.plants + player.production.asUnits().plants < player.plantsNeededForGreenery - 2 ? 0.5 :
      1.8 + (player.plants >= player.plantsNeededForGreenery - 3 ? 0.6 : 0);
    case 'energy': return player.game.colonies.length > 0 && player.production.asUnits().energy < 3 ? 2.2 : 0.8;
    case 'heat': return player.game.getTemperature() < player.game.max.temperature ? 1 : 0.05;
    }
  }

  private static cashWeight(player: IPlayer): number {
    const rounds = this.rounds(player);
    return rounds <= 2 ? 0.45 : rounds <= 4 ? 0.75 : 1;
  }

  private static trValue(player: IPlayer): number {
    return 6 + this.rounds(player) * 0.7;
  }

  private static effect(behavior: Behavior | undefined, card: ICard, player: IPlayer): number {
    if (!behavior) return 0;
    const counter = new Counter(player, card);
    const rounds = this.rounds(player);
    let value = 0;
    const stock = behavior.stock ? counter.countUnits(behavior.stock) : Units.EMPTY;
    const production = behavior.production ? counter.countUnits(behavior.production) : Units.EMPTY;
    const spend = behavior.spend as Partial<Record<keyof Units, number>> | undefined;
    for (const resource of Units.keys) {
      value += stock[resource] * this.resource(resource, player);
      const marginal = resource === 'energy' && player.production.asUnits().energy >= 3 ? 0.75 : this.resource(resource, player);
      value += production[resource] * marginal * rounds * 0.8;
      if (typeof spend?.[resource] === 'number') value -= spend[resource]! * this.resource(resource, player);
    }
    if (behavior.tr !== undefined) value += counter.count(behavior.tr) * this.trValue(player);
    if (behavior.global?.temperature) value += Math.min(Math.max(0, (player.game.max.temperature - player.game.getTemperature()) / 2), Math.max(0, behavior.global.temperature)) * this.trValue(player);
    if (behavior.global?.oxygen) value += Math.min(player.game.max.oxygen - player.game.getOxygenLevel(), Math.max(0, behavior.global.oxygen)) * this.trValue(player);
    if (behavior.global?.venus && player.game.getVenusScaleLevel() < player.game.max.venus) value += behavior.global.venus * this.trValue(player);
    if (behavior.ocean && player.game.canAddOcean()) value += (behavior.ocean.count ?? 1) * (this.trValue(player) + 4);
    if (behavior.greenery) value += 6 + (player.game.getOxygenLevel() < player.game.max.oxygen ? this.trValue(player) : 0) + 3;
    if (behavior.city) value += this.bestCity(player) + rounds * 0.5;
    if (behavior.tile) value += 3;
    if (behavior.drawCard) value += (typeof behavior.drawCard === 'number' ? behavior.drawCard : 1) * 3;
    if (behavior.standardResource) value += (typeof behavior.standardResource === 'number' ? behavior.standardResource : behavior.standardResource.count) * 1.8;
    if (behavior.greeneryDiscount) value += behavior.greeneryDiscount * rounds * 1.5;
    if (behavior.addResources !== undefined) {
      const vp = card.victoryPoints;
      const resourceValue = typeof vp === 'object' && vp.resourcesHere !== undefined ? 6 * (vp.each ?? 1) / (vp.per ?? 1) : 1;
      value += counter.count(behavior.addResources) * resourceValue;
    }
    if (behavior.colonies?.buildColony) value += 8 + rounds * 1.5;
    if (behavior.removeAnyPlants) value += Math.min(3, behavior.removeAnyPlants * 0.4);
    if (behavior.decreaseAnyProduction) value += Math.min(4, rounds * 0.5);
    return value;
  }

  public static action(card: ICard, player: IPlayer): number {
    if (card instanceof ActionCard) return this.effect(card.actionBehavior, card, player);
    if ([CardName.BIRDS, CardName.FISH, CardName.PETS].includes(card.name)) return 6;
    return 3;
  }

  public static card(card: ICard, player: IPlayer, cost?: number, corporation?: ICorporationCard): number {
    if (isICorporationCard(card)) return this.corporation(card, player);
    const rounds = this.rounds(player);
    let value = this.effect(card.behavior, card, player);
    // Don't pretend bespoke implementations have no effect; the estimate stays conservative.
    if (!card.behavior && !isIStandardProjectCard(card)) value += (card.cost ?? 0) * 0.65 + 3;
    try { value += card.getVictoryPoints(player) * 6; } catch { /* Some bespoke VP need a tile already placed. */ }
    if (isIActionCard(card)) value += Math.max(0, this.action(card, player)) * rounds * 0.65;
    value += (ENGINE_VALUE[card.name] ?? 0) * rounds / 5;
    if (card.cardDiscount) {
      const discounts = Array.isArray(card.cardDiscount) ? card.cardDiscount : [card.cardDiscount];
      for (const discount of discounts) value += discount.amount * rounds * (discount.tag ? 0.7 : 1.3);
    }
    for (const tag of card.tags) {
      if (tag === Tag.SCIENCE) value += rounds > 3 ? 2 : 0.3;
      if (tag === Tag.JOVIAN) value += player.tags.count(Tag.JOVIAN) * 0.5;
      if (tag === Tag.PLANT && player.production.asUnits().plants > 0) value += 1;
      const owns = (name: CardName) => corporation?.name === name || player.tableau.has(name);
      if (tag === Tag.EARTH && owns(CardName.POINT_LUNA)) value += 3;
      if (tag === Tag.EARTH && owns(CardName.TERACTOR)) value += 3;
      if (tag === Tag.SPACE && owns(CardName.PHOBOLOG)) value += 2;
      if (tag === Tag.PLANT && owns(CardName.ECOLINE)) value += 1.5;
      if (tag === Tag.CITY && owns(CardName.THARSIS_REPUBLIC)) value += 3 + rounds * 0.7;
      if (tag === Tag.POWER && owns(CardName.THORGATE)) value += 3;
    }
    if (isIStandardProjectCard(card)) {
      switch (card.name) {
      case CardName.AQUIFER_STANDARD_PROJECT: value = this.trValue(player) + 5; break;
      case CardName.ASTEROID_STANDARD_PROJECT: value = this.trValue(player); break;
      case CardName.GREENERY_STANDARD_PROJECT: value = 9 + (player.game.getOxygenLevel() < player.game.max.oxygen ? this.trValue(player) : 0); break;
      case CardName.CITY_STANDARD_PROJECT: value = this.bestCity(player) + rounds * 0.8; break;
      case CardName.POWER_PLANT_STANDARD_PROJECT:
        value = player.production.asUnits().energy < 3 && player.game.colonies.length > 0 ? rounds * 3 : rounds * 0.7;
        break;
      default: value = this.trValue(player);
      }
    }
    const price = cost ?? (isIProjectCard(card) ? player.getCardCost(card) : Math.max(0, card.cost ?? 0));
    return value - price * this.cashWeight(player);
  }

  private static corporation(card: ICorporationCard, player: IPlayer): number {
    let value = card.startingMegaCredits + this.effect(card.behavior, card, player);
    const rounds = this.rounds(player);
    const premium: Partial<Record<CardName, number>> = {
      [CardName.CREDICOR]: 10, [CardName.THARSIS_REPUBLIC]: 16, [CardName.POINT_LUNA]: 14,
      [CardName.MINING_GUILD]: 8, [CardName.SATURN_SYSTEMS]: 10, [CardName.MANUTECH]: 12,
      [CardName.INTERPLANETARY_CINEMATICS]: 7, [CardName.TERACTOR]: 8, [CardName.THORGATE]: 5,
    };
    value += (premium[card.name] ?? 3) * rounds / 7;
    const tag = card.name === CardName.PHOBOLOG ? Tag.SPACE : card.name === CardName.TERACTOR || card.name === CardName.POINT_LUNA ? Tag.EARTH :
      card.name === CardName.ECOLINE ? Tag.PLANT : card.name === CardName.THORGATE ? Tag.POWER : undefined;
    if (tag) value += player.dealtProjectCards.filter((project) => project.tags.includes(tag)).length * 2;
    return value;
  }

  public static space(space: Space, player: IPlayer, kind: string): number {
    const bonus: Partial<Record<SpaceBonus, number>> = {
      [SpaceBonus.DRAW_CARD]: 3, [SpaceBonus.PLANT]: this.resource('plants', player),
      [SpaceBonus.STEEL]: this.resource('steel', player), [SpaceBonus.TITANIUM]: this.resource('titanium', player),
      [SpaceBonus.HEAT]: this.resource('heat', player), [SpaceBonus.OCEAN]: 4,
    };
    let value = space.bonus.reduce((sum, resource) => sum + (bonus[resource] ?? 1), 0);
    const adjacent = player.game.board.getAdjacentSpaces(space);
    for (const other of adjacent) {
      if (other.tile && OCEAN_TILES.has(other.tile.tileType)) value += player.oceanBonus;
      if (/greenery|forest|plants/i.test(kind) && other.tile && CITY_TILES.has(other.tile.tileType)) value += other.player?.id === player.id ? 6 : -6;
      if (/city/i.test(kind)) {
        if (other.tile && GREENERY_TILES.has(other.tile.tileType)) value += 6;
        if (!other.tile) value += 0.7;
      }
    }
    return value;
  }

  private static bestCity(player: IPlayer): number {
    return Math.max(0, ...player.game.board.getAvailableSpacesForCity(player).map((space) => this.space(space, player, 'city')));
  }

  public static award(name: string, player: IPlayer): number | undefined {
    const award = player.game.awards.find((award) => award.name === name);
    if (!award) return undefined;
    const own = award.getScore(player);
    const rivals = player.game.players.filter((other) => other.id !== player.id).map((other) => award.getScore(other));
    if (rivals.some((score) => score >= own)) return -Infinity;
    return 30 * (this.rounds(player) <= 3 ? 0.85 : 0.5) - player.awardFundingCost();
  }

  public static colony(colony: IColony, player: IPlayer, build = false): number {
    const benefit = build ? colony.metadata.build : colony.metadata.trade;
    const index = build ? colony.colonies.length : Math.min(6, colony.trackPosition);
    const count = benefit.quantity[index] ?? 0;
    let value = count;
    const resource = benefit.resource;
    if (benefit.type === ColonyBenefit.GAIN_RESOURCES && resource && !Array.isArray(resource)) value = count * this.resource(resource, player);
    if (benefit.type === ColonyBenefit.GAIN_PRODUCTION && resource && !Array.isArray(resource)) value = count * this.resource(resource, player) * this.rounds(player) * 0.8;
    if ([ColonyBenefit.DRAW_CARDS, ColonyBenefit.DRAW_CARDS_AND_DISCARD_ONE, ColonyBenefit.DRAW_CARDS_AND_KEEP_ONE].includes(benefit.type)) value = count * 2.5;
    if (benefit.type === ColonyBenefit.GAIN_TR) value = count * this.trValue(player);
    if (benefit.type === ColonyBenefit.GAIN_VP) value = count * 6;
    if (build) value += this.rounds(player) * 1.5;
    return value;
  }
}
