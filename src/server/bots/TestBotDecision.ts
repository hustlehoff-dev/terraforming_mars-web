import {CardName} from '../../common/cards/CardName';
import {Tag} from '../../common/cards/Tag';
import {InputResponse} from '../../common/inputs/InputResponse';
import {Payment, PaymentOptions} from '../../common/inputs/Payment';
import {Units} from '../../common/Units';
import {IPlayer} from '../IPlayer';
import {PlayerInput} from '../PlayerInput';
import {isIStandardProjectCard} from '../cards/IStandardProjectCard';
import {OptionsInput} from '../inputs/OptionsPlayerInput';
import {SelectInitialCards} from '../inputs/SelectInitialCards';
import {SelectCardToPlay} from '../inputs/SelectCardToPlay';
import {SelectProductionToLose} from '../inputs/SelectProductionToLose';

/** Chooses ordinary, validated input responses. Never calls a card's effect directly. */
export class TestBotDecision {
  public static choose(input: PlayerInput, player: IPlayer, initialBudget?: number): InputResponse | undefined {
    if (input.optional) return undefined;
    const model = input.toModel(player);
    switch (model.type) {
    case 'or': {
      if (!(input instanceof OptionsInput)) return undefined;
      const candidates = input.options.map((option, index) => ({option, index, score: this.priority(option)}))
        .filter(({score}) => Number.isFinite(score)).sort((a, b) => b.score - a.score);
      for (const {option, index} of candidates) {
        const response = this.choose(option, player);
        if (response) return {type: 'or', index, response};
      }
      return undefined;
    }
    case 'and':
    case 'initialCards': {
      if (!(input instanceof OptionsInput)) return undefined;
      let budget: number | undefined;
      if (input instanceof SelectInitialCards) {
        const corp = player.dealtCorporationCards[0];
        budget = Math.max(0, (corp?.startingMegaCredits ?? 0) - 10);
      }
      const responses: Array<InputResponse> = [];
      for (const option of input.options) {
        const response = this.choose(option, player, budget);
        if (!response) return undefined;
        responses.push(response);
      }
      return {type: model.type, responses};
    }
    case 'option': return {type: 'option'};
    case 'card': {
      const cards = model.cards.filter((card) => !card.isDisabled);
      let count = model.min;
      if (model.min === 0 && /buy|purchase|initial project/i.test(this.title(input))) {
        const cost = initialBudget === undefined ? player.cardCost : (player.dealtCorporationCards[0]?.cardCost ?? player.cardCost);
        count = Math.max(model.min, Math.min(model.max, 4, Math.floor((initialBudget ?? Math.max(0, player.megaCredits - 12)) / Math.max(1, cost))));
      }
      if (cards.length < count) return undefined;
      return {type: 'card', cards: cards.slice(0, count).map((card) => card.name)};
    }
    case 'projectCard': {
      if (!(input instanceof SelectCardToPlay)) return undefined;
      const cards = model.cards.filter((card) => !card.isDisabled)
        .sort((a, b) => this.projectPriority(b.name) - this.projectPriority(a.name) || (a.calculatedCost ?? 0) - (b.calculatedCost ?? 0));
      for (const cardModel of cards) {
        const card = input.cards.find((candidate) => candidate.name === cardModel.name);
        if (!card || cardModel.calculatedCost === undefined) continue;
        const standard = isIStandardProjectCard(card);
        const options: Partial<PaymentOptions> = standard ? {...model.paymentOptions, ...card.canPayWith(player)} : {
          ...model.paymentOptions,
          steel: card.tags.includes(Tag.BUILDING) || player.lastCardPlayed === CardName.LAST_RESORT_INGENUITY,
          titanium: card.tags.includes(Tag.SPACE) || player.lastCardPlayed === CardName.LAST_RESORT_INGENUITY,
        };
        const payment = this.payment(player, cardModel.calculatedCost, options, cardModel.reserveUnits);
        if (payment) return {type: 'projectCard', card: card.name, payment};
      }
      return undefined;
    }
    case 'payment': {
      const payment = this.payment(player, model.amount, model.paymentOptions, model.reserveUnits);
      return payment ? {type: 'payment', payment} : undefined;
    }
    case 'space': {
      const spaces = [...model.spaces].sort((a, b) => {
        const score = (id: typeof a) => player.game.board.spaces.find((space) => space.id === id)?.bonus.length ?? 0;
        return score(b) - score(a);
      });
      return spaces[0] === undefined ? undefined : {type: 'space', spaceId: spaces[0]};
    }
    case 'player': {
      const target = model.players.find((color) => color !== player.color) ?? model.players[0];
      return target === undefined ? undefined : {type: 'player', player: target};
    }
    case 'delegate': {
      const target = model.players.includes(player.color) ? player.color : model.players[0];
      return target === undefined ? undefined : {type: 'delegate', player: target};
    }
    case 'party': return model.parties[0] === undefined ? undefined : {type: 'party', partyName: model.parties[0]};
    case 'colony': return model.coloniesModel[0] === undefined ? undefined : {type: 'colony', colonyName: model.coloniesModel[0].name};
    case 'globalEvent': return model.globalEventNames[0] === undefined ? undefined : {type: 'globalEvent', globalEventName: model.globalEventNames[0]};
    case 'amount': return {type: 'amount', amount: model.maxByDefault ? model.max : model.min};
    case 'deltaProject': return model.validSteps[0] === undefined ? undefined : {type: 'deltaProject', amount: model.validSteps[0]};
    case 'resource': return model.include[0] === undefined ? undefined : {type: 'resource', resource: model.include[0]};
    case 'resources': return {type: 'resources', units: Units.of({megacredits: model.count})};
    case 'productionToLose': {
      const units = Units.of({});
      const available = {...model.payProduction.units, megacredits: model.payProduction.units.megacredits + 5};
      let remaining = model.payProduction.cost;
      let pairs = input instanceof SelectProductionToLose ? input.pairs : 0;
      for (const key of Units.keys) {
        const loss = Math.min(pairs, Math.floor(available[key] / 2)) * 2;
        units[key] += loss;
        available[key] -= loss;
        remaining -= loss;
        pairs -= loss / 2;
      }
      for (const key of Units.keys) {
        const loss = Math.min(remaining, Math.max(0, available[key]));
        units[key] += loss;
        remaining -= loss;
      }
      return remaining === 0 && pairs === 0 ? {type: 'productionToLose', units} : undefined;
    }
    case 'claimedUndergroundToken': return {type: 'claimedUndergroundToken', selected: model.tokens.slice(0, model.min).map((_, index) => index)};
    case 'aresGlobalParameters': return {type: 'aresGlobalParameters', response: {lowOceanDelta: 0, highOceanDelta: 0, temperatureDelta: 0, oxygenDelta: 0}};
    }
  }

