import {CardName} from '../cards/CardName';
import {Color} from '../Color';

export type PlayedCardLogModel = {
  key: string;
  card: CardName;
  player: Color;
};
