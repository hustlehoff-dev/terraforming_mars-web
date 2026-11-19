import {ObjectDirective} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {zoomCard} from './cardZoom';

const HOLD_MS = 450;
const MOVE_LIMIT = 10;
const choices = new WeakMap<HTMLElement, {card: CardModel; listeners: AbortController}>();

export const cardLongPress: ObjectDirective<HTMLElement, CardModel> = {
  mounted(element, {value}) {
    const listeners = new AbortController();
    const state = {card: value, listeners};
    choices.set(element, state);
    const {signal} = listeners;
    let press: {touch: Touch; startedAt: number} | undefined;

    element.addEventListener('touchstart', (event) => {
      press = undefined;
      if (event.touches.length !== 1 || !window.matchMedia?.('(max-width: 760px)').matches ||
        !element.closest('.setup-page, .draft-pick, .draft-pick--locked, .buy-cards')) {
        return;
      }
      press = {touch: event.touches[0], startedAt: performance.now()};
    }, {signal, passive: true});

    element.addEventListener('touchmove', (event) => {
      if (!press) {
        return;
      }
      const touch = event.touches[0];
      if (event.touches.length !== 1 || Math.hypot(touch.clientX - press.touch.clientX, touch.clientY - press.touch.clientY) > MOVE_LIMIT) {
        press = undefined;
      }
    }, {signal, passive: true});

    element.addEventListener('touchcancel', () => {
      press = undefined;
    }, {signal});
    element.addEventListener('contextmenu', (event) => {
      if (press) {
        event.preventDefault();
      }
    }, {signal});

    element.addEventListener('touchend', (event) => {
      const held = press;
      const touch = event.changedTouches[0];
      press = undefined;
      if (!held || touch?.identifier !== held.touch.identifier || performance.now() - held.startedAt < HOLD_MS ||
        Math.hypot(touch.clientX - held.touch.clientX, touch.clientY - held.touch.clientY) > MOVE_LIMIT || !event.cancelable) {
        return;
      }

      // Cancel the synthesized click before it can activate the choice label.
      event.preventDefault();
      zoomCard({...state.card, isDisabled: false}, true);
    }, {signal, passive: false});
  },
  updated(element, {value}) {
    const state = choices.get(element);
    if (state) {
      state.card = value;
    }
  },
  unmounted(element) {
    choices.get(element)?.listeners.abort();
    choices.delete(element);
  },
};
