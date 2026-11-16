import {GameOptionsModel} from './GameOptionsModel';
import {ColonyModel} from './ColonyModel';
import {Color} from '../Color';
import {TurmoilModel} from './TurmoilModel';
import {ClaimedMilestoneModel} from './ClaimedMilestoneModel';
import {FundedAwardModel} from './FundedAwardModel';
import {Phase} from '../Phase';
import {AresData} from '../ares/AresData';
import {SpaceModel} from './SpaceModel';
import {MoonModel} from './MoonModel';
import {PathfindersModel} from './PathfindersModel';
import {SpectatorId} from '../Types';
import {ColonyName} from '../colonies/ColonyName';
import {GlobalParameter} from '../GlobalParameter';
import {Tag} from '../cards/Tag';

export type DeckSizeModel = {
  drawPile: number;
  discardPile: number;
};

// Sizes of the decks other than the project deck. A deck is undefined when its expansion is not in the game.
export type OtherDeckSizesModel = {
  corporations: DeckSizeModel;
  preludes: DeckSizeModel | undefined;
  ceos: DeckSizeModel | undefined;
  globalEvents: DeckSizeModel | undefined;
};

// Common data about a game not assocaited with a player (eg the temperature.)
export type GameModel = {
  aresData: AresData | undefined;
  awards: ReadonlyArray<FundedAwardModel>;
  colonies: ReadonlyArray<ColonyModel>;
  discardedColonies: ReadonlyArray<ColonyName>;
  deckSize: number;
  discardPileSize: number;
  otherDeckSizes: OtherDeckSizesModel;
  expectedPurgeTimeMs: number;
  gameAge: number;
  /** When the players still drafting must have picked (epoch ms), if the game has a draft time limit. */
  draftDeadline?: number;
  /** Set while a player has paused the game: no moves, turn clocks stopped. */
  paused?: {by: Color, at: number};
  /** The game ended before Mars was terraformed: a player surrendered, or the creator ended it. */
  endedEarly?: {by: Color, kind: 'surrender' | 'ended'};
  /**
   * Playing on until the map is full: offered on the end screen (each player agrees), and whether
   * that phase is running or was played.
   */
  playOn?: {offered: boolean, active: boolean, votes: Array<Color>};
  /** During the initial draft: which cards are drafted now (two rounds of projects, then preludes, then CEOs). */
  initialDraftStage?: 'projects' | 'preludes' | 'ceos';
  gameOptions: GameOptionsModel;
  generation: number;
  turn: number | undefined;
  globalsPerGeneration: ReadonlyArray<Partial<Record<GlobalParameter, number>>>,
  isSoloModeWin: boolean;
  lastSoloGeneration: number,
  milestones: ReadonlyArray<ClaimedMilestoneModel>;
  moon: MoonModel | undefined;
  name: string;
  oceans: number;
  oxygenLevel: number;
  passedPlayers: ReadonlyArray<Color>;
  pathfinders: PathfindersModel | undefined;
  phase: Phase;
  spaces: ReadonlyArray<SpaceModel>;
  spectatorId: SpectatorId;
  step: number;
  tags: ReadonlyArray<Tag>;
  temperature: number;
  isTerraformed: boolean;
  turmoil: TurmoilModel | undefined;
  undoCount: number;
  venusScaleLevel: number;
}
