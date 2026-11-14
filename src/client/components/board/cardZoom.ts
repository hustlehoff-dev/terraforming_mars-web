import {shallowRef} from 'vue';
import {CardModel} from '@/common/models/CardModel';

/** The card shown up close in the middle of the screen (MissionCardZoom), if any. */
export const zoomedCard = shallowRef<CardModel | undefined>(undefined);

/** Shows a card large in the middle of the screen, e.g. after a click on a card somebody played. */
export function zoomCard(card: CardModel): void {
  zoomedCard.value = card;
}

export function closeCardZoom(): void {
  zoomedCard.value = undefined;
}
