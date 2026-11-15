import {expect} from 'chai';
import {ApiGameLogs} from '../../src/server/routes/ApiGameLogs';
import {Game} from '../../src/server/Game';
import {TestPlayer} from '../TestPlayer';
import {MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';
import {use} from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {testGame} from '@tests/TestGame';
import {statusCode} from '@/common/http/statusCode';
import {CardName} from '@/common/cards/CardName';
import {Resource} from '@/common/Resource';
import {SpaceBonus} from '@/common/boards/SpaceBonus';
import {Payment} from '@/common/inputs/Payment';
import {cast} from '@/common/utils/utils';
import {ConvoyFromEuropa} from '@/server/cards/base/ConvoyFromEuropa';
import {IoMiningIndustries} from '@/server/cards/base/IoMiningIndustries';
import {PermafrostExtraction} from '@/server/cards/base/PermafrostExtraction';
import {CupolaCity} from '@/server/cards/base/CupolaCity';
import {Birds} from '@/server/cards/base/Birds';
import {Fish} from '@/server/cards/base/Fish';
import {SellPatentsStandardProject} from '@/server/cards/base/standardProjects/SellPatentsStandardProject';
import {OrOptions} from '@/server/inputs/OrOptions';
import {SelectProjectCardToPlay} from '@/server/inputs/SelectProjectCardToPlay';
import {SelectSpace} from '@/server/inputs/SelectSpace';
import {SelectStandardProjectToPlay} from '@/server/inputs/SelectStandardProjectToPlay';
use(chaiAsPromised);

describe('ApiGameLogs', () => {
  let scaffolding: RouteTestScaffolding;
  let res: MockResponse;

  beforeEach(() => {
    scaffolding = new RouteTestScaffolding();
    res = new MockResponse();
  });

  it('fails when id not provided', async () => {
    scaffolding.url = '/api/game/logs';
    await scaffolding.get(ApiGameLogs.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).eq('Bad request: missing id parameter');
  });

  it('fails with invalid id', async () => {
    scaffolding.url = '/api/game/logs?id=game-id';
    await scaffolding.get(ApiGameLogs.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.badRequest);
    expect(res.content).eq('Bad request: invalid participant id');
  });

  it('fails when game not found', async () => {
    scaffolding.url = '/api/game/logs?id=player-invalid-id';
    await scaffolding.get(ApiGameLogs.INSTANCE, res);
    expect(res.statusCode).eq(statusCode.notFound);
    expect(res.content).eq('Not found: game not found');
  });

  it('pulls logs when no generation provided', async () => {
    const [game, player] = testGame(1);
    scaffolding.url = '/api/game/logs?id=' + player.id;
    await scaffolding.ctx.gameLoader.add(game);
    game.log('Generation ${0}', (b) => b.forNewGeneration().number(50));
    await scaffolding.get(ApiGameLogs.INSTANCE, res);
    const messages = JSON.parse(res.content);
    expect(messages.length).gt(1);
    expect(messages[messages.length - 1].message).eq('Generation ${0}');
    expect(messages[messages.length - 1].data[0].value).eq('50');
  });

  it('pulls logs for most recent generation', async () => {
    const [game, player] = testGame(1);
    scaffolding.url = '/api/game/logs?id=' + player.id + '&generation=50';
    await scaffolding.ctx.gameLoader.add(game);
    game.log('Generation ${0}', (b) => b.forNewGeneration().number(50));
    await scaffolding.get(ApiGameLogs.INSTANCE, res);
    const messages = JSON.parse(res.content);
    expect(messages).has.length(1);
    expect(messages[messages.length - 1].message).eq('Generation ${0}');
    expect(messages[messages.length - 1].data[0].value).eq('50');
  });

  it('pulls full current generation when explicitly requested', async () => {
    const [game, player] = testGame(1);
    await scaffolding.ctx.gameLoader.add(game);

    game.gameLog.length = 0;
    game.log('Generation ${0}', (b) => b.forNewGeneration().number(1));
    for (let i = 0; i < 60; i++) {
      game.log(`Log ${i}`);
    }

    scaffolding.url = '/api/game/logs?id=' + player.id + '&generation=1';
    await scaffolding.get(ApiGameLogs.INSTANCE, res);
    const messages = JSON.parse(res.content);

    expect(messages).has.length(61);
    expect(messages[0].message).eq('Generation ${0}');
    expect(messages[messages.length - 1].message).eq('Log 59');
  });

  it('pulls logs for first generation', async () => {
    const [game, player] = testGame(1);
    scaffolding.url = '/api/game/logs?id=' + player.id;
    await scaffolding.ctx.gameLoader.add(game);
    await scaffolding.get(ApiGameLogs.INSTANCE, res);
    const messages = JSON.parse(res.content);
    expect(messages.length).gt(1);
    expect(messages[messages.length - 1].message).eq('Generation ${0}');
    expect(messages[messages.length - 1].data[0].value).eq('1');
  });

  it('pulls logs for missing generation', async () => {
    const [game, player] = testGame(1);
    scaffolding.url = '/api/game/logs?id=' + player.id + '&generation=2';
    await scaffolding.ctx.gameLoader.add(game);
    await scaffolding.get(ApiGameLogs.INSTANCE, res);
    const messages = JSON.parse(res.content);
    expect(messages).is.empty;
  });

  it('returns the complete public play history in reverse order with stable keys', async () => {
    const [game, player, rival] = testGame(2);
    await scaffolding.ctx.gameLoader.add(game);
    game.gameLog.length = 0;
    game.log('${0} played ${1}', (b) => b.player(player).cardName(CardName.MINING_AREA));
    for (let i = 0; i < 55; i++) {
      game.log(`Other log ${i}`);
    }
    game.log('${0} played ${1}', (b) => b.player(player).cardName(CardName.BIRDS), {reservedFor: player});
    game.log('${0} drew ${1}', (b) => b.player(rival).cardName(CardName.FISH));
    game.log('${0} played ${1} [ ${2} ]', (b) => b.player(rival).cardName(CardName.BIRDS).markdown('payment'));

    scaffolding.url = '/api/game/logs?id=' + player.id + '&view=played-cards';
    await scaffolding.get(ApiGameLogs.INSTANCE, res);
    const history = JSON.parse(res.content);

    expect(history.map(({card, player: color}: {card: CardName, player: string}) => [card, color]))
      .deep.eq([[CardName.BIRDS, rival.color], [CardName.MINING_AREA, player.color]]);
    expect(history[0].key).not.eq(history[1].key);

    const refreshed = new MockResponse();
    game.log('An unrelated update');
    await scaffolding.get(ApiGameLogs.INSTANCE, refreshed);
    expect(JSON.parse(refreshed.content)).deep.eq(history);
  });

  it('returns concise public activity with stable keys and drops private and unrelated logs', async () => {
    const [game, player, rival] = testGame(2);
    await scaffolding.ctx.gameLoader.add(game);
    game.gameLog.length = 0;
    game.log('Generation ${0}', (b) => b.forNewGeneration().number(2));
    game.log('${0} played ${1} [ ${2} ]', (b) => b.player(rival).cardName(CardName.BIRDS).markdown('payment'));
    game.log('${0} ${1} ${2} at ${3}', (b) => b.player(player).string('placed').string('ocean tile').space(game.board.spaces[0]));
    game.log('${0} played ${1}', (b) => b.player(player).cardName(CardName.FISH), {reservedFor: player});
    game.log('${0} drew ${1}', (b) => b.player(rival).cardName(CardName.FISH), {reservedFor: rival});
    game.log('${0} ended turn', (b) => b.player(rival));

    scaffolding.url = '/api/game/logs?id=' + player.id + '&view=activity';
    await scaffolding.get(ApiGameLogs.INSTANCE, res);
    const history = JSON.parse(res.content);
    expect(history.map(({key: _key, ...event}: {key: string}) => event)).deep.eq([
      {kind: 'ended', player: rival.color},
      {kind: 'placed', player: player.color, subject: 'ocean tile', space: game.board.spaces[0].id},
      {kind: 'played', player: rival.color, card: CardName.BIRDS, spent: 'payment'},
      {kind: 'generation', subject: '2'},
    ]);

    const refreshed = new MockResponse();
    game.log('An unrelated update');
    await scaffolding.get(ApiGameLogs.INSTANCE, refreshed);
    expect(JSON.parse(refreshed.content)).deep.eq(history);
  });

  it('folds payment, own changes and changes to other players into the activity', async () => {
    const [game, player, rival] = testGame(2);
    await scaffolding.ctx.gameLoader.add(game);
    game.gameLog.length = 0;
    game.log('${0} played ${1} [ ${2} ]', (b) => b.player(player).cardName(CardName.BIRDS).markdown('-10:r:mc:'));
    player.production.add(Resource.MEGACREDITS, 1, {log: true});
    player.production.add(Resource.ENERGY, -1, {log: true});
    rival.production.add(Resource.PLANTS, -2, {log: true, from: {player}});
    player.increaseTerraformRating(1, {log: true});
    game.log('${0} passed', (b) => b.player(rival));

    scaffolding.url = '/api/game/logs?id=' + player.id + '&view=activity';
    await scaffolding.get(ApiGameLogs.INSTANCE, res);
    const history = JSON.parse(res.content);
    expect(history.map(({key: _key, ...event}: {key: string}) => event)).deep.eq([
      {kind: 'passed', player: rival.color},
      {
        kind: 'played', player: player.color, card: CardName.BIRDS, spent: '-10:r:mc:',
        effects: '+1:p:mc: -1:p:energy: +1:i:tr:',
        targets: [{player: rival.color, effects: '-2:p:plants:'}],
      },
    ]);
  });

  it('shows the sold cards to every player', async () => {
    const [game, player, rival] = testGame(2);
    await scaffolding.ctx.gameLoader.add(game);
    game.gameLog.length = 0;
    const birds = new Birds();
    const fish = new Fish();
    player.cardsInHand.push(birds, fish);
    new SellPatentsStandardProject().action(player).cb([birds, fish]);

    scaffolding.url = '/api/game/logs?id=' + rival.id + '&view=activity';
    await scaffolding.get(ApiGameLogs.INSTANCE, res);
    const history: Array<{player?: string, deck?: Array<{kind: string, cards: Array<string>}>}> = JSON.parse(res.content);
    const sale = history.find((event) => event.deck?.some((batch) => batch.kind === 'sold'));
    expect(sale?.player).eq(player.color);
    expect(sale?.deck?.find((batch) => batch.kind === 'sold')?.cards).deep.eq([CardName.BIRDS, CardName.FISH]);
  });

  it('shows buying cards the same way for every player, with the own card names of the viewer', async () => {
    const [game, player, rival] = testGame(2);
    await scaffolding.ctx.gameLoader.add(game);
    game.gameLog.length = 0;
    game.log('${0} received ${1} from the project deck', (b) => b.player(player).cardNames([CardName.BIRDS, CardName.FISH, CardName.LICHEN]), {reservedFor: player});
    game.log('${0} received ${1} from the project deck', (b) => b.player(rival).cardNames([CardName.ANTS, CardName.TARDIGRADES, CardName.ZEPPELINS, CardName.SOLETTA]), {reservedFor: rival});
    game.log('${0} ${1} ${2} card(s)', (b) => b.player(rival).string('bought').number(1));
    game.log('${0} ${1} ${2} card(s)', (b) => b.player(player).string('bought').number(2));
    game.log('You bought ${0}', (b) => b.cardNames([CardName.BIRDS, CardName.LICHEN]), {reservedFor: player});

    scaffolding.url = '/api/game/logs?id=' + player.id + '&view=activity';
    await scaffolding.get(ApiGameLogs.INSTANCE, res);
    const history = JSON.parse(res.content);
    expect(history.map(({key: _key, ...event}: {key: string}) => event)).deep.eq([
      {
        kind: 'bought', player: player.color, subject: '2 card(s)', buying: {bought: 2, discarded: 1}, spent: '-6:r:mc:',
        deck: [{kind: 'bought', cards: [CardName.BIRDS, CardName.LICHEN]}, {kind: 'discarded', cards: [CardName.FISH]}],
      },
      // The rival: only how many, never which cards.
      {kind: 'bought', player: rival.color, subject: '1 card(s)', buying: {bought: 1, discarded: 3}, spent: '-3:r:mc:'},
    ]);
  });

  it('groups the Convoy play, ocean placement and both draws across separate inputs', async () => {
    const [game, player, rival] = testGame(2);
    await scaffolding.ctx.gameLoader.add(game);
    game.gameLog.length = 0;
    const convoy = new ConvoyFromEuropa();
    player.cardsInHand.push(convoy);
    player.megaCredits = 30;
    game.projectDeck.drawPile.push(new CupolaCity(), new PermafrostExtraction(), new IoMiningIndustries());
    player.takeAction();
    const options = cast(player.getWaitingFor(), OrOptions);
    const index = options.options.findIndex((option) => option instanceof SelectProjectCardToPlay);
    player.process({type: 'or', index, response: {type: 'projectCard', card: convoy.name, payment: Payment.of({megacredits: 15})}});

    const ocean = cast(player.getWaitingFor(), SelectSpace).spaces[0];
    ocean.bonus = [SpaceBonus.DRAW_CARD, SpaceBonus.DRAW_CARD];
    player.process({type: 'space', spaceId: ocean.id});

    const readActivity = async (id: string) => {
      const response = new MockResponse();
      scaffolding.url = `/api/game/logs?id=${id}&view=activity`;
      await scaffolding.get(ApiGameLogs.INSTANCE, response);
      return JSON.parse(response.content);
    };
    const own = await readActivity(player.id);
    expect(own).has.length(1);
    expect(own[0].card).eq(convoy.name);
    expect(own[0].steps).deep.eq([
      {kind: 'draw', count: 1, deck: {kind: 'drawn', cards: [CardName.IO_MINING_INDUSTRIES]}},
      {kind: 'placed', space: ocean.id, subject: 'ocean tile'},
      {kind: 'draw', count: 2, deck: {kind: 'drawn', cards: [CardName.PERMAFROST_EXTRACTION, CardName.CUPOLA_CITY]}},
    ]);
    const other = await readActivity(rival.id);
    expect(other).has.length(1);
    expect(other[0].key).eq(own[0].key);
    expect(other[0].steps).deep.eq([
      {kind: 'draw', count: 1},
      {kind: 'placed', space: ocean.id, subject: 'ocean tile'},
      {kind: 'draw', count: 2},
    ]);

    const next = cast(player.getWaitingFor(), OrOptions);
    const project = next.options.findIndex((option) => option instanceof SelectStandardProjectToPlay);
    player.process({type: 'or', index: project, response: {
      type: 'projectCard', card: CardName.POWER_PLANT_STANDARD_PROJECT, payment: Payment.of({megacredits: 11}),
    }});
    const after = await readActivity(player.id);
    expect(after.map((event: {card?: CardName}) => event.card)).deep.eq([CardName.POWER_PLANT_STANDARD_PROJECT, convoy.name]);
    expect(after[1]).deep.eq(own[0]);
  });

  [{idx: 0, color: 'Yellow'}, {idx: 1, color: 'Orange'}, {idx: 2, color: 'Blue'}].forEach((entry) => {
    it('omits private logs for other players: ' + entry.color, async () => {
      const yellowPlayer = TestPlayer.YELLOW.newPlayer();
      const orangePlayer = TestPlayer.ORANGE.newPlayer();
      const bluePlayer = TestPlayer.BLUE.newPlayer();

      const players = [yellowPlayer, orangePlayer, bluePlayer];
      const playerUnderTest = players[entry.idx];

      const game = Game.newInstance('game-id', players, yellowPlayer, 'spectatorid');
      await scaffolding.ctx.gameLoader.add(game);

      // Remove logs to-date to simplify the test
      game.gameLog.length = 0;
      game.log('All players see this.');
      game.log('Yellow player sees this.', (_b) => {}, {reservedFor: yellowPlayer});
      game.log('Orange player sees this.', (_b) => {}, {reservedFor: orangePlayer});
      game.log('Blue player sees this.', (_b) => {}, {reservedFor: bluePlayer});

      scaffolding.url = '/api/game/logs?id=' + playerUnderTest.id;
      await scaffolding.get(ApiGameLogs.INSTANCE, res);
      const messages = JSON.parse(res.content);

      expect(messages).has.length(2);
      expect(messages[0].message).eq('All players see this.');
      expect(messages[1].message).eq(`${entry.color} player sees this.`);
    });
  });
});
