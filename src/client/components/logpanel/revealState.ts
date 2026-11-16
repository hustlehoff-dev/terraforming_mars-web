import {ref} from 'vue';

/**
 * True while the window with cards just drawn or revealed ("You drew 2 cards") is open.
 * A decision that comes with it (e.g. Mars University: discard a card to draw one) waits until
 * that window is closed, so the two never show on top of each other.
 */
export const revealOpen = ref(false);
