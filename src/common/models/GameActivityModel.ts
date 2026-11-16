import {CardName} from '../cards/CardName';
import {Color} from '../Color';
import {SpaceId} from '../Types';

export type GameActivityKind =
  'played' | 'action' | 'project' | 'placed' | 'removed' |
  'milestone' | 'award' | 'colony' | 'trade' |
  'temperature' | 'oxygen' | 'venus' | 'passed' | 'ended' | 'generation' | 'deck' | 'bought' | 'sold' |
  /** A prelude that could not be played: discarded for 15 M€. */
  'fizzled' |
  /** Double Down copying the direct effect of the other prelude. */
  'copied' |
  /** What a player got in the production phase. */
  'production';

export type DeckActivity = {
  /**
   * skipped: cards turned over and discarded while looking in the deck for one with a given tag.
   * setup: cards turned over to place the neutral tiles of a solo game.
   */
  kind: 'drawn' | 'revealed' | 'discarded' | 'offered' | 'bought' | 'sold' | 'skipped' | 'setup';
  cards: ReadonlyArray<CardName>;
  player?: Color;
};

export type ActivityStep =
  {kind: 'placed', space: SpaceId, subject: string} |
  {kind: 'removed', space: SpaceId, subject: string} |
  {kind: 'draw', player?: Color, count?: number, deck?: DeckActivity} |
  {kind: 'event', event: GameActivityKind, player?: Color, subject?: string, card?: CardName} |
  /** Resources added to (count > 0) or removed from (count < 0) a card, e.g. 1 microbe onto Decomposers. */
  {kind: 'resource', player?: Color, card: CardName, count: number, resource: string} |
  /** A short remark on the action, e.g. that World Government placed the ocean (no TR, no bonuses). */
  {kind: 'note', text: string};

export const deckLabels = {
  drawn: 'Drawn',
  revealed: 'Revealed card',
  discarded: 'Revealed and discarded',
  offered: 'Dealt from the project deck',
  bought: 'Bought',
  sold: 'Sold',
  skipped: 'Skipped in the deck',
  setup: 'Revealed to place a neutral tile',
} satisfies Record<DeckActivity['kind'], string>;

export type GameActivityModel = {
  key: string;
  kind: GameActivityKind;
  player?: Color;
  subject?: string;
  card?: CardName;
  space?: SpaceId;
  placements?: ReadonlyArray<{space: SpaceId, subject: string}>;
  steps?: ReadonlyArray<ActivityStep>;
  drawnCount?: number;
  deck?: ReadonlyArray<DeckActivity>;
  scienceGained?: 0 | 1;
  /** Buying cards (research phase): how many were bought and how many of those dealt were discarded. */
  buying?: {bought: number, discarded?: number};
  /** What the player paid, as icon shortcodes, e.g. `-13:r:mc: -2:r:steel:`. */
  spent?: string;
  /** What changed for the player as a result, e.g. `+1:p:mc: -1:p:energy: +1:i:tr:`. */
  effects?: string;
  /** Changes this caused for other players. */
  targets?: Array<{player: Color, effects: string}>;
  /** Gains that came from a played card's effect (not the card of the action), for the HUD badges. */
  triggers?: Array<{player: Color, card: CardName, effects: string}>;
};
