import * as responses from '../server/responses';
import {Handler} from './Handler';
import {Context} from './IHandler';
import {Request} from '../Request';
import {Response} from '../Response';
import {RouteError} from './RouteError';
import {isPlayerId} from '../../common/Types';
import {UndoTurn} from '../undo/UndoTurn';

/**
 * Undoing a turn with every player's consent.
 *
 * GET ?id=<participant>: the request open now, if any.
 * GET ?id=<player>&do=request|yes|no|cancel: ask, agree, refuse, or take back one's own request.
 */
export class ApiUndoTurn extends Handler {
  public static readonly INSTANCE = new ApiUndoTurn();

  public override async get(_req: Request, res: Response, ctx: Context): Promise<void> {
    const id = ctx.urlParams.participantId('id');
    const game = await ctx.gameLoader.getGame(id);
    if (game === undefined) {
      throw RouteError.notFound('cannot find game for that player');
    }
    const action = ctx.urlParams.stringOrUndefined('do');
    if (action !== undefined) {
      if (!isPlayerId(id)) {
        throw RouteError.forbidden();
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
      try {
        switch (action) {
        case 'request':
          await UndoTurn.request(game, player);
          break;
        case 'yes':
        case 'no':
          await UndoTurn.vote(game, player, action === 'yes');
          break;
        case 'cancel':
          UndoTurn.cancel(game, player);
          break;
        default:
          throw RouteError.badRequest('unknown action');
        }
      } catch (err) {
        if (err instanceof RouteError) {
          throw err;
        }
        throw RouteError.badRequest(err instanceof Error ? err.message : String(err));
      }
      await ctx.gameLoader.waitForSaves?.(game.id);
    }
    // After an undo the game in the cache is the restored one.
    const now = await ctx.gameLoader.getGame(id) ?? game;
    // Optional read-only preview, separate from the consent request and the regular status poll.
    if (ctx.urlParams.stringOrUndefined('preview') === 'true') {
      const target = await UndoTurn.findTurnStart(now);
      responses.writeJson(res, ctx, {
        ...UndoTurn.status(now),
        undoCount: now.undoCount,
        target: target === undefined ? null : {saveId: target.saveId, generation: target.serialized.generation},
      });
      return;
    }
    responses.writeJson(res, ctx, {...UndoTurn.status(now), undoCount: now.undoCount});
  }
}
