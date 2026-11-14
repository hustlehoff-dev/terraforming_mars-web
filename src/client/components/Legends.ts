import {BoardName} from '@/common/boards/BoardName';
import {SpaceName} from '@/common/boards/SpaceName';
import {SpaceId} from '@/common/Types';

// The classic legends use SVG coordinates. The 3D view anchors each name to its hex instead.
const sectorNames: Partial<Record<BoardName, Partial<Record<SpaceId, string>>>> = {
  [BoardName.THARSIS]: {
    '09': 'Tharsis Tholus',
    '14': 'Ascraeus Mons',
    '21': 'Pavonis Mons',
    '29': 'Arsia Mons',
    [SpaceName.NOCTIS_CITY]: 'Noctis City',
  },
  [BoardName.HELLAS]: {
    [SpaceName.HELLAS_OCEAN_TILE]: 'South Pole',
  },
  [BoardName.ELYSIUM]: {
    '08': 'Hecates Tholus',
    '14': 'Elysium Mons',
    '20': 'Olympus Mons',
    '37': 'Arsia Mons',
  },
  [BoardName.ARABIA_TERRA]: {
    '20': 'Tikhonarov',
    '55': 'Ladon',
    '58': 'Flaugergues',
    '63': 'Charybdis',
  },
  [BoardName.AMAZONIS]: {
    '09': 'Albor Tholus',
    '35': 'Anseris Mons',
    '43': 'Pindus Mons',
    '49': 'Ulysses Tholus',
  },
  [BoardName.VASTITAS_BOREALIS]: {
    '07': 'Elysium Mons',
    '12': 'Alba Fossae',
    '21': 'Ceranius Fossae',
    '22': 'Alba Mons',
  },
  [BoardName.VASTITAS_BOREALIS_NOVA]: {
    '05': 'Hecates Tholus',
    '13': 'Elysium Mons',
    '21': 'Alba Mons',
    '28': 'Viking 2',
    '46': 'Uranius Tholus',
    '59': 'Viking 1',
  },
  [BoardName.TERRA_CIMMERIA]: {
    '05': 'Albor Tholus',
    '21': 'Tyrrhenus Mons',
    '27': 'Apollinaris Mons',
    '38': 'Hadriacus Mons',
  },
  [BoardName.TERRA_CIMMERIA_NOVA]: {
    '05': 'Albor Tholus',
    '16': 'MSL Curiosity',
    '21': 'Tyrrhenus Mons',
    '27': 'Apollinaris Mons',
    '38': 'Hadriacus Mons',
  },
  [BoardName.AMAZONIS_PLANITIA]: {
    '33': 'Hecates Tholus',
    '70': 'Olympus Mons',
    '72': 'Ascraeus Mons',
    '80': 'Pavonis Mons',
    '87': 'Arsia Mons',
  },
};

export function sectorName(board: BoardName, id: SpaceId): string | undefined {
  return sectorNames[board]?.[id];
}

export type Key = {
  position: [number, number],
  text: [string, string],
  line?: {from: [number, number], to: [number, number]},
  secondRowX?: number,
};

export const LEGENDS = {
  [BoardName.THARSIS]: [],
  [BoardName.HELLAS]: [],
  [BoardName.ELYSIUM]: [],
  [BoardName.ARABIA_TERRA]: [],
  [BoardName.UTOPIA_PLANITIA]: [],
  [BoardName.VASTITAS_BOREALIS_NOVA]: [],
  [BoardName.VASTITAS_BOREALIS]: [],
  [BoardName.AMAZONIS]: [],
  [BoardName.TERRA_CIMMERIA]: [],
  [BoardName.TERRA_CIMMERIA_NOVA]: [
    {text: ['Albor', 'Tholus'], position: [282, 83], line: {from: [28, 18], to: [42, 27]}},
    {text: ['MSL', 'Curiosity'], position: [120, 185], line: {from: [30, 0], to: [148, 10]}, secondRowX: -15},
    {text: ['Tyrrhenus', 'Mons'], position: [85, 225], line: {from: [40, 5], to: [65, 10]}},
    {text: ['Apollinaris', 'Mons'], position: [500, 205], line: {from: [-3, 6], to: [-50, 28]}},
    {text: ['Hadriacus', 'Mons'], position: [90, 365], line: {from: [48, -7], to: [63, -18]}},
  ],
  [BoardName.HOLLANDIA]: [],
  [BoardName.AMAZONIS_PLANITIA]: [],
} satisfies Record<BoardName, Array<Key>>;
