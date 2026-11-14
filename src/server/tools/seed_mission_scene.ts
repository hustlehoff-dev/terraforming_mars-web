/**
 * Seeds the local development database with games used to review the Mars scene.
 *
 *   npx tsx src/server/tools/seed_mission_scene.ts
 *
 * Creates three games with fixed ids (re-running replaces them):
 *   - raw Mars on Tharsis:        /player?id=pmsraw1
 *   - developed Tharsis board:    /player?id=pmsdev1  (oceans, greenery and domed cities;
 *                                  the player holds enough plants to place a greenery and
 *                                  enough MC for any standard project)
 *   - developed Amazonis Planitia: /player?id=pmsama1
 *
 * Restart the server after seeding so it picks up the new ids.
 */
import {globalInitialize} from '../globalInitialize';
import {Game} from '../Game';
import {Player} from '../Player';
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {Database} from '../database/Database';
import {BoardName} from '../../common/boards/BoardName';
import {SpaceType} from '../../common/boards/SpaceType';
import {TileType} from '../../common/TileType';
import {Phase} from '../../common/Phase';
import {GameId, PlayerId, SpectatorId} from '../../common/Types';
import {Space} from '../boards/Space';
import {ICorporationCard} from '../cards/corporation/ICorporationCard';

type Seed = {suffix: string, boardName: BoardName, developed: boolean};

const SEEDS: ReadonlyArray<Seed> = [
  {suffix: 'raw', boardName: BoardName.THARSIS, developed: false},
  {suffix: 'dev', boardName: BoardName.THARSIS, developed: true},
  {suffix: 'ama', boardName: BoardName.AMAZONIS_PLANITIA, developed: true},
];

function createGame(seed: Seed): IGame {
  const players = [
    new Player('Ares', 'red', false, 0, `pms${seed.suffix}1` as PlayerId),
    new Player('Hebe', 'blue', false, 0, `pms${seed.suffix}2` as PlayerId),
  ];
  const game = Game.newInstance(`gms${seed.suffix}` as GameId, players, players[0], `sms${seed.suffix}` as SpectatorId, {
    boardName: seed.boardName,
    corporateEra: true,
  }, 7);
  for (const player of players) {
    const corporation = game.corporationDeck.drawN(game, 1)[0] as ICorporationCard;
    player.playCorporationCard(corporation);
    // Generation 1 is over in these games, so the corporation's first action has been taken.
    player.pendingInitialActions = [];
    player.cardsInHand.push(...game.projectDeck.drawN(game, 7));
    player.megaCredits = 64;
    player.plants = 12;
    player.steel = 4;
    player.titanium = 2;
    player.heat = 6;
  }
  game.generation = seed.developed ? 6 : 2;
  game.phase = Phase.ACTION;
  return game;
}

function middleFirst(spaces: ReadonlyArray<Space>): Array<Space> {
  const mid = (spaces.length - 1) / 2;
  return spaces.map((space, index) => ({space, index}))
    .sort((a, b) => Math.abs(a.index - mid) - Math.abs(b.index - mid))
    .map(({space}) => space);
}

function develop(game: IGame) {
  const board = game.board;
  const [player, rival] = game.players;
  const free = (space: Space) => space.tile === undefined && space.spaceType !== SpaceType.COLONY;
  const add = (owner: IPlayer, space: Space, tileType: TileType) => game.simpleAddTile(owner, space, {tileType});

  // A connected sea: start from a central ocean reserve and grow through neighbouring reserves.
  const reserves = middleFirst(board.spaces.filter((space) => space.spaceType === SpaceType.OCEAN));
  const sea: Array<Space> = [reserves[0]];
  while (sea.length < 6) {
    const next = sea.flatMap((space) => board.getAdjacentSpaces(space))
      .find((space) => space.spaceType === SpaceType.OCEAN && !sea.includes(space));
    const fallback = reserves.find((space) => !sea.includes(space));
    const chosen = next ?? fallback;
    if (chosen === undefined) {
      break;
    }
    sea.push(chosen);
  }
  sea.forEach((space) => add(player, space, TileType.OCEAN));

  // Greenery along the shore, then domed cities on the inland side of the greenery.
  const shore = sea.flatMap((space) => board.getAdjacentSpaces(space))
    .filter((space, index, all) => free(space) && space.spaceType === SpaceType.LAND && all.indexOf(space) === index);
  shore.slice(0, 7).forEach((space, index) => add(index % 3 === 2 ? rival : player, space, TileType.GREENERY));

  const cities: Array<Space> = [];
  for (const space of board.spaces) {
    if (cities.length >= 3) {
      break;
    }
    const neighbours = board.getAdjacentSpaces(space);
    const nearGreenery = neighbours.some((n) => n.tile?.tileType === TileType.GREENERY);
    const nearCity = neighbours.some((n) => cities.includes(n));
    if (free(space) && space.spaceType === SpaceType.LAND && nearGreenery && !nearCity) {
      cities.push(space);
    }
  }
  cities.forEach((space, index) => add(index === 1 ? rival : player, space, TileType.CITY));

  // A small, separate greenery patch around a distant city so the board has more than one settlement.
  const remote = middleFirst(board.spaces.filter((space) => free(space) && space.spaceType === SpaceType.LAND &&
    board.getAdjacentSpaces(space).every((n) => n.tile === undefined && n.spaceType === SpaceType.LAND)))
    .slice(-1)[0];
  if (remote !== undefined) {
    add(rival, remote, TileType.CITY);
    board.getAdjacentSpaces(remote).filter(free).slice(0, 2).forEach((space) => add(rival, space, TileType.GREENERY));
  }

  game.increaseOxygenLevel(player, 2);
  game.increaseOxygenLevel(player, 2);
  game.increaseTemperature(player, 3);
  game.increaseTemperature(player, 3);
}

async function main() {
  globalInitialize();
  const db = Database.getInstance();
  await db.initialize();
  for (const seed of SEEDS) {
    const game = createGame(seed);
    if (seed.developed) {
      develop(game);
    }
    game.phase = Phase.ACTION;
    await db.saveGame(game);
    // Re-running the seed overwrites save 0, which skips the participant rows; store them explicitly.
    await db.storeParticipants({gameId: game.id, participantIds: [...game.players.map((player) => player.id), game.spectatorId]});
    console.log(`${seed.suffix}: http://localhost:${process.env.PORT ?? 8080}/player?id=${game.players[0].id}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
