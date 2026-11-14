import {SpaceId} from '@/common/Types';

/**
 * One geometry for the Mars board.
 *
 * Board coordinates are the pixel coordinates the classic board uses in board_items_positions.less:
 * each row is 41px below the last, each space 49px right of the last, and each row is indented half
 * a space for every row it is away from the middle row. A space is a 46 × 51 box whose top-left
 * corner is at `left, top`.
 *
 * The 3D scene wraps this plane onto the Mars sphere with a gnomonic projection around the board
 * centre, so surface shading, the hex grid, buildings and the projected DOM hit areas all derive
 * their positions from the same numbers.
 */
export const SPACE_WIDTH = 46;
export const SPACE_HEIGHT = 51;
export const COLUMN_STEP = 49;
export const ROW_STEP = 41;
const FIRST_TOP = 34;
const STANDARD_ROWS = [5, 6, 7, 8, 9, 8, 7, 6, 5];
const LARGE_ROWS = [6, 7, 8, 9, 10, 11, 10, 9, 8, 7, 6];
const STANDARD_LEFT = 6;
const LARGE_LEFT = 6.5;

export type BoardCell = {
  id: SpaceId;
  row: number;
  /** Position within the row, from 0. */
  index: number;
  /** Lattice column in doubled coordinates: neighbours in a row differ by 2. */
  column: number;
  left: number;
  top: number;
  /** Centre of the space in board coordinates. */
  x: number;
  y: number;
};

export type BoardGeometry = {
  large: boolean;
  rows: ReadonlyArray<number>;
  cells: ReadonlyArray<BoardCell>;
  byId: ReadonlyMap<SpaceId, BoardCell>;
  /** Centre of the board's bounding box. */
  centerX: number;
  centerY: number;
  /** Bounding box of all space centres, padded by one space. */
  bounds: {minX: number, maxX: number, minY: number, maxY: number};
  /** Lattice origin: the centre of column 0 in the middle row. */
  latticeX: number;
  latticeY: number;
  middleRow: number;
  maxColumn: number;
};

const cache = new Map<boolean, BoardGeometry>();

export function boardGeometry(large: boolean): BoardGeometry {
  const cached = cache.get(large);
  if (cached !== undefined) {
    return cached;
  }
  const rows = large ? LARGE_ROWS : STANDARD_ROWS;
  const baseLeft = large ? LARGE_LEFT : STANDARD_LEFT;
  const middleRow = (rows.length - 1) / 2;
  const cells: Array<BoardCell> = [];
  let id = 3;
  rows.forEach((count, row) => {
    const indent = Math.abs(row - middleRow);
    for (let index = 0; index < count; index++) {
      const left = baseLeft + indent * COLUMN_STEP / 2 + index * COLUMN_STEP;
      const top = FIRST_TOP + row * ROW_STEP;
      cells.push({
        id: String(id).padStart(2, '0') as SpaceId,
        row,
        index,
        column: indent + index * 2,
        left,
        top,
        x: left + SPACE_WIDTH / 2,
        y: top + SPACE_HEIGHT / 2,
      });
      id++;
    }
  });
  const xs = cells.map((cell) => cell.x);
  const ys = cells.map((cell) => cell.y);
  const bounds = {
    minX: Math.min(...xs) - COLUMN_STEP,
    maxX: Math.max(...xs) + COLUMN_STEP,
    minY: Math.min(...ys) - ROW_STEP,
    maxY: Math.max(...ys) + ROW_STEP,
  };
  const geometry: BoardGeometry = {
    large,
    rows,
    cells,
    byId: new Map(cells.map((cell) => [cell.id, cell])),
    centerX: (bounds.minX + bounds.maxX) / 2,
    centerY: (bounds.minY + bounds.maxY) / 2,
    bounds,
    latticeX: baseLeft + SPACE_WIDTH / 2,
    latticeY: FIRST_TOP + middleRow * ROW_STEP + SPACE_HEIGHT / 2,
    middleRow,
    maxColumn: Math.max(...cells.map((cell) => cell.column)),
  };
  cache.set(large, geometry);
  return geometry;
}

/** Spaces that share an edge with `cell`. */
export function neighbours(geometry: BoardGeometry, cell: BoardCell): Array<BoardCell> {
  return geometry.cells.filter((other) => other !== cell &&
    Math.abs(other.row - cell.row) <= 1 &&
    Math.abs(other.column - cell.column) === (other.row === cell.row ? 2 : 1));
}
