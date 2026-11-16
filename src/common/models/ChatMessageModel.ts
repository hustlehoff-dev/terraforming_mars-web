import {Color} from '../Color';

/** A message of the game chat, shown in the activity feed. */
export type ChatMessageModel = {
  /** 1, 2, 3... in the order sent. */
  id: number;
  player: Color;
  text: string;
  /** When it was sent (ms since epoch). */
  at: number;
  /** The latest activity feed entry the sender saw: the message is shown right after it. */
  after?: string;
};

/** Longest chat message, in characters. */
export const CHAT_MESSAGE_MAX_LENGTH = 300;
