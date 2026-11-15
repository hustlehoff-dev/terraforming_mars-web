import {expect} from 'chai';
import {PlayerInput} from '../../src/server/routes/PlayerInput';
import {ApiCancelPlacement} from '../../src/server/routes/ApiCancelPlacement';
import {MockRequest, MockResponse} from './HttpMocks';
import {Game} from '../../src/server/Game';
import {TestPlayer} from '../TestPlayer';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {RouteTestScaffolding} from './RouteTestScaffolding';
import {cast} from '@/common/utils/utils';
import {CardName} from '../../src/common/cards/CardName';
import {Payment} from '../../src/common/inputs/Payment';

describe('ApiCancelPlacement', () => {
  it('takes back an action that waits for a space, with what was paid', async () => {
    const req = new MockRequest();
    const scaffolding = new RouteTestScaffolding(req);
    const player = TestPlayer.BLUE.newPlayer({beginner: true});
    const other = TestPlayer.RED.newPlayer({beginner: true});
    const game = Game.newInstance('gameid-cancel', [player, other], player, 'spectatorid');
    await scaffolding.ctx.gameLoader.add(game);
    player.megaCredits = 40;

    // Play the City standard project from the action menu: it is paid, then asks for a space.
    const menu = cast(player.getWaitingFor(), OrOptions);
    const index = menu.options.findIndex((option) => option.type === 'projectCard' && JSON.stringify(option.toModel(player)).includes('"City"'));
    expect(index).not.eq(-1);
    const res = new MockResponse();
    scaffolding.url = '/player/input?id=' + player.id;
    const post = scaffolding.post(PlayerInput.INSTANCE, res);
    const emit = Promise.resolve().then(() => {
      req.emitString(JSON.stringify({type: 'or', index, response: {type: 'projectCard', card: CardName.CITY_STANDARD_PROJECT, payment: Payment.of({megacredits: 25})}}));
      req.emitter.emit('end');
    });
    await Promise.all([emit, post]);
    expect(player.getWaitingFor()?.type).eq('space');
    expect(player.megaCredits).eq(15);
    expect(game.canCancelPlacement(player)).is.true;
    expect(JSON.parse(res.content).canCancelPlacement).is.true;

    // Cancel: the game is back before the action, with the M€.
    const cancel = new MockResponse();
    scaffolding.url = '/api/cancelplacement?id=' + player.id;
    await scaffolding.get(ApiCancelPlacement.INSTANCE, cancel);
    const model = JSON.parse(cancel.content);
    expect(model.thisPlayer.megacredits).eq(40);
    expect(model.waitingFor.type).eq('or');
    expect(model.canCancelPlacement).is.undefined;
    const restored = await scaffolding.ctx.gameLoader.getGame(game.id);
    expect(restored).not.eq(game);
    expect(restored?.getPlayerById(player.id).megaCredits).eq(40);
  });
});
