import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';
import {RouteError} from './RouteError';
import {readBody} from './readBody';
import {isPlayerId} from '../../common/Types';
import {ChatLog} from '../chat/ChatLog';
import {CHAT_MESSAGE_MAX_LENGTH} from '../../common/models/ChatMessageModel';

/** Shortest time between two messages of one player. */
const MIN_INTERVAL_MS = 500;

/**
 * The game chat, shown in the activity feed.
 *
 * GET ?id=<participant>&since=<last id seen>: the messages after that one.
 * POST ?id=<player> with {text, after}: sends a message; answers like GET.
 */
export class ApiChat extends Handler {
  public static readonly INSTANCE = new ApiChat();

  public override async get(_req: Request, res: Response, ctx: Context): Promise<void> {
    const id = ctx.urlParams.participantId('id');
    const game = await ctx.gameLoader.getGame(id);
    if (game === undefined) {
      throw RouteError.notFound('cannot find game for that player');
    }
    const since = ctx.urlParams.numberOrUndefined('since') ?? 0;
    responses.writeJson(res, ctx, {messages: ChatLog.get(game.id).filter((message) => message.id > since)});
  }

  public override async post(req: Request, res: Response, ctx: Context): Promise<void> {
    const id = ctx.urlParams.participantId('id');
    if (!isPlayerId(id)) {
      throw RouteError.forbidden();
    }
    const game = await ctx.gameLoader.getGame(id);
    if (game === undefined) {
      throw RouteError.notFound('cannot find game for that player');
    }
    let player;
    try {
      player = game.getPlayerById(id);
    } catch {
      throw RouteError.notFound('player not found');
    }
    if (!this.isUser(player.user, ctx)) {
      throw RouteError.forbidden();
    }
    let body: {text?: unknown, after?: unknown};
    try {
      body = JSON.parse(await readBody(req, 4_000));
    } catch {
      throw RouteError.badRequest('invalid message');
    }
    const text = typeof body.text === 'string' ? body.text.replace(/\s+/g, ' ').trim().slice(0, CHAT_MESSAGE_MAX_LENGTH) : '';
    if (text === '') {
      throw RouteError.badRequest('empty message');
    }
    const log = ChatLog.get(game.id);
    const last = log.findLast((message) => message.player === player.color);
    if (last !== undefined && Date.now() - last.at < MIN_INTERVAL_MS) {
      throw RouteError.badRequest('too many messages');
    }
    const after = typeof body.after === 'string' ? body.after.slice(0, 200) : undefined;
    ChatLog.add(game.id, {player: player.color, text, at: Date.now(), after});
    const since = ctx.urlParams.numberOrUndefined('since') ?? 0;
    responses.writeJson(res, ctx, {messages: log.filter((message) => message.id > since)});
  }
}
