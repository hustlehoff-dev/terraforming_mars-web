import {ObjectDirective, ref, watch} from 'vue';
import {safeLocalStorage} from '@/client/utils/SafeLocalStorage';

const STORAGE_KEY = 'mobile-card-columns';
export const mobileCardColumns = ref(safeLocalStorage.getItem(STORAGE_KEY) === '1' ? 1 : 2);

export function setMobileCardColumns(columns: number): void {
  mobileCardColumns.value = columns === 1 ? 1 : 2;
  safeLocalStorage.setItem(STORAGE_KEY, String(mobileCardColumns.value));
}

const cleanup = new WeakMap<HTMLElement, () => void>();

/** Scale the existing card face to its actual grid column, including its protruding cost and tags. */
export const mobileCardGrid: ObjectDirective<HTMLElement> = {
  mounted(element) {
    const update = () => {
      const columns = mobileCardColumns.value;
      const width = (element.clientWidth - (columns - 1) * 10) / columns;
      element.style.setProperty('--mobile-card-columns', String(columns));
      element.style.setProperty('--mobile-browser-scale', String(Math.max(0.3, Math.min(1.35, width / 270))));
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    const stop = watch(mobileCardColumns, update);
    update();
    cleanup.set(element, () => {
      observer.disconnect();
      stop();
    });
  },
  unmounted(element) {
    cleanup.get(element)?.();
    cleanup.delete(element);
  },
};
