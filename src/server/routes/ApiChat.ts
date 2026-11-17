import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';
import {RouteError} from './RouteError';
import {readBody} from './readBody';
import {isPlayerId} from '../../common/Types';
import {IPlayer} from '../IPlayer';
import {ChatLog} from '../chat/ChatLog';
import {CHAT_MESSAGE_MAX_LENGTH, PLAYER_RING_COOLDOWN_MS, PlayerRingModel} from '../../common/models/ChatMessageModel';

/** Shortest time between two messages of one player. */
const MIN_INTERVAL_MS = 500;
const RING_LIFETIME_MS = 15_000;

/**
 * The game chat, shown in the activity feed.
 *
 * GET ?id=<participant>&since=<last id seen>: the messages after that one.
 * POST ?id=<player> with {text, after}: sends a message; answers like GET.
 * POST ?id=<player> with {ring}: rings the player of that color in the same game.
 */
export class ApiChat extends Handler {
  public static readonly INSTANCE = new ApiChat();
  private readonly rings = new WeakMap<IPlayer, PlayerRingModel & {at: number}>();
  private readonly lastRingSent = new WeakMap<IPlayer, number>();
  private ringSequence = 0;

  public override async get(_req: Request, res: Response, ctx: Context): Promise<void> {
    const id = ctx.urlParams.participantId('id');
    const game = await ctx.gameLoader.getGame(id);
    if (game === undefined) {
      throw RouteError.notFound('cannot find game for that player');
    }
    const since = ctx.urlParams.numberOrUndefined('since') ?? 0;
    const player = isPlayerId(id) ? game.players.find((player) => player.id === id) : undefined;
    const ring = player && this.isUser(player.user, ctx) ? this.rings.get(player) : undefined;
    res.setHeader('Cache-Control', 'private, no-store');
    responses.writeJson(res, ctx, {
      messages: ChatLog.get(game.id).filter((message) => message.id > since),
      ring: ring && Date.now() - ring.at < RING_LIFETIME_MS ? {id: ring.id, from: ring.from} : undefined,
    });
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
    let body: {text?: unknown, after?: unknown, ring?: unknown};
    try {
      body = JSON.parse(await readBody(req, 4_000));
      if (body === null || typeof body !== 'object') {
        throw new Error('invalid body');
      }
    } catch {
      throw RouteError.badRequest('invalid message');
    }
    if (body.ring !== undefined) {
      const target = game.players.find((candidate) => candidate.color === body.ring && candidate !== player);
      if (target === undefined) {
        throw RouteError.badRequest('invalid player to ring');
      }
      const now = Date.now();
      if (now - (this.lastRingSent.get(player) ?? -Infinity) < PLAYER_RING_COOLDOWN_MS) {
        throw RouteError.badRequest('too many rings');
      }
      this.lastRingSent.set(player, now);
      this.rings.set(target, {id: ++this.ringSequence, from: player.color, at: now});
      responses.writeJson(res, ctx, {sent: true});
      return;
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
