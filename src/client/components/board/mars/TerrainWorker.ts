import {TerrainRaster, TerrainRasterJob, TerrainRasterResult} from './TerrainRaster';

const worker = globalThis as unknown as {
  onmessage: (event: MessageEvent<TerrainRasterJob>) => void;
  postMessage: (result: TerrainRasterResult, transfer: Array<Transferable>) => void;
};
let raster: TerrainRaster | undefined;
worker.onmessage = ({data}) => {
  raster ??= new TerrainRaster(data);
  const pixels = raster.draw(data);
  worker.postMessage({revision: data.revision, pixels}, [pixels.buffer as ArrayBuffer]);
};
