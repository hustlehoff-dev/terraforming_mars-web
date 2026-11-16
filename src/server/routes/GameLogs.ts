import {LogMessage} from '../../common/logs/LogMessage';
import {LogMessageType} from '../../common/logs/LogMessageType';
import {ParticipantId} from '../../common/Types';
import {IGame} from '../IGame';
import {Phase} from '../../common/Phase';
import {Log} from '../../common/logs/Log';
import {LogMessageData} from '../../common/logs/LogMessageData';
import {LogMessageDataType} from '../../common/logs/LogMessageDataType';
import {PlayedCardLogModel} from '../../common/models/PlayedCardLogModel';
import {ActivityStep, DeckActivity, GameActivityKind, GameActivityModel} from '../../common/models/GameActivityModel';
import {tileTypeToString} from '../../common/TileType';
import {Color} from '../../common/Color';
import {CardName} from '../../common/cards/CardName';

// These are the public play events written by Player.playCard and Player.playCorporationCard.
// Match the persisted templates so the history also works for existing saved games.
const cardPlayMessages = new Set(['${0} played ${1}', '${0} played ${1} [ ${2} ]']);

type Activity = Omit<GameActivityModel, 'key'>;

// Unit changes written by StockBase.logUnitDelta and the terraform rating logs. They follow the
// activity that caused them, so they are folded into it as its gained / lost summary.
const unitDeltaMessages = new Set([
  '${0} gained ${1}${2}', '${0} lost ${1}${2}',
  '${0} gained ${1}${2} from ${3}', '${0} lost ${1}${2} from ${3}',
  '${0} gained ${1}${2} because of ${3}', '${0} lost ${1}${2} because of ${3}',
  '${3} stole ${1} ${2} from ${0}',
]);
const trMessages = new Map<string, string>([
  ['${0} gained ${1}:i:tr:', '+'], ['${0} gained ${1}:i:tr: from ${2}', '+'], ['${0} lost ${1}:i:tr:', '-'],
]);

/** Sums changes of the same unit, e.g. `+2:r:plants: +2:r:plants:` becomes `+4:r:plants:`. */
function sumChanges(changes: ReadonlyArray<string>): string {
  const totals = new Map<string, number>();
  for (const change of changes) {
    const match = /^([+-])(\d+)(.*)$/.exec(change);
    if (match === null) {
      continue;
    }
    const unit = match[3];
    totals.set(unit, (totals.get(unit) ?? 0) + (match[1] === '-' ? -1 : 1) * Number(match[2]));
  }
  return Array.from(totals, ([unit, total]) => `${total >= 0 ? '+' : '-'}${Math.abs(total)}${unit}`)
    .filter((text) => !/^[+-]0(?!\d)/.test(text))
    .join(' ');
}

/** The card named as the source of a unit change ("... from ${3}"), if any. */
function changeSource(message: LogMessage): CardName | undefined {
  if (!/ (from|because of) \$\{\d\}$/.test(message.message)) {
    return undefined;
  }
  const source = message.data.at(-1);
  return source?.type === LogMessageDataType.CARD ? source.value as CardName : undefined;
}

/** One player's unit change as an icon shortcode, e.g. `+1:p:mc:`, or undefined for other messages. */
function unitChange(message: LogMessage): {player: Color, text: string} | undefined {
  const [first, amount, unit] = message.data;
  // Messages with the amount and icon written into the template, e.g. '${0} gained 2:r:plants: from ${1}'.
  const inline = /^\$\{0\} (gained|lost) (\d+)(:[a-z]+:[a-z-]+:)/.exec(message.message);
  if (inline !== null && first?.type === LogMessageDataType.PLAYER) {
    return {player: first.value, text: `${inline[1] === 'lost' ? '-' : '+'}${inline[2]}${inline[3]}`};
  }
  const count = Number(amount?.value);
  if (first?.type !== LogMessageDataType.PLAYER || !Number.isFinite(count) || count === 0) {
    return undefined;
  }
  const trSign = trMessages.get(message.message);
  if (trSign !== undefined) {
    return {player: first.value, text: `${trSign}${count}:i:tr:`};
  }
  if (!unitDeltaMessages.has(message.message) || unit === undefined) {
    return undefined;
  }
  const icon = Log.shortcode(unit);
  if (icon === undefined) {
    return undefined;
  }
  const lost = message.message.startsWith('${0} lost') || message.message.startsWith('${3} stole');
  return {player: first.value, text: `${lost ? '-' : '+'}${count}${icon}`};
}

