import * as constants from '../../common/constants';
import {BoardName} from '../../common/boards/BoardName';
import {CardName} from '../../common/cards/CardName';
import {ColonyName} from '../../common/colonies/ColonyName';
import {GameId} from '../../common/Types';
import {RandomMAOptionType} from '../../common/ma/RandomMAOptionType';
import {AgendaStyle} from '../../common/turmoil/Types';
import {Expansion} from '../../common/cards/GameModule';
import {EscapeVelocityOptions} from '../../common/game/NewGameConfig';
import {CustomMA} from '../../common/ma/CustomMA';

export type GameOptions = {
  boardName: BoardName;
  clonedGamedId: GameId | undefined;

  // Configuration
  undoOption: boolean;
  showTimers: boolean;
  /** Seconds a player has for each action turn; 0 means no limit. When it runs out the player passes. */
  turnTimeLimit: number;
  /** Seconds the other players have to pick once one player has picked a draft card; 0 means no limit. */
  draftTimeLimit: number;
  /** Seconds the other players have to buy cards once one player has bought; 0 means no limit. */
  buyTimeLimit: number;
  fastModeOption: boolean;
  showOtherPlayersVP: boolean;

  // Extensions -- Deprecated, except when importing JSON
  corporateEra: boolean;
  venusNextExtension: boolean;
  coloniesExtension: boolean;
  preludeExtension: boolean;
  prelude2Expansion: boolean;
  turmoilExtension: boolean;
  promoCardsOption: boolean;
  communityCardsOption: boolean;
  aresExtension: boolean;
  aresHazards: boolean;
  aresExtremeVariant: boolean;
  politicalAgendasExtension: AgendaStyle;
  solarPhaseOption: boolean;
  removeNegativeGlobalEventsOption: boolean;
  moonExpansion: boolean;
  pathfindersExpansion: boolean;
  ceoExtension: boolean;
  starWarsExpansion: boolean;
  underworldExpansion: boolean;
  deltaProjectExpansion: boolean;

  expansions: Record<Expansion, boolean>,

  // Variants
  draftVariant: boolean;
  initialDraftVariant: boolean;
  preludeDraftVariant: boolean;
  ceosDraftVariant: boolean;
  // corporationsDraft: boolean;
  startingCorporations: number;
  shuffleMapOption: boolean;
  randomMA: RandomMAOptionType;
  includeFanMA: boolean;
  modularMA: boolean;
  /** Solo victory by getting TR 63 by game end */
  soloTR: boolean;
  /** A 1 player game played against MarsBot */
  automa: boolean;
  customCorporationsList: ReadonlyArray<CardName>;
  bannedCards: ReadonlyArray<CardName>;
  includedCards: ReadonlyArray<CardName>;
  customColoniesList: ReadonlyArray<ColonyName>;
  customPreludes: ReadonlyArray<CardName>;
  customCeos: ReadonlyArray<CardName>;
  /** Preselected milestones and awards, used instead of the board's. Only valid when randomMA is MANUAL. */
  customMA?: CustomMA;
  startingCeos: number;
  startingPreludes: number;
  /** Moon must be completed to end the game */
  requiresMoonTrackCompletion: boolean;
  /** Venus must be completed to end the game */
  requiresVenusTrackCompletion: boolean;
  /** Standard projects cost more MC and do not require steel or titanium */
  moonStandardProjectVariant: boolean;
  /** Standard projects can be paid for with steel or titanium at a 1MC loss per alloy */
  moonStandardProjectVariant1: boolean;
  altVenusBoard: boolean;
  escapeVelocity?: EscapeVelocityOptions;
  twoCorpsVariant: boolean;
}

export const DEFAULT_GAME_OPTIONS: GameOptions = {
  altVenusBoard: false,
  aresExtension: false,
  aresHazards: true,
  aresExtremeVariant: false,
  boardName: BoardName.THARSIS,
  bannedCards: [],
  includedCards: [],
  ceoExtension: false,
  clonedGamedId: undefined,
  coloniesExtension: false,
  communityCardsOption: false,
  corporateEra: true,
  customCeos: [],
  customColoniesList: [],
  customCorporationsList: [],
  customMA: undefined,
  customPreludes: [],
  draftVariant: false,
  escapeVelocity: undefined,
  expansions: {
    corpera: false,
    promo: false,
    venus: false,
    colonies: false,
    prelude: false,
    prelude2: false,
    turmoil: false,
    community: false,
    ares: false,
    moon: false,
    pathfinders: false,
    ceo: false,
    starwars: false,
    underworld: false,
    deltaProject: false,
  },
  fastModeOption: false,
  includeFanMA: false,
  initialDraftVariant: false,
  modularMA: false,
  moonExpansion: false,
  moonStandardProjectVariant: false,
  moonStandardProjectVariant1: false,
  pathfindersExpansion: false,
  politicalAgendasExtension: 'Standard',
  preludeDraftVariant: false,
  ceosDraftVariant: false,
  preludeExtension: false,
  prelude2Expansion: false,
  promoCardsOption: false,
  randomMA: RandomMAOptionType.NONE,
  requiresMoonTrackCompletion: false,
  removeNegativeGlobalEventsOption: false,
  requiresVenusTrackCompletion: false,
  showOtherPlayersVP: false,
  showTimers: true,
  turnTimeLimit: 0,
  draftTimeLimit: 0,
  buyTimeLimit: 0,
  shuffleMapOption: false,
  solarPhaseOption: false,
  soloTR: false,
  startingCeos: constants.CEO_CARDS_DEALT_PER_PLAYER,
  startingCorporations: constants.CORPORATION_CARDS_DEALT_PER_PLAYER,
  startingPreludes: constants.PRELUDE_CARDS_DEALT_PER_PLAYER,
  starWarsExpansion: false,
  turmoilExtension: false,
  underworldExpansion: false,
  deltaProjectExpansion: false,
  automa: false,
  undoOption: false,
  venusNextExtension: false,
  twoCorpsVariant: false,
};

/**
 * Seconds for buying cards. Games created before this option existed have no value: those with
 * a draft time limit get 15 seconds, so a running game gets the limit too.
 */
export function buyTimeLimit(options: Partial<GameOptions>): number {
  return options.buyTimeLimit ?? ((options.draftTimeLimit ?? 0) > 0 ? 15 : 0);
}
