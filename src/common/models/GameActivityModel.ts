import {CardName} from '../cards/CardName';
import {Color} from '../Color';
import {SpaceId} from '../Types';

export type GameActivityKind =
  'played' | 'action' | 'project' | 'placed' | 'removed' |
  'milestone' | 'award' | 'colony' | 'trade' |
  'temperature' | 'oxygen' | 'venus' | 'passed' | 'ended' | 'generation';

export type GameActivityModel = {
  key: string;
  kind: GameActivityKind;
  player?: Color;
  subject?: string;
  card?: CardName;
  space?: SpaceId;
};