/** Messages shown as a remark under the action that caused them. */
const noteMessages = new Map<string, string>([
  ['${0} placed a Community (player marker)', 'Placed a Community marker'],
  ['${0} acted as World Government and placed an ocean', 'As World Government: ocean without TR or bonuses'],
  ['${0} acted as World Government and increased temperature', 'As World Government: temperature without TR or bonuses'],
  ['${0} acted as World Government and increased oxygen level', 'As World Government: oxygen without TR or bonuses'],
  ['${0} acted as World Government and increased Venus scale', 'As World Government: Venus without TR or bonuses'],
  ['${0} acted as World Government and removed a hazard tile', 'As World Government: hazard tile removed'],
]);

const cardActions = new Map<string, GameActivityKind>([
  ['${0} used ${1} action', 'action'],
  ['${0} used ${1} action with ${2}', 'action'],
  ['${0} used ${1} standard action', 'action'],
  ['${0} took the first action of ${1} corporation', 'action'],
  ['${0} used ${1} standard project', 'project'],
]);

const deckMessages = new Map<string, DeckActivity['kind']>([
  ['${0} revealed and discarded ${1}', 'discarded'],
  ['${0} revealed ${1}', 'revealed'],
  ['${0} revealed ${1} and ${2}', 'revealed'],
  ['Discarded ${0} cards ${1}', 'skipped'],
  ['Drew and discarded ${0} to place a ${1}', 'setup'],
  ['Drew and discarded ${0} and ${1} to place a ${2}', 'setup'],
  ['${0} drew ${1}', 'drawn'],
  ['${0} was discarded.', 'discarded'],
  ['${0} bought ${1}', 'bought'],
  ['${0} sold ${1}', 'sold'],
  ['You bought ${0}', 'bought'],
  ['${0} received ${1} from the project deck', 'offered'],
  ['The automa revealed and discarded ${0}', 'discarded'],
]);

function deckActivity(message: LogMessage): DeckActivity | undefined {
  const kind = deckMessages.get(message.message);
  if (kind === undefined) {
    return undefined;
  }
  const cards = message.data.flatMap((datum) => {
    if (datum.type === LogMessageDataType.CARD) {
      return [datum.value];
    }
    if (datum.type === LogMessageDataType.CARDS) {
      return datum.value;
    }
    return [];
  });
  return cards.length ? {kind, cards} : undefined;
}

/**
 * How a trade was paid for: the template, where the colony is in its data and the payment as icons.
 * The gains that follow (trade income, colony bonuses) are folded into the trade like any action.
 */
const tradeMessages = new Map<string, {colony: number, spent?: (data: LogMessage['data']) => string}>([
  ['${0} spent ${1}:r:mc: to trade with ${2}', {colony: 2, spent: (data) => `-${data[1]?.value}:r:mc:`}],
  ['${0} spent ${1}:r:energy: to trade with ${2}', {colony: 2, spent: (data) => `-${data[1]?.value}:r:energy:`}],
  ['${0} spent ${1}:r:titanium: to trade with ${2}', {colony: 2, spent: (data) => `-${data[1]?.value}:r:titanium:`}],
  ['${0} spent 1:cr:floater: to trade with ${1}', {colony: 1, spent: () => '-1:cr:floater:'}],
  ['${0} spent ${1}:cr:data: from ${2} to trade with ${3}', {colony: 3, spent: (data) => `-${data[1]?.value}:cr:data:`}],
  ['${0} spent ${1} ${2} from ${3} to trade with ${4}', {colony: 4}],
  ['${0} used ${1} action to trade with ${2}', {colony: 2}],
  ['${0} traded with ${1}', {colony: 1}],
]);

