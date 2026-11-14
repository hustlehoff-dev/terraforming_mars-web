import {DataTexture, LinearFilter, NearestFilter, RGBAFormat, UnsignedByteType} from 'three';
import {BoardCell, BoardGeometry, SPACE_HEIGHT, SPACE_WIDTH} from '@/client/components/board/BoardGeometry';
import {SpaceModel} from '@/common/models/SpaceModel';
import {SpaceType} from '@/common/boards/SpaceType';
import {CITY_TILES, GREENERY_TILES, OCEAN_TILES} from '@/common/TileType';
import {SpaceId} from '@/common/Types';

/** Texels per board pixel in the terrain texture. */
const DENSITY = 2;
const MARGIN = 80;

/** Player colours for the owner border on the planet (neutral and bronze markers get none). */
const OWNER_RGB: Partial<Record<string, [number, number, number]>> = {
  red: [235, 56, 48],
  green: [64, 200, 72],
  blue: [70, 140, 255],
  yellow: [250, 212, 40],
  black: [150, 150, 160],
  purple: [170, 90, 230],
  orange: [255, 140, 30],
  pink: [255, 110, 190],
};

export type Dome = {id: SpaceId, x: number, y: number, radius: number, main: boolean};

function hash(text: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/** Domes of one city, in board pixels. Deterministic per space so they never jump between renders. */
export function domesFor(cell: BoardCell): Array<Dome> {
  const turn = hash(cell.id, 1) * Math.PI * 2;
  const domes: Array<Dome> = [{id: cell.id, x: cell.x + (hash(cell.id, 2) - 0.5) * 4, y: cell.y + (hash(cell.id, 3) - 0.5) * 4, radius: 11, main: true}];
  const count = 2 + Math.floor(hash(cell.id, 4) * 2);
  for (let i = 0; i < count; i++) {
    const angle = turn + i * (Math.PI * 2 / count) + hash(cell.id, 10 + i) * 0.6;
    const distance = 14 + hash(cell.id, 20 + i) * 4;
    domes.push({id: cell.id, x: domes[0].x + Math.cos(angle) * distance, y: domes[0].y + Math.sin(angle) * distance * 0.9, radius: 4.5 + hash(cell.id, 30 + i) * 2.5, main: false});
  }
  return domes;
}

function hexPath(ctx: CanvasRenderingContext2D, cell: BoardCell, grow: number) {
  const w = SPACE_WIDTH / 2 + grow;
  const h = SPACE_HEIGHT / 2 + grow;
  ctx.beginPath();
  ctx.moveTo(cell.x, cell.y - h);
  ctx.lineTo(cell.x + w, cell.y - h / 2);
  ctx.lineTo(cell.x + w, cell.y + h / 2);
  ctx.lineTo(cell.x, cell.y + h);
  ctx.lineTo(cell.x - w, cell.y + h / 2);
  ctx.lineTo(cell.x - w, cell.y - h / 2);
  ctx.closePath();
}

/**
 * Turns the real game state into textures the planet shader reads in board space:
 * soft fields for oceans, greenery, settled ground and building shadows, plus one texel per space
 * with the grid state (exists, legal, inspected, ocean reserve).
 */
export class TerrainState {
  public readonly rect: {x: number, y: number, width: number, height: number};
  public readonly terrain: DataTexture;
  public readonly cells: DataTexture;
  /** Owner colour of each space (rgb) and whether it is owned (a). */
  public readonly owners: DataTexture;
  public readonly cellsSize: {width: number, height: number};
  public domes: Array<Dome> = [];
  private readonly canvases: Array<HTMLCanvasElement>;
  private readonly texelWidth: number;
  private readonly texelHeight: number;

  constructor(private readonly geometry: BoardGeometry) {
    const {minX, minY, maxX, maxY} = geometry.bounds;
    this.rect = {x: minX - MARGIN, y: minY - MARGIN, width: maxX - minX + MARGIN * 2, height: maxY - minY + MARGIN * 2};
    this.texelWidth = Math.ceil(this.rect.width * DENSITY);
    this.texelHeight = Math.ceil(this.rect.height * DENSITY);
    this.canvases = [0, 1, 2, 3].map(() => {
      const canvas = document.createElement('canvas');
      canvas.width = this.texelWidth;
      canvas.height = this.texelHeight;
      return canvas;
    });
    this.terrain = new DataTexture(new Uint8Array(this.texelWidth * this.texelHeight * 4), this.texelWidth, this.texelHeight, RGBAFormat, UnsignedByteType);
    this.terrain.magFilter = LinearFilter;
    this.terrain.minFilter = LinearFilter;
    this.terrain.flipY = false;
    this.cellsSize = {width: geometry.maxColumn + 1, height: geometry.rows.length};
    this.cells = new DataTexture(new Uint8Array(this.cellsSize.width * this.cellsSize.height * 4), this.cellsSize.width, this.cellsSize.height, RGBAFormat, UnsignedByteType);
    this.cells.magFilter = NearestFilter;
    this.cells.minFilter = NearestFilter;
    this.owners = new DataTexture(new Uint8Array(this.cellsSize.width * this.cellsSize.height * 4), this.cellsSize.width, this.cellsSize.height, RGBAFormat, UnsignedByteType);
    this.owners.magFilter = NearestFilter;
    this.owners.minFilter = NearestFilter;
  }

  private context(index: number): CanvasRenderingContext2D | null {
    const ctx = this.canvases[index].getContext('2d', {willReadFrequently: true});
    if (ctx === null) {
      return null;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.texelWidth, this.texelHeight);
    ctx.setTransform(DENSITY, 0, 0, DENSITY, -this.rect.x * DENSITY, -this.rect.y * DENSITY);
    ctx.fillStyle = '#fff';
    return ctx;
  }

  /**
   * @param shadow board-pixel offset of a shadow per unit of building height (direction away from the sun)
   */
  public update(spaces: ReadonlyArray<SpaceModel>, shadow: {x: number, y: number}) {
    const cells = spaces.flatMap((space) => {
      const cell = this.geometry.byId.get(space.id);
      return cell === undefined || space.spaceType === SpaceType.COLONY ? [] : [{space, cell}];
    });
    const oceans = cells.filter(({space}) => space.tileType !== undefined && OCEAN_TILES.has(space.tileType));
    const greenery = cells.filter(({space}) => space.tileType !== undefined && GREENERY_TILES.has(space.tileType));
    const cities = cells.filter(({space}) => space.tileType !== undefined && CITY_TILES.has(space.tileType));
    this.domes = cities.flatMap(({cell}) => domesFor(cell));

    const ocean = this.context(0);
    const green = this.context(1);
    const ground = this.context(2);
    const shade = this.context(3);
    if (ocean === null || green === null || ground === null || shade === null) {
      return;
    }

    // Oceans: grown hexes blurred together, so neighbouring oceans form one sea with a soft shore.
    ocean.filter = `blur(${9 * DENSITY}px)`;
    for (const {cell} of oceans) {
      hexPath(ocean, cell, 10);
      ocean.fill();
    }
    green.filter = `blur(${8 * DENSITY}px)`;
    for (const {cell} of greenery) {
      hexPath(green, cell, 10);
      green.fill();
    }
    ground.filter = `blur(${6 * DENSITY}px)`;
    for (const dome of this.domes) {
      ground.beginPath();
      ground.arc(dome.x, dome.y, dome.radius * (dome.main ? 2.1 : 1.6), 0, Math.PI * 2);
      ground.fill();
    }
    // Shadows: contact darkening and a cast shadow stretched away from the sun.
    shade.filter = `blur(${1.6 * DENSITY}px)`;
    for (const dome of this.domes) {
      const height = dome.radius * 0.9;
      shade.globalAlpha = 0.85;
      shade.beginPath();
      shade.ellipse(dome.x + shadow.x * height * 0.5, dome.y + shadow.y * height * 0.5,
        dome.radius * 1.02 + Math.hypot(shadow.x, shadow.y) * height * 0.5, dome.radius * 0.98,
        Math.atan2(shadow.y, shadow.x), 0, Math.PI * 2);
      shade.fill();
      shade.globalAlpha = 0.5;
      shade.beginPath();
      shade.arc(dome.x, dome.y, dome.radius * 1.15, 0, Math.PI * 2);
      shade.fill();
    }
    shade.globalAlpha = 1;

    const data = this.terrain.image.data as Uint8Array;
    const channels = [ocean, green, ground, shade].map((ctx) => ctx.getImageData(0, 0, this.texelWidth, this.texelHeight).data);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = channels[0][i];
      data[i + 1] = channels[1][i];
      data[i + 2] = channels[2][i];
      data[i + 3] = channels[3][i];
    }
    this.terrain.needsUpdate = true;
  }

  public updateCells(spaces: ReadonlyArray<SpaceModel>, legal: ReadonlySet<SpaceId>, inspected: SpaceId | undefined) {
    const data = this.cells.image.data as Uint8Array;
    data.fill(0);
    const owners = this.owners.image.data as Uint8Array;
    owners.fill(0);
    for (const space of spaces) {
      const cell = this.geometry.byId.get(space.id);
      if (cell === undefined || space.spaceType === SpaceType.COLONY) {
        continue;
      }
      const offset = (cell.row * this.cellsSize.width + cell.column) * 4;
      data[offset] = 255;
      data[offset + 1] = legal.has(space.id) ? 255 : 0;
      data[offset + 2] = inspected === space.id ? 255 : 0;
      data[offset + 3] = space.spaceType === SpaceType.OCEAN && space.tileType === undefined ? 255 : 0;
      const rgb = space.color === undefined ? undefined : OWNER_RGB[space.color];
      if (rgb !== undefined) {
        owners.set([...rgb, 255], offset);
      }
    }
    this.cells.needsUpdate = true;
    this.owners.needsUpdate = true;
  }

  public dispose() {
    this.terrain.dispose();
    this.cells.dispose();
    this.owners.dispose();
  }
}
