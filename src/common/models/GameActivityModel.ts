import {CardName} from '../cards/CardName';
import {Color} from '../Color';
import {SpaceId} from '../Types';

export type GameActivityKind =
  'played' | 'action' | 'project' | 'placed' | 'removed' |
  'milestone' | 'award' | 'colony' | 'trade' |
  'temperature' | 'oxygen' | 'venus' | 'passed' | 'ended' | 'generation' | 'deck' | 'bought' | 'sold';

export type DeckActivity = {
  kind: 'drawn' | 'revealed' | 'discarded' | 'offered' | 'bought';
  cards: ReadonlyArray<CardName>;
  player?: Color;
};

export type ActivityStep =
  {kind: 'placed', space: SpaceId, subject: string} |
  {kind: 'removed', space: SpaceId, subject: string} |
  {kind: 'draw', player?: Color, count?: number, deck?: DeckActivity} |
  {kind: 'event', event: GameActivityKind, player?: Color, subject?: string, card?: CardName};

export const deckLabels = {
  drawn: 'Drawn',
  revealed: 'Revealed card',
  discarded: 'Revealed and discarded',
  offered: 'Dealt from the project deck',
  bought: 'Bought',
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
  /** What the player paid, as icon shortcodes, e.g. `-13:r:mc: -2:r:steel:`. */
  spent?: string;
  /** What changed for the player as a result, e.g. `+1:p:mc: -1:p:energy: +1:i:tr:`. */
  effects?: string;
  /** Changes this caused for other players. */
  targets?: Array<{player: Color, effects: string}>;
  /** Gains that came from a played card's effect (not the card of the action), for the HUD badges. */
  triggers?: Array<{player: Color, card: CardName, effects: string}>;
};