function toActivity(message: LogMessage): Activity | undefined {
  const [actor, detail, extra, location] = message.data;
  if (message.message === '${0} fizzled. ${1} gains 15:r:mc:' && actor?.type === LogMessageDataType.CARD && detail?.type === LogMessageDataType.PLAYER) {
    return {kind: 'fizzled', player: detail.value, card: actor.value as CardName, effects: '+15:r:mc:'};
  }
  if (message.type === LogMessageType.NEW_GENERATION && actor?.type === LogMessageDataType.RAW_STRING) {
    return {kind: 'generation', subject: actor.value};
  }
  if (actor?.type !== LogMessageDataType.PLAYER) {
    return undefined;
  }
  const player = actor.value;
  const cardKind = cardPlayMessages.has(message.message) ? 'played' : cardActions.get(message.message);
  if (cardKind && detail?.type === LogMessageDataType.CARD) {
    // '${0} played ${1} [ ${2} ]' carries the payment, e.g. `-13:r:mc: -2:r:steel:`.
    const spent = cardKind === 'played' && extra?.type === LogMessageDataType.MARKDOWN && extra.value !== '0' ? String(extra.value) : undefined;
    return {kind: cardKind, player, card: detail.value, ...(spent !== undefined ? {spent} : {})};
  }
  const trade = tradeMessages.get(message.message);
  const tradeColony = trade !== undefined ? message.data[trade.colony] : undefined;
  if (trade !== undefined && tradeColony?.type === LogMessageDataType.COLONY) {
    return {kind: 'trade', player, subject: tradeColony.value, ...(trade.spent ? {spent: trade.spent(message.data)} : {})};
  }
  switch (message.message) {
  case '${0} ${1} ${2} at ${3}':
    if (detail?.type === LogMessageDataType.STRING && extra?.type === LogMessageDataType.STRING && location?.type === LogMessageDataType.SPACE) {
      if (detail.value === 'placed' || detail.value === 'removed') {
        return {kind: detail.value, player, subject: extra.value, space: location.value};
      }
    }
    break;
  case '${0} placed a ${1} tile at ${2}':
    if (detail?.type === LogMessageDataType.TILE_TYPE && extra?.type === LogMessageDataType.SPACE) {
      return {kind: 'placed', player, subject: tileTypeToString[detail.value], space: extra.value};
    }
    break;
  case '${0} claimed ${1} milestone':
    if (detail?.type === LogMessageDataType.MILESTONE) {
      return {kind: 'milestone', player, subject: detail.value};
    }
    break;
  case '${0} funded ${1} award':
    if (detail?.type === LogMessageDataType.AWARD) {
      return {kind: 'award', player, subject: detail.value};
    }
    break;
  case '${0} production: ${1}':
    if (detail?.type === LogMessageDataType.MARKDOWN) {
      return {kind: 'production', player, effects: String(detail.value)};
    }
    break;
  case '${0} built a colony on ${1}':
    if (detail?.type === LogMessageDataType.COLONY) {
      return {kind: 'colony', player, subject: detail.value};
    }
    break;
  case '${0} raised the temperature ${1} step(s)':
  case '${0} acted as World Government and increased temperature':
    return {kind: 'temperature', player};
  case '${0} raised temperature from ${1}°C to ${2}°C':
    return {kind: 'temperature', player, subject: `${detail?.value}°C → ${extra?.value}°C`};
  case '${0} raised oxygen from ${1}% to ${2}%':
    return {kind: 'oxygen', player, subject: `${detail?.value}% → ${extra?.value}%`};
  case '${0} raised Venus from ${1}% to ${2}%':
    return {kind: 'venus', player, subject: `${detail?.value}% → ${extra?.value}%`};
  case '${0} raised temperature to ${1}°C':
    return {kind: 'temperature', player, subject: `${detail?.value}°C`};
  case '${0} raised oxygen to ${1}%':
    return {kind: 'oxygen', player, subject: `${detail?.value}%`};
  case '${0} raised Venus to ${1}%':
    return {kind: 'venus', player, subject: `${detail?.value}%`};
  case '${0} acted as World Government and increased oxygen level':
    return {kind: 'oxygen', player};
  case '${0} raised the Venus scale ${1} step(s)':
  case '${0} acted as World Government and increased Venus scale':
    return {kind: 'venus', player};
  case '${0} passed':
    return {kind: 'passed', player};
  case '${0} ran out of time':
    return {kind: 'passed', player, subject: 'time ran out'};
  case '${0} ended turn':
    return {kind: 'ended', player};
  }
  return undefined;
}

