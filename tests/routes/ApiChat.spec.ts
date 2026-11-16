import {expect} from 'chai';
import {ApiChat} from '../../src/server/routes/ApiChat';
import {Game} from '../../src/server/Game';
import {TestPlayer} from '../TestPlayer';
import {MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';
import {statusCode} from '../../src/common/http/statusCode';
import {ChatLog} from '../../src/server/chat/ChatLog';
import {GameId} from '../../src/common/Types';

describe('ApiChat', () => {
  let scaffolding: RouteTestScaffolding;
  let res: MockResponse;
  let game: Game;
  let player: TestPlayer;
  let gameNumber = 0;

  beforeEach(async () => {
    scaffolding = new RouteTestScaffolding();
    res = new MockResponse();
    player = TestPlayer.BLACK.newPlayer();
    gameNumber++;
    game = Game.newInstance(`g-chat-${gameNumber}` as GameId, [player, TestPlayer.RED.newPlayer()], player, 's-chat');
    await scaffolding.ctx.gameLoader.add(game);
  });

  async function send(body: unknown) {
    scaffolding.url = `/api/chat?id=${player.id}&since=0`;
    const post = scaffolding.post(ApiChat.INSTANCE, res);
    const emit = Promise.resolve().then(() => {
      scaffolding.req.emitString(JSON.stringify(body));
      scaffolding.req.emitter.emit('end');
    });
    await Promise.all([emit, post]);
  }

  it('sends a message, which the others read after the last one they saw', async () => {
    await send({text: '  hello   there ', after: 'action:1:black'});
    expect(res.statusCode).eq(statusCode.ok);
    const [message] = JSON.parse(res.content).messages;
    expect(message).deep.include({id: 1, player: 'black', text: 'hello there', after: 'action:1:black'});

    const read = new MockResponse();
    scaffolding.url = `/api/chat?id=${game.spectatorId}&since=1`;
    await scaffolding.get(ApiChat.INSTANCE, read);
    expect(JSON.parse(read.content).messages).deep.eq([]);
  });

  it('refuses an empty message', async () => {
    await send({text: '   '});
    expect(res.statusCode).eq(statusCode.badRequest);
  });

  it('keeps the chat when the game is saved and loaded', async () => {
    ChatLog.add(game.id, {player: player.color, text: 'gg', at: 1});
    const serialized = game.serialize();
    expect(serialized.chat?.map((message) => message.text)).deep.eq(['gg']);
  });
});