  private static title(input: PlayerInput): string {
    return typeof input.title === 'string' ? input.title : input.title.message;
  }

  private static priority(input: PlayerInput): number {
    const title = this.title(input);
    if (/undo|sell patents/i.test(title)) return -Infinity;
    if (/pass/i.test(title)) return -100;
    if (/end turn/i.test(title)) return -50;
    if (/claim.*milestone|convert.*plants|convert.*heat/i.test(title)) return 100;
    if (input.type === 'projectCard') return /standard/i.test(title) ? 40 : 90;
    if (/played card/i.test(title)) return 80;
    if (/trade/i.test(title)) return 60;
    return 50;
  }

  private static projectPriority(name: CardName): number {
    if ([CardName.AQUIFER_STANDARD_PROJECT, CardName.ASTEROID_STANDARD_PROJECT, CardName.GREENERY_STANDARD_PROJECT].includes(name)) return 10;
    if (name === CardName.CITY_STANDARD_PROJECT) return 5;
    return 0;
  }

  /** Conservative payment: ordinary stock only, keeping the card's reserved resources. */
  private static payment(player: IPlayer, cost: number, options: Partial<PaymentOptions>, reserve: Readonly<Units> = Units.EMPTY): Payment | undefined {
    const payment = Payment.of({});
    for (const resource of ['steel', 'titanium', 'heat', 'megacredits'] as const) {
      const value = player.payingAmount(Payment.of({[resource]: 1}), options);
      if (value <= 0) continue;
      const remaining = Math.max(0, cost - player.payingAmount(payment, options));
      const stock = resource === 'megacredits' ? player.megaCredits : player[resource];
      const available = Math.max(0, stock - reserve[resource]);
      payment[resource] = Math.min(available, Math.ceil(remaining / value));
    }
    return player.canSpend(payment, reserve) && player.payingAmount(payment, options) >= cost ? payment : undefined;
  }
}