export class GameLogs {
  public getActivity(game: IGame, viewer?: ParticipantId): Array<GameActivityModel> {
    const history: Array<GameActivityModel> = [];
    let current: GameActivityModel | undefined;
    let actionId: number | undefined;
    let own: Array<string> = [];
    // A "spent" line was logged in this action: bought cards are not charged a second time.
    let spentSeen = false;
    let others = new Map<Color, Array<string>>();
    // Attach the unit changes that followed an activity to it, newest activity first in the result.
    const close = () => {
      if (current !== undefined && own.length > 0) {
        current.effects = sumChanges(own);
      }
      if (current !== undefined && others.size > 0) {
        current.targets = Array.from(others, ([player, changes]) => ({player, effects: sumChanges(changes)}));
      }
      own = [];
      others = new Map();
      spentSeen = false;
    };
    const addStep = (entry: GameActivityModel, step: ActivityStep) => {
      entry.steps = [...(entry.steps ?? []), step];
    };
    const viewerColor = game.players.find((player) => player.id === viewer)?.color;
    // How many cards each player was last dealt to choose from. Only the number is used for
    // other players: which cards stays secret.
    const offered = new Map<Color, Array<CardName>>();
    // Private "You bought ..." lines already shown in the viewer's own buying row.
    const consumed = new Set<number>();
    for (let index = 0; index < game.gameLog.length; index++) {
      const message = game.gameLog[index];
      if (message?.message === '${0} received ${1} from the project deck' && message.playerId !== undefined) {
        const owner = game.players.find((player) => player.id === message.playerId)?.color;
        const cards = message.data.find((datum) => datum.type === LogMessageDataType.CARDS)?.value;
        if (owner !== undefined && Array.isArray(cards)) {
          offered.set(owner, cards as Array<CardName>);
        }
        // Shown in the buying row that follows (bought and discarded cards), not on a row of its own.
        continue;
      }
      if (!message || (message.playerId !== undefined && message.playerId !== viewer) || consumed.has(index)) {
        continue;
      }
      // A player buying cards outside a card action (e.g. in the research phase): a line of its own
      // with how many were bought and discarded, and what it cost. The same for every player; the
      // viewer's own line also names the cards.
      if (message.action === undefined && message.data[0]?.type === LogMessageDataType.PLAYER &&
        (message.message === '${0} bought no cards' || (message.message === '${0} ${1} ${2} card(s)' && message.data[1]?.value === 'bought'))) {
        const buyer = message.data[0].value;
        const bought = message.message === '${0} bought no cards' ? 0 : Number(message.data[2]?.value) || 0;
        const dealtCards = offered.get(buyer);
        offered.delete(buyer);
        const discarded = dealtCards !== undefined ? Math.max(0, dealtCards.length - bought) : undefined;
        const cardCost = game.players.find((player) => player.color === buyer)?.cardCost ?? 3;
        const deck: Array<DeckActivity> = [];
        if (buyer === viewerColor) {
          // The viewer's own names: the private line that follows, and the dealt cards not bought.
          let boughtNames: Array<CardName> = [];
          for (let next = index + 1; next < Math.min(game.gameLog.length, index + 4); next++) {
            const follow = game.gameLog[next];
            if (follow?.message === 'You bought ${0}' && follow.playerId === viewer) {
              const cards = follow.data.find((datum) => datum.type === LogMessageDataType.CARDS)?.value;
              boughtNames = Array.isArray(cards) ? cards as Array<CardName> : [];
              consumed.add(next);
              break;
            }
          }
          if (boughtNames.length > 0) {
            deck.push({kind: 'bought', cards: boughtNames});
          }
          const rest = (dealtCards ?? []).filter((name) => !boughtNames.includes(name));
          if (rest.length > 0 && (boughtNames.length > 0 || bought === 0)) {
            deck.push({kind: 'discarded', cards: rest});
          }
        }
        close();
        current = undefined;
        history.push({
          kind: 'bought',
          player: buyer,
          subject: `${bought} card(s)`,
          buying: {bought, ...(discarded !== undefined ? {discarded} : {})},
          ...(bought > 0 ? {spent: `-${bought * cardCost}:r:mc:`} : {}),
          ...(deck.length > 0 ? {deck} : {}),
          key: `${index}:${message.timestamp}:bought:${buyer}`,
        });
        continue;
      }
      if (message.action?.id !== actionId) {
        close();
        current = undefined;
        actionId = message.action?.id;
      }
      const activity = message.playerId === undefined ? toActivity(message) : undefined;
      const deck = deckActivity(message);
      const [actor, verb, count] = message.data;
      const drawnCount = message.message === '${0} ${1} ${2} card(s)' && actor?.type === LogMessageDataType.PLAYER &&
        verb?.value === 'drew' && Number(count?.value) > 0 ? Number(count?.value) : undefined;
      const change = unitChange(message);
      if (message.action && !current && (activity || deck || drawnCount || change)) {
        current = {...activity, kind: activity?.kind ?? 'action', key: `action:${message.action.id}:${message.action.player}`, player: message.action.player};
        history.push(current);
        if (activity) {
          continue;
        }
      } else if (message.action && current && activity) {
        if (current.kind === 'action' && !current.card && (activity.card || !current.steps?.length)) {
          // A trade paid with M€ or titanium already logged the payment: not twice.
          const {spent: _spent, ...rest} = activity;
          Object.assign(current, spentSeen ? rest : activity, {player: message.action.player});
        } else if ((activity.kind === 'placed' || activity.kind === 'removed') && activity.space && activity.subject) {
          addStep(current, {kind: activity.kind, space: activity.space, subject: activity.subject});
          if (activity.kind === 'placed') {
            current.placements = [...(current.placements ?? []), {space: activity.space, subject: activity.subject}];
          }
        } else {
          addStep(current, {kind: 'event', event: activity.kind, player: activity.player, card: activity.card, subject: activity.subject});
        }
        continue;
      }
      if (deck) {
        const player = actor?.type === LogMessageDataType.PLAYER ? actor.value :
          message.playerId ? game.players.find((candidate) => candidate.id === message.playerId)?.color : undefined;
        if (current && (message.action || (current.player === player && ['played', 'action', 'project', 'placed'].includes(current.kind) &&
          deck.kind !== 'offered' && deck.kind !== 'bought'))) {
          const batch = player !== undefined && player !== current.player ? {...deck, player} : deck;
          current.deck = [...(current.deck ?? []), batch];
          const previousStep = current.steps?.at(-1);
          if (deck.kind === 'drawn' && previousStep?.kind === 'draw' &&
            (previousStep.player ?? current.player) === player && previousStep.count === deck.cards.length && !previousStep.deck) {
            previousStep.deck = batch;
          } else {
            addStep(current, {kind: 'draw', deck: batch});
          }
          if (current.card === CardName.SEARCH_FOR_LIFE && message.message === '${0} revealed and discarded ${1}') {
            current.scienceGained = 0;
          }
        } else {
          history.push({kind: 'deck', player, deck: [deck], key: `${index}:${message.timestamp}:deck:${deck.cards.join(',')}`});
        }
        continue;
      }
      if (message.playerId !== undefined) {
        continue;
      }
      if (activity) {
        if (activity.kind === 'placed' && activity.space && activity.subject && current?.player === activity.player &&
          current && (current.kind === 'project' || current.kind === 'played' || current.kind === 'action')) {
          current.placements = [...(current.placements ?? []), {space: activity.space, subject: activity.subject}];
          addStep(current, {kind: 'placed', space: activity.space, subject: activity.subject});
          continue;
        }
        close();
        const {kind, player, card, subject, space} = activity;
        current = {...activity, key: [index, message.timestamp, kind, player, card ?? subject, space].join(':')};
        history.push(current);
        // E.g. a raise as World Government: say it gives no TR and no bonuses.
        const ownNote = noteMessages.get(message.message);
        if (ownNote !== undefined) {
          addStep(current, {kind: 'note', text: ownNote});
        }
        continue;
      }
      if (current?.player === undefined) {
        continue;
      }
      const note = noteMessages.get(message.message);
      if (note !== undefined) {
        addStep(current, {kind: 'note', text: note});
        continue;
      }
      // What a player paid outside playing a card (standard project, card action, award...).
      if (message.message === '${0} spent ${1}' && actor?.type === LogMessageDataType.PLAYER) {
        const tokens = String(verb?.value ?? '').split(' ').filter((token) => /^-\d+/.test(token));
        if (actor.value === current.player) {
          spentSeen = true;
          own.push(...tokens);
        } else {
          others.set(actor.value, [...(others.get(actor.value) ?? []), ...tokens]);
        }
        continue;
      }
      if (message.message === '${0} copied the direct effect of ${1} with ${2}' && verb?.type === LogMessageDataType.CARD) {
        addStep(current, {kind: 'event', event: 'copied', card: verb.value as CardName});
        continue;
      }
      // Which card got (or lost) resources, e.g. CEO's Favorite Project adding 1 to Decomposers.
      const resourceMove = message.message === '${0} added ${1}${2} to ${3}' || message.message === '${0} added ${1}${2} to ${3} from ${4}' ? 1 :
        message.message === '${0} removed ${1}${2} from ${3} to ${4}' ? -1 : 0;
      if (resourceMove !== 0 && actor?.type === LogMessageDataType.PLAYER) {
        const [, amount, resource, target] = message.data;
        const qty = Number(amount?.value);
        if (target?.type === LogMessageDataType.CARD && Number.isFinite(qty) && qty > 0) {
          addStep(current, {kind: 'resource', ...(actor.value !== current.player ? {player: actor.value} : {}),
            card: target.value as CardName, count: resourceMove * qty, resource: String(resource?.value ?? 'resource')});
        }
        continue;
      }
      if (drawnCount && (message.action || (actor?.value === current.player && ['project', 'played', 'action', 'placed'].includes(current.kind)))) {
        current.drawnCount = (current.drawnCount ?? 0) + drawnCount;
        const player = actor?.type === LogMessageDataType.PLAYER && actor.value !== current.player ? actor.value : undefined;
        addStep(current, {kind: 'draw', count: drawnCount, ...(player ? {player} : {})});
      }
      // Buying cards is public in the board game (how many and what it cost); which cards stays secret.
      const boughtCount = actor?.type === LogMessageDataType.PLAYER && actor.value === current.player ?
        (message.message === '${0} ${1} ${2} card(s)' && verb?.value === 'bought' ? Number(count?.value) :
          message.message === '${0} bought no cards' ? 0 : undefined) : undefined;
      // Sell patents: how many cards went, and the M€ they gave.
      if (message.message === '${0} sold ${1} patents' && actor?.type === LogMessageDataType.PLAYER && actor.value === current.player) {
        const sold = Number(verb?.value);
        if (Number.isFinite(sold) && sold > 0) {
          addStep(current, {kind: 'event', event: 'sold', subject: `${sold} card(s)`});
          own.push(`+${sold}:r:mc:`);
        }
      }
      if (boughtCount !== undefined && Number.isFinite(boughtCount) && ['action', 'played', 'project'].includes(current.kind)) {
        addStep(current, {kind: 'event', event: 'bought', subject: boughtCount === 0 ? 'no cards' : `${boughtCount} card(s)`});
        if (boughtCount > 0 && !spentSeen) {
          const cardCost = game.players.find((candidate) => candidate.color === current?.player)?.cardCost ?? 3;
          own.push(`-${boughtCount * cardCost}:r:mc:`);
        }
      }
      if (current.kind === 'action' && current.card === CardName.SEARCH_FOR_LIFE &&
        actor?.type === LogMessageDataType.PLAYER && actor.value === current.player) {
        if (message.message === '${0} found life!' && current.scienceGained === 0) {
          current.scienceGained = 1;
        }
      }
      if (change === undefined) {
        continue;
      }
      const source = changeSource(message);
      if (source !== undefined && source !== current.card) {
        current.triggers = [...(current.triggers ?? []), {player: change.player, card: source, effects: change.text}];
        continue;
      }
      if (change.player === current.player) {
        own.push(change.text);
      } else {
        others.set(change.player, [...(others.get(change.player) ?? []), change.text]);
      }
    }
    close();
    return history.reverse();
  }

