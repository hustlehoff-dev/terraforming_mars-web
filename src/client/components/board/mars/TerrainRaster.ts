import {BoardCell, SPACE_HEIGHT, SPACE_WIDTH} from '../BoardGeometry';
import type {Dome} from './TerrainState';

export type TerrainRasterJob = {
  revision: number;
  rect: {x: number, y: number};
  width: number;
  height: number;
  density: number;
  oceans: Array<BoardCell>;
  greenery: Array<BoardCell>;
  domes: Array<Dome>;
  shadow: {x: number, y: number};
  oceanKey: string;
  greeneryKey: string;
  cityKey: string;
};

export type TerrainRasterResult = {revision: number, pixels: Uint8Array};
type Context = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function hexPath(ctx: Context, cell: BoardCell) {
  const w = SPACE_WIDTH / 2 + 10;
  const h = SPACE_HEIGHT / 2 + 10;
  ctx.moveTo(cell.x, cell.y - h);
  ctx.lineTo(cell.x + w, cell.y - h / 2);
  ctx.lineTo(cell.x + w, cell.y + h / 2);
  ctx.lineTo(cell.x, cell.y + h);
  ctx.lineTo(cell.x - w, cell.y + h / 2);
  ctx.lineTo(cell.x - w, cell.y - h / 2);
  ctx.closePath();
}

/** Canvas masks shared by the worker and the compatibility fallback. Geometry stays unchanged. */
export class TerrainRaster {
  private readonly pixels: Uint8Array;
  private readonly contexts: Array<Context | undefined> = [];
  private oceanKey?: string;
  private greeneryKey?: string;
  private cityKey?: string;

  constructor(private readonly config: TerrainRasterJob) {
    this.pixels = new Uint8Array(config.width * config.height * 4);
  }

  private context(index: number): Context {
    let ctx = this.contexts[index];
    if (!ctx) {
      const canvas = typeof document === 'undefined' ? new OffscreenCanvas(this.config.width, this.config.height) : document.createElement('canvas');
      canvas.width = this.config.width;
      canvas.height = this.config.height;
      ctx = canvas.getContext('2d', {willReadFrequently: true}) as Context | null ?? undefined;
      if (!ctx) throw new Error('Terrain canvas unavailable');
      this.contexts[index] = ctx;
    }
    const {width, height, density, rect} = this.config;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    ctx.setTransform(density, 0, 0, density, -rect.x * density, -rect.y * density);
    ctx.fillStyle = '#fff';
    return ctx;
  }

  private write(channel: number, context: Context): void {
    const pixels = context.getImageData(0, 0, this.config.width, this.config.height).data;
    for (let i = 0; i < this.pixels.length; i += 4) this.pixels[i + channel] = pixels[i];
  }

  public draw(job: TerrainRasterJob): Uint8Array {
    if (this.oceanKey !== job.oceanKey) {
      const ctx = this.context(0);
      ctx.filter = `blur(${9 * job.density}px)`;
      ctx.beginPath();
      for (const cell of job.oceans) hexPath(ctx, cell);
      ctx.fill();
      this.write(0, ctx);
      this.oceanKey = job.oceanKey;
    }
    if (this.greeneryKey !== job.greeneryKey) {
      const ctx = this.context(1);
      ctx.filter = `blur(${8 * job.density}px)`;
      ctx.beginPath();
      for (const cell of job.greenery) hexPath(ctx, cell);
      ctx.fill();
      this.write(1, ctx);
      this.greeneryKey = job.greeneryKey;
    }
    if (this.cityKey !== job.cityKey) {
      const ground = this.context(2);
      ground.filter = `blur(${6 * job.density}px)`;
      ground.beginPath();
      for (const dome of job.domes) {
        const radius = dome.radius * (dome.main ? 2.1 : 1.6);
        ground.moveTo(dome.x + radius, dome.y);
        ground.arc(dome.x, dome.y, radius, 0, Math.PI * 2);
      }
      ground.fill();
      this.write(2, ground);

      const shade = this.context(3);
      shade.filter = `blur(${1.6 * job.density}px)`;
      shade.globalAlpha = 0.85;
      shade.beginPath();
      const angle = Math.atan2(job.shadow.y, job.shadow.x);
      const shadowLength = Math.hypot(job.shadow.x, job.shadow.y);
      for (const dome of job.domes) {
        const height = dome.radius * 0.9;
        const x = dome.x + job.shadow.x * height * 0.5;
        const y = dome.y + job.shadow.y * height * 0.5;
        const radiusX = dome.radius * 1.02 + shadowLength * height * 0.5;
        shade.moveTo(x + radiusX * Math.cos(angle), y + radiusX * Math.sin(angle));
        shade.ellipse(x, y, radiusX, dome.radius * 0.98, angle, 0, Math.PI * 2);
      }
      shade.fill();
      shade.globalAlpha = 0.5;
      shade.beginPath();
      for (const dome of job.domes) {
        shade.moveTo(dome.x + dome.radius * 1.15, dome.y);
        shade.arc(dome.x, dome.y, dome.radius * 1.15, 0, Math.PI * 2);
      }
      shade.fill();
      this.write(3, shade);
      this.cityKey = job.cityKey;
    }
    // Keep the cached channels in this thread; transfer an independent result without copying on the UI thread.
    return this.pixels.slice();
  }
}
