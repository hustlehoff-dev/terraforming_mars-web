import {GameId} from '../../common/Types';
import {ChatMessageModel} from '../../common/models/ChatMessageModel';

/** Messages kept per game (the oldest are dropped). */
const KEEP = 300;

/**
 * The chat of every game this server has loaded. It lives outside the game object, so it is not
 * lost when the game is reloaded from the database (e.g. Undo goes back to an older save). It is
 * also saved with the game, so it comes back after a restart.
 */
const logs = new Map<GameId, Array<ChatMessageModel>>();

export const ChatLog = {
  get(gameId: GameId): Array<ChatMessageModel> {
    let log = logs.get(gameId);
    if (log === undefined) {
      log = [];
      logs.set(gameId, log);
    }
    return log;
  },

  /** A game was loaded: its saved chat, unless this server already has a newer one. */
  restore(gameId: GameId, saved: ReadonlyArray<ChatMessageModel> | undefined): void {
    const known = logs.get(gameId);
    const lastKnown = known?.[known.length - 1]?.id ?? 0;
    const lastSaved = saved?.[saved.length - 1]?.id ?? 0;
    if (saved !== undefined && lastSaved > lastKnown) {
      logs.set(gameId, [...saved]);
    }
  },

  add(gameId: GameId, message: Omit<ChatMessageModel, 'id'>): ChatMessageModel {
    const log = ChatLog.get(gameId);
    const added: ChatMessageModel = {...message, id: (log[log.length - 1]?.id ?? 0) + 1};
    log.push(added);
    if (log.length > KEEP) {
      log.splice(0, log.length - KEEP);
    }
    return added;
  },
};
