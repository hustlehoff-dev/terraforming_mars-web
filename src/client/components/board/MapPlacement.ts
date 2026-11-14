import {InjectionKey, Ref, ShallowRef} from 'vue';
import {PlayerInputModel, SelectSpaceModel} from '@/common/models/PlayerInputModel';

export const mapPlacementKey: InjectionKey<{
  input: Readonly<Ref<SelectSpaceModel | undefined>>;
  register?: (input: SelectSpaceModel) => () => void;
  cancel?: ShallowRef<(() => void) | undefined>;
  requestCancel?: ShallowRef<(() => void) | undefined>;
}> = Symbol('mapPlacement');

export function isGreeneryChoice(input: PlayerInputModel | undefined): boolean {
  if (input?.type !== 'space') {
    return false;
  }
  const title = typeof input.title === 'string' ? input.title : input.title.message;
  return title === 'Convert ${0} plants into greenery' || title === 'Select space for greenery tile';
}