  public getPlayedCardHistory(game: IGame): Array<PlayedCardLogModel> {
    const history: Array<PlayedCardLogModel> = [];
    for (let index = game.gameLog.length - 1; index >= 0; index--) {
      const message = game.gameLog[index];
      if (!message || message.playerId !== undefined || !cardPlayMessages.has(message.message)) {
        continue;
      }
      const [player, card] = message.data;
      if (player?.type === LogMessageDataType.PLAYER && card?.type === LogMessageDataType.CARD) {
        history.push({
          key: `${index}:${message.timestamp}:${player.value}:${card.value}`,
          player: player.value,
          card: card.value,
        });
      }
    }
    return history;
  }

  private getLogsForGeneration(messages: Array<LogMessage>, generation: number): Array<LogMessage> {
    let foundStart = generation === 1;
    const newMessages = [];
    for (const message of messages) {
      if (message.type === LogMessageType.NEW_GENERATION) {
        const value = Number(message.data[0]?.value);
        if (value === generation) {
          foundStart = true;
        } else if (value === generation + 1) {
          break;
        }
      }
      if (foundStart === true) {
        newMessages.push(message);
      }
    }
    return newMessages;
  }

  public getLogsForGameView(playerId: ParticipantId, game: IGame, generation: number | undefined): Array<LogMessage> {
    const messagesForPlayer = (message: LogMessage) => {
      try {
        if (message === undefined || message === null) {
          return false;
        }
        return message.playerId === undefined || message.playerId === playerId;
      } catch (e) {
        console.error('Error checking message for player', e);
        return false;
      }
    };

    // Default view keeps the payload small. An explicit generation request should
    // always return the full generation, including the current one.
    if (generation === undefined) {
      return game.gameLog.filter(messagesForPlayer).slice(-50);
    }
    return this.getLogsForGeneration(game.gameLog, generation).filter(messagesForPlayer);
  }

  public getLogsForGameEnd(game: IGame): Array<string> {
    if (game.phase !== Phase.END) {
      throw new Error('Game is not over');
    }

    return game.gameLog.map((message) => Log.applyData(message, (datum: LogMessageData) => {
      if (datum.type === undefined || datum.value === undefined) {
        return '';
      }

      switch (datum.type) {
      case LogMessageDataType.PLAYER:
        for (const player of game.players) {
          if (datum.value === player.color) {
            return player.name;
          }
        }
        // Fall-back, show the player color.
        return datum.value;

      case LogMessageDataType.RESOURCE:
      case LogMessageDataType.PRODUCTION:
      case LogMessageDataType.CARD_RESOURCE:
        return Log.shortcode(datum) ?? datum.value.toString();

      case LogMessageDataType.CARD:
      case LogMessageDataType.GLOBAL_EVENT:
      case LogMessageDataType.TILE_TYPE:
      case LogMessageDataType.COLONY:
      default:
        return datum.value.toString();
      }
    }));
  }
}
