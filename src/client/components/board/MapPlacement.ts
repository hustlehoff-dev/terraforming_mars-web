import {InjectionKey, ShallowRef} from 'vue';
import {SelectSpaceModel} from '@/common/models/PlayerInputModel';

export const mapPlacementKey: InjectionKey<{input: ShallowRef<SelectSpaceModel | undefined>}> = Symbol('mapPlacement');
