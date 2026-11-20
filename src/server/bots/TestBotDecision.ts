import {sum} from '../../common/utils/utils';
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
import {SelectCard} from '../inputs/SelectCard';
import {ICorporationCard} from '../cards/corporation/ICorporationCard';
import {SelectColony} from '../inputs/SelectColony';
import {BotStrategy} from './BotStrategy';

type SetupPlan = {budget: number, cardCost: number, corporation: ICorporationCard};

/** Chooses ordinary, validated input responses. Never calls a card's effect directly. */
export class TestBotDecision {
  public static choose(input: PlayerInput, player: IPlayer, setup?: SetupPlan): InputResponse | undefined {
    if (input.optional) return undefined;
    const model = input.toModel(player);
    switch (model.type) {
    case 'or': {
      if (!(input instanceof OptionsInput)) return undefined;
      const candidates = input.options.map((option, index) => ({option, index, score: this.priority(option, player)}))
        .filter(({score}) => Number.isFinite(score)).sort((a, b) => b.score - a.score);
      for (const {option, index} of candidates) {
        const response = this.choose(option, player, setup);
        if (response) return {type: 'or', index, response};
      }
      return undefined;
    }
    case 'and':
    case 'initialCards': {
      if (!(input instanceof OptionsInput)) return undefined;
      // Heat paid with heat and Stormcraft floaters (2 heat each): as much heat as allowed, floaters for the rest.
      if (model.type === 'and' && model.heatPayment !== undefined) {
        const [heatOption, floaterOption] = model.options;
        if (heatOption?.type !== 'amount' || floaterOption?.type !== 'amount') return undefined;
        const target = model.heatPayment.target;
        const floaters = Math.max(0, Math.ceil((target - heatOption.max) / 2));
        if (floaters > floaterOption.max) return undefined;
        const heat = Math.max(0, target - floaters * 2);
        return {type: 'and', responses: [{type: 'amount', amount: heat}, {type: 'amount', amount: floaters}]};
      }
      let plan = setup;
      let corporations: Array<CardName> = [];
      if (input instanceof SelectInitialCards) {
        // Two corporations mode: the 2 best, half of their M€ and the cheaper card price.
        const count = player.game.gameOptions.dualCorporations ? 2 : 1;
        const corps = [...player.dealtCorporationCards].sort((a, b) => BotStrategy.card(b, player) - BotStrategy.card(a, player)).slice(0, count);
        const corp = corps[0];
        if (!corp || corps.length < count) return undefined;
        const money = count === 2 ? Math.floor(sum(corps.map((c) => c.startingMegaCredits)) / 2) : corp.startingMegaCredits;
        const cardCost = Math.min(...corps.map((c) => c.cardCost ?? player.cardCost));
        plan = {budget: Math.max(0, money - 12), cardCost, corporation: corp};
        corporations = corps.map((c) => c.name);
      }
      const responses: Array<InputResponse> = [];
      for (const option of input.options) {
        const response = input instanceof SelectInitialCards && option === input.inputs.corp && plan ?
          {type: 'card' as const, cards: corporations} : this.choose(option, player, plan);
        if (!response) return undefined;
        responses.push(response);
      }
      return {type: model.type, responses};
    }
    case 'option': return {type: 'option'};
    case 'card': {
      if (!(input instanceof SelectCard)) return undefined;
      const title = this.title(input);
      const values = new Map<CardName, number>();
      const value = (name: CardName) => {
        const cached = values.get(name);
        if (cached !== undefined) return cached;
        const card = input.cards.find((card) => card.name === name);
        if (!card) return -Infinity;
        const score = model.selectBlueCardAction ? BotStrategy.action(card, player) : BotStrategy.card(card, player, undefined, setup?.corporation);
        values.set(name, score);
        return score;
      };
      const discarding = /discard|sell patents/i.test(title);
      let cards = model.cards.filter((card) => !card.isDisabled)
        .sort((a, b) => (discarding ? 1 : -1) * (value(a.name) - value(b.name)));
      let count = model.min;
      if (model.min === 0 && /buy|purchase|initial project/i.test(title)) {
        const cost = setup?.cardCost ?? player.cardCost;
        cards = cards.filter((card) => value(card.name) > cost);
        count = Math.min(cards.length, model.max, Math.floor((setup?.budget ?? Math.max(0, player.megaCredits - 10)) / Math.max(1, cost)));
      } else if (/sell patents/i.test(title)) {
        count = Math.min(model.max, cards.filter((card) => value(card.name) < 0).length);
      }
      if (cards.length < count) return undefined;
      return {type: 'card', cards: cards.slice(0, count).map((card) => card.name)};
    }
    case 'projectCard': {
      if (!(input instanceof SelectCardToPlay)) return undefined;
      const cards = model.cards.filter((card) => !card.isDisabled)
        .map((card) => ({card, score: BotStrategy.card(input.cards.find((candidate) => candidate.name === card.name)!, player, card.calculatedCost)}))
        .sort((a, b) => b.score - a.score).map(({card}) => card);
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
        const score = (id: typeof a) => {
          const space = player.game.board.spaces.find((space) => space.id === id);
          return space ? BotStrategy.space(space, player, this.title(input)) : 0;
        };
        return score(b) - score(a);
      });
      return spaces[0] === undefined ? undefined : {type: 'space', spaceId: spaces[0]};
    }
    case 'player': {
      const hostile = /remove|decrease|steal|lose|reduce|attack/i.test(this.title(input));
      const targets = model.players.map((color) => player.game.players.find((other) => other.color === color)).filter((other) => other !== undefined);
      targets.sort((a, b) => b.plants + b.terraformRating * 0.3 - a.plants - a.terraformRating * 0.3);
      const target = hostile ? targets.find((other) => other.id !== player.id)?.color ?? model.players[0] :
        model.players.includes(player.color) ? player.color : model.players[0];
      return target === undefined ? undefined : {type: 'player', player: target};
    }
    case 'delegate': {
      const target = model.players.includes(player.color) ? player.color : model.players[0];
      return target === undefined ? undefined : {type: 'delegate', player: target};
    }
    case 'party': return model.parties[0] === undefined ? undefined : {type: 'party', partyName: model.parties[0]};
    case 'colony': {
      if (!(input instanceof SelectColony)) return undefined;
      const build = /build|place.*colony/i.test(this.title(input));
      const colony = [...input.colonies].sort((a, b) => BotStrategy.colony(b, player, build) - BotStrategy.colony(a, player, build))[0];
      return colony ? {type: 'colony', colonyName: colony.name} : undefined;
    }
    case 'globalEvent': return model.globalEventNames[0] === undefined ? undefined : {type: 'globalEvent', globalEventName: model.globalEventNames[0]};
    case 'amount': return {type: 'amount', amount: model.maxByDefault ? model.max : model.min};
    case 'deltaProject': return model.validSteps[0] === undefined ? undefined : {type: 'deltaProject', amount: model.validSteps[0]};
    case 'resource': {
      const resource = [...model.include].sort((a, b) => BotStrategy.resource(b, player) - BotStrategy.resource(a, player))[0];
      return resource === undefined ? undefined : {type: 'resource', resource};
    }
    case 'resources': {
      const resource = [...Units.keys].sort((a, b) => BotStrategy.resource(b, player) - BotStrategy.resource(a, player))[0];
      return {type: 'resources', units: Units.of({[resource]: model.count})};
    }
    case 'productionToLose': {
      const units = Units.of({});
      const available = {...model.payProduction.units, megacredits: model.payProduction.units.megacredits + 5};
      let remaining = model.payProduction.cost;
      let pairs = input instanceof SelectProductionToLose ? input.pairs : 0;
      const resources = [...Units.keys].sort((a, b) => BotStrategy.resource(a, player) - BotStrategy.resource(b, player));
      for (const key of resources) {
        const loss = Math.min(pairs, Math.floor(available[key] / 2)) * 2;
        units[key] += loss;
        available[key] -= loss;
        remaining -= loss;
        pairs -= loss / 2;
      }
      for (const key of resources) {
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

  private static priority(input: PlayerInput, player: IPlayer): number {
    const title = this.title(input);
    if (/undo/i.test(title) || input.optional) return -Infinity;
    if (/pass/i.test(title)) return 0;
    if (/end turn/i.test(title)) return 0.1;
    if (/send.*delegate/i.test(title)) return /lobby/i.test(title) ? 3 : -1;
    if (/^Pay.*(energy|titanium|M€)/i.test(title) && typeof input.title !== 'string') {
      const amount = input.title.data.find((item) => typeof item.value === 'number')?.value;
      if (typeof amount === 'number') return -amount * (/energy/i.test(title) ? BotStrategy.resource('energy', player) : /titanium/i.test(title) ? BotStrategy.resource('titanium', player) : 1);
    }
    if (/Trade with a colony/i.test(title) && input instanceof OptionsInput) {
      const colony = input.options.find((option) => option instanceof SelectColony) as SelectColony | undefined;
      const fees = input.options.find((option) => option instanceof OptionsInput) as OptionsInput<unknown> | undefined;
      if (colony && fees) {
        const gain = Math.max(0, ...colony.colonies.map((colony) => BotStrategy.colony(colony, player)));
        const fee = Math.max(...fees.options.map((option) => this.priority(option, player)));
        return gain + fee;
      }
    }
    if (/claim.*milestone/i.test(title)) return 40;
    if (/convert.*heat/i.test(title)) return player.game.getTemperature() < player.game.max.temperature ? 20 : -1;
    if (/convert.*plants|greenery|forest/i.test(title) && input.type !== 'projectCard') return 25;
    if (input instanceof SelectCardToPlay) {
      const model = input.toModel(player);
      return Math.max(-Infinity, ...model.cards.filter((card) => !card.isDisabled).map((card) => {
        const actual = input.cards.find((candidate) => candidate.name === card.name);
        return actual ? BotStrategy.card(actual, player, card.calculatedCost) : -Infinity;
      }));
    }
    if (/sell patents/i.test(title)) return player.cardsInHand.some((card) => BotStrategy.card(card, player) < 0) ? 1 : -Infinity;
    if (input instanceof SelectCard && input.config.selectBlueCardAction) return Math.max(0, ...input.cards.map((card) => BotStrategy.action(card, player)));
    if (input instanceof OptionsInput) return Math.max(-Infinity, ...input.options.map((option) => this.priority(option, player)));
    const award = BotStrategy.award(title, player);
    if (award !== undefined) return award;
    return 2;
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
