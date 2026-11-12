import {LogMessage} from '../../common/logs/LogMessage';
import {LogMessageType} from '../../common/logs/LogMessageType';
import {ParticipantId} from '../../common/Types';
import {IGame} from '../IGame';
import {Phase} from '../../common/Phase';
import {Log} from '../../common/logs/Log';
import {LogMessageData} from '../../common/logs/LogMessageData';
import {LogMessageDataType} from '../../common/logs/LogMessageDataType';
import {PlayedCardLogModel} from '../../common/models/PlayedCardLogModel';
import {GameActivityKind, GameActivityModel} from '../../common/models/GameActivityModel';
import {tileTypeToString} from '../../common/TileType';

// These are the public play events written by Player.playCard and Player.playCorporationCard.
// Match the persisted templates so the history also works for existing saved games.
const cardPlayMessages = new Set(['${0} played ${1}', '${0} played ${1} [ ${2} ]']);

type Activity = Omit<GameActivityModel, 'key'>;

const cardActions = new Map<string, GameActivityKind>([
  ['${0} used ${1} action', 'action'],
  ['${0} used ${1} standard action', 'action'],
  ['${0} took the first action of ${1} corporation', 'action'],
  ['${0} used ${1} standard project', 'project'],
]);

function toActivity(message: LogMessage): Activity | undefined {
  const [actor, detail, extra, location] = message.data;
  if (message.type === LogMessageType.NEW_GENERATION && actor?.type === LogMessageDataType.RAW_STRING) {
    return {kind: 'generation', subject: actor.value};
  }
  if (actor?.type !== LogMessageDataType.PLAYER) {
    return undefined;
  }
  const player = actor.value;
  const cardKind = cardPlayMessages.has(message.message) ? 'played' : cardActions.get(message.message);
  if (cardKind && detail?.type === LogMessageDataType.CARD) {
    return {kind: cardKind, player, card: detail.value};
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
  case '${0} built a colony on ${1}':
  case '${0} traded with ${1}':
    if (detail?.type === LogMessageDataType.COLONY) {
      return {kind: message.message.includes('traded') ? 'trade' : 'colony', player, subject: detail.value};
    }
    break;
  case '${0} raised the temperature ${1} step(s)':
  case '${0} acted as World Government and increased temperature':
    return {kind: 'temperature', player};
  case '${0} acted as World Government and increased oxygen level':
    return {kind: 'oxygen', player};
  case '${0} raised the Venus scale ${1} step(s)':
  case '${0} acted as World Government and increased Venus scale':
    return {kind: 'venus', player};
  case '${0} passed':
    return {kind: 'passed', player};
  case '${0} ended turn':
    return {kind: 'ended', player};
  }
  return undefined;
}

export class GameLogs {
  public getActivity(game: IGame): Array<GameActivityModel> {
    const history: Array<GameActivityModel> = [];
    for (let index = game.gameLog.length - 1; index >= 0; index--) {
      const message = game.gameLog[index];
      if (!message || message.playerId !== undefined) {
        continue;
      }
      const activity = toActivity(message);
      if (activity) {
        const {kind, player, card, subject, space} = activity;
        history.push({...activity, key: [index, message.timestamp, kind, player, card ?? subject, space].join(':')});
      }
    }
    return history;
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
