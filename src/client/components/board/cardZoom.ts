import {computed, shallowRef} from 'vue';
import {CardModel} from '@/common/models/CardModel';

/** The card shown up close in the middle of the screen (MissionCardZoom), if any. */
const currentZoom = shallowRef<{card: CardModel; choicePreview: boolean} | undefined>(undefined);
export const zoomedCard = computed(() => currentZoom.value?.card);
export const cardChoicePreview = computed(() => currentZoom.value?.choicePreview === true);

/** Shows a card large in the middle of the screen, e.g. after a click on a card somebody played. */
export function zoomCard(card: CardModel, choicePreview = false): void {
  currentZoom.value = {card, choicePreview};
}

export function closeCardZoom(): void {
  currentZoom.value = undefined;
}
