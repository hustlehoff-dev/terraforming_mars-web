import {DataTexture, LinearFilter, NearestFilter, RGBAFormat, UnsignedByteType} from 'three';
import {BoardCell, BoardGeometry} from '@/client/components/board/BoardGeometry';
import {SpaceModel} from '@/common/models/SpaceModel';
import {SpaceType} from '@/common/boards/SpaceType';
import {CITY_TILES, GREENERY_TILES, OCEAN_TILES} from '@/common/TileType';
import {SpaceId} from '@/common/Types';
import {TerrainRaster, TerrainRasterJob, TerrainRasterResult} from './TerrainRaster';

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
  private readonly texelWidth: number;
  private readonly texelHeight: number;
  private terrainKey?: string;
  private cityKey?: string;
  private worker?: Worker;
  private pending?: TerrainRasterJob;
  private latest?: TerrainRasterJob;
  private busy = false;
  private revision = 0;
  private disposed = false;
  private fallback?: TerrainRaster;
  private fallbackTimer?: number;

  constructor(private readonly geometry: BoardGeometry, private readonly onChange: () => void = () => {}) {
    const {minX, minY, maxX, maxY} = geometry.bounds;
    this.rect = {x: minX - MARGIN, y: minY - MARGIN, width: maxX - minX + MARGIN * 2, height: maxY - minY + MARGIN * 2};
    this.texelWidth = Math.ceil(this.rect.width * DENSITY);
    this.texelHeight = Math.ceil(this.rect.height * DENSITY);
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
    this.startWorker();
  }

  private startWorker(): void {
    if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return;
    try {
      this.worker = new Worker(new URL('./TerrainWorker.ts', import.meta.url));
      this.worker.onmessage = (event: MessageEvent<TerrainRasterResult>) => this.finish(event.data);
      this.worker.onerror = () => this.useFallback();
    } catch {
      this.useFallback();
    }
  }

  private useFallback(): void {
    this.worker?.terminate();
    this.worker = undefined;
    this.busy = false;
    this.pending = this.latest;
    this.dispatch();
  }

  /** At most one raster in progress and one latest state waiting; intermediate moves are coalesced. */
  private dispatch(): void {
    if (this.disposed || this.busy || !this.pending) return;
    const job = this.pending;
    this.pending = undefined;
    this.busy = true;
    if (this.worker) {
      try {
        this.worker.postMessage(job);
      } catch {
        this.useFallback();
      }
    } else {
      this.fallbackTimer = window.setTimeout(() => {
        if (this.disposed) return;
        this.fallback ??= new TerrainRaster(job);
        this.finish({revision: job.revision, pixels: this.fallback.draw(job)});
      }, 0);
    }
  }

  private finish(result: TerrainRasterResult): void {
    if (this.disposed) return;
    this.busy = false;
    if (result.revision === this.revision) {
      this.terrain.image.data = result.pixels;
      this.terrain.needsUpdate = true;
      this.onChange();
    }
    this.dispatch();
  }

  public update(spaces: ReadonlyArray<SpaceModel>, shadow: {x: number, y: number}) {
    const cells = spaces.flatMap((space) => {
      const cell = this.geometry.byId.get(space.id);
      return cell === undefined || space.spaceType === SpaceType.COLONY ? [] : [{space, cell}];
    });
    const oceans = cells.filter(({space}) => space.tileType !== undefined && OCEAN_TILES.has(space.tileType)).map(({cell}) => cell);
    const greenery = cells.filter(({space}) => space.tileType !== undefined && GREENERY_TILES.has(space.tileType)).map(({cell}) => cell);
    const cities = cells.filter(({space}) => space.tileType !== undefined && CITY_TILES.has(space.tileType)).map(({cell}) => cell);
    const cityKey = cities.map(({id}) => id).join(',');
    const oceanKey = oceans.map(({id}) => id).join(',');
    const greeneryKey = greenery.map(({id}) => id).join(',');
    const terrainKey = [oceanKey, greeneryKey, cityKey].join('|');
    if (this.terrainKey === terrainKey) return false;
    if (this.cityKey !== cityKey) this.domes = cities.flatMap(domesFor);
    this.latest = {
      revision: ++this.revision, rect: this.rect, width: this.texelWidth, height: this.texelHeight,
      density: DENSITY, oceans, greenery, domes: this.domes, shadow, cityKey, oceanKey, greeneryKey,
    };
    this.pending = this.latest;
    this.terrainKey = terrainKey;
    this.cityKey = cityKey;
    this.dispatch();
    return true;
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
    this.disposed = true;
    this.worker?.terminate();
    window.clearTimeout(this.fallbackTimer);
    this.terrain.dispose();
    this.cells.dispose();
    this.owners.dispose();
  }
}
