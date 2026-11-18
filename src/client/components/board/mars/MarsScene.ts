import {
  AdditiveBlending, BackSide, BufferAttribute, BufferGeometry, Color, CylinderGeometry, DirectionalLight, FrontSide,
  Group, HemisphereLight, IcosahedronGeometry, Mesh, MeshStandardMaterial, PerspectiveCamera, Points, PointsMaterial,
  Quaternion, Scene, ShaderMaterial, SphereGeometry, SRGBColorSpace, TextureLoader, Vector3, WebGLRenderer,
} from 'three';
import {BoardGeometry, boardGeometry, SPACE_HEIGHT, SPACE_WIDTH} from '@/client/components/board/BoardGeometry';
import {ATMOSPHERE_FRAGMENT, ATMOSPHERE_VERTEX, PLANET_FRAGMENT, PLANET_VERTEX} from '@/client/components/board/mars/planetShader';
import {TerrainState} from '@/client/components/board/mars/TerrainState';
import {SpaceModel} from '@/common/models/SpaceModel';
import {SpaceId} from '@/common/Types';

export type CameraState = {x: number, y: number, d: number};
export type SafeArea = {top: number, right: number, bottom: number, left: number};
export type ScreenPoint = {x: number, y: number, visible: boolean};
/** CSS matrix(a, b, c, d, e, f) that lays a 46 × 51 space box onto the projected surface. */
export type SpaceTransform = {matrix: [number, number, number, number, number, number], visible: boolean};

const PLANET_RADIUS = 1;
const ATMOSPHERE_RADIUS = 1.022;
/** Sphere units per board pixel. */
const BOARD_SCALE = 0.0016;
const FOV = 36;
const MIN_DISTANCE = 0.03;
const MAX_DISTANCE = 4.2;
const TILT_NEAR = 66 * Math.PI / 180;
const TILT_FAR = 18 * Math.PI / 180;

// Board frame on the sphere: board centre faces +Z, board north (towards the top rows) is +Y.
const C = new Vector3(0, 0, 1);
const E = new Vector3(1, 0, 0);
const N = new Vector3(0, 1, 0);
// One sun for the whole scene: from the left, low over the board, slightly beyond the horizon.
const SUN = new Vector3().addScaledVector(E, -0.82).addScaledVector(N, 0.36).addScaledVector(C, 0.46).normalize();

/** Climate of the planet from the global parameters, each 0 (start) .. 1 (maximum). */
export type Climate = {temperature: number, oxygen: number, oceans: number};
const PULSE_MS = 1800;
const PULSE_COLOURS = {
  temperature: new Vector3(1.0, 0.55, 0.25),
  oxygen: new Vector3(0.45, 0.75, 1.0),
  oceans: new Vector3(0.3, 0.9, 1.0),
};

const scratch = new Vector3();
const scratch2 = new Vector3();

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export class MarsScene {
  public readonly geometry: BoardGeometry;
  public readonly state: TerrainState;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(FOV, 1, 0.001, 200);
  private readonly probe = new PerspectiveCamera(FOV, 1, 0.001, 200);
  private readonly planetMaterial: ShaderMaterial;
  private readonly atmosphereMaterial: ShaderMaterial;
  private readonly buildings = new Group();
  private readonly domeGroups = new Map<string, Group>();
  private readonly cityMaterials = {
    base: new MeshStandardMaterial({color: new Color(0.40, 0.37, 0.35), roughness: 0.9, metalness: 0.05}),
    glass: new MeshStandardMaterial({color: new Color(0.70, 0.84, 0.95), roughness: 0.05, metalness: 0.0, transparent: true, opacity: 0.28, depthWrite: false}),
    frame: new MeshStandardMaterial({color: new Color(0.80, 0.82, 0.84), roughness: 0.4, metalness: 0.6, wireframe: true, transparent: true, opacity: 0.35}),
    garden: new MeshStandardMaterial({color: new Color(0.16, 0.30, 0.10), roughness: 0.9, emissive: new Color(0.9, 0.62, 0.32), emissiveIntensity: 0.08}),
  };
  private readonly orbitals = new Group();
  private readonly shuttle: Mesh;
  private readonly cityLights: Array<Mesh> = [];
  private orbitalAnchors: Array<{id: SpaceId, position: Vector3, radius: number}> = [];
  private width = 1;
  private height = 1;
  private safe: SafeArea = {top: 0, right: 0, bottom: 0, left: 0};
  private current: CameraState;
  private target: CameraState;
  private home: CameraState;
  private frameHandle = 0;
  private lastFrame = 0;
  private lastRender = 0;
  private dirty = true;
  private projectionDirty = true;
  private readonly compactDisplay = window.matchMedia?.('(max-width: 760px) and (pointer: coarse)').matches === true;
  /** Fraction of the device pixel ratio the scene renders at; lowered while frames are slow. */
  private renderScale = 1;
  private slowFrames = 0;
  private fastFrames = 0;
  private lastScaleChange = 0;
  private disposed = false;
  private readonly start = performance.now();

  constructor(
    canvas: HTMLCanvasElement,
    large: boolean,
    private reducedMotion: boolean,
    private readonly onFrame: () => void,
  ) {
    this.geometry = boardGeometry(large);
    this.state = new TerrainState(this.geometry);
    this.renderer = new WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'});
    this.renderer.setPixelRatio(this.pixelRatio());
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.setClearColor(0x020309);

    this.home = {x: this.geometry.centerX, y: this.geometry.centerY, d: 0.8};
    this.current = {...this.home};
    this.target = {...this.home};

    this.planetMaterial = new ShaderMaterial({
      vertexShader: PLANET_VERTEX,
      fragmentShader: PLANET_FRAGMENT,
      uniforms: {
        sunDirection: {value: SUN.clone()},
        sunColor: {value: new Vector3(1.0, 0.86, 0.68)},
        shadowColor: {value: new Vector3(0.15, 0.18, 0.28)},
        time: {value: 0},
        boardCenter: {value: C.clone()},
        boardEast: {value: E.clone()},
        boardNorth: {value: N.clone()},
        boardScale: {value: BOARD_SCALE},
        boardOrigin: {value: [this.geometry.centerX, this.geometry.centerY]},
        terrainRect: {value: [this.state.rect.x, this.state.rect.y, this.state.rect.width, this.state.rect.height]},
        terrain: {value: this.state.terrain},
        cells: {value: this.state.cells},
        owners: {value: this.state.owners},
        cellsSize: {value: [this.state.cellsSize.width, this.state.cellsSize.height]},
        lattice: {value: [this.geometry.latticeX, this.geometry.latticeY, this.geometry.middleRow, this.geometry.rows.length]},
        gridStrength: {value: 1},
        showBoard: {value: 1},
        placing: {value: 0},
        warmth: {value: 0},
        air: {value: 0},
        seas: {value: 0},
        pulse: {value: 0},
        pulseColor: {value: new Vector3(1, 0.6, 0.3)},
      },
    });
    const planet = new Mesh(new SphereGeometry(PLANET_RADIUS, 512, 256), this.planetMaterial);
    this.scene.add(planet);

    this.atmosphereMaterial = new ShaderMaterial({
      vertexShader: ATMOSPHERE_VERTEX,
      fragmentShader: ATMOSPHERE_FRAGMENT,
      uniforms: {
        sunDirection: {value: SUN.clone()},
        planetRadius: {value: PLANET_RADIUS},
        atmosphereRadius: {value: ATMOSPHERE_RADIUS},
        air: {value: 0},
        pulse: {value: 0},
        pulseColor: {value: new Vector3(1, 0.6, 0.3)},
      },
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
      side: FrontSide,
    });
    this.scene.add(new Mesh(new SphereGeometry(ATMOSPHERE_RADIUS, 256, 128), this.atmosphereMaterial));

    const sun = new DirectionalLight(new Color(1.0, 0.86, 0.68), 3.8);
    sun.position.copy(SUN).multiplyScalar(10);
    this.scene.add(sun);
    this.scene.add(new HemisphereLight(0x8fa3d0, 0x5a3422, 0.9));

    this.scene.add(this.stars());
    this.scene.add(this.buildings);
    this.scene.add(this.orbitals);

    this.shuttle = new Mesh(new SphereGeometry(0.0016, 8, 6), new MeshStandardMaterial({color: 0xffffff, emissive: new Color(1.0, 0.92, 0.8), emissiveIntensity: 3}));
    this.shuttle.visible = false;
    this.scene.add(this.shuttle);

    this.loop = this.loop.bind(this);
    this.frameHandle = requestAnimationFrame(this.loop);
  }

  /* ---------- Board frame ---------- */

  public surface(x: number, y: number, out = new Vector3()): Vector3 {
    return out.copy(C)
      .addScaledVector(E, (x - this.geometry.centerX) * BOARD_SCALE)
      .addScaledVector(N, -(y - this.geometry.centerY) * BOARD_SCALE)
      .normalize()
      .multiplyScalar(PLANET_RADIUS);
  }

  public boardOf(point: Vector3): {x: number, y: number} | undefined {
    const p = scratch.copy(point).normalize();
    const facing = p.dot(C);
    if (facing < 0.3) {
      return undefined;
    }
    p.divideScalar(facing).sub(C);
    return {x: p.dot(E) / BOARD_SCALE + this.geometry.centerX, y: -p.dot(N) / BOARD_SCALE + this.geometry.centerY};
  }

  /** Board-pixel offset of a shadow per unit of height. */
  private shadowOffset() {
    const east = SUN.dot(E);
    const north = SUN.dot(N);
    const up = SUN.dot(C);
    return {x: -east / up, y: north / up};
  }

  /* ---------- Game state ---------- */

  public setSpaces(spaces: ReadonlyArray<SpaceModel>) {
    const previousDomes = this.state.domes;
    if (this.state.update(spaces, this.shadowOffset())) {
      if (this.state.domes !== previousDomes) {
        this.rebuildBuildings();
      }
      this.dirty = true;
    }
  }

  private climate?: Climate;
  private pulseStart = 0;

  /**
   * Global parameters as the planet's climate (each 0..1): polar caps, clouds, dust storms, the
   * colour of the air. A parameter that rose sends a wave of its colour over the planet.
   */
  public setClimate(climate: Climate) {
    const previous = this.climate;
    this.climate = climate;
    for (const material of [this.planetMaterial, this.atmosphereMaterial]) {
      material.uniforms.air.value = climate.oxygen;
    }
    this.planetMaterial.uniforms.warmth.value = climate.temperature;
    this.planetMaterial.uniforms.seas.value = climate.oceans;
    if (previous !== undefined && !this.reducedMotion) {
      const rose = climate.temperature > previous.temperature ? PULSE_COLOURS.temperature :
        climate.oxygen > previous.oxygen ? PULSE_COLOURS.oxygen :
          climate.oceans > previous.oceans ? PULSE_COLOURS.oceans : undefined;
      if (rose !== undefined) {
        for (const material of [this.planetMaterial, this.atmosphereMaterial]) {
          (material.uniforms.pulseColor.value as Vector3).copy(rose);
        }
        this.pulseStart = performance.now();
      }
    }
    this.dirty = true;
  }

  public setHighlights(spaces: ReadonlyArray<SpaceModel>, legal: ReadonlySet<SpaceId>, inspected: SpaceId | undefined) {
    this.state.updateCells(spaces, legal, inspected);
    this.planetMaterial.uniforms.placing.value = legal.size > 0 ? 1 : 0;
    this.dirty = true;
  }

  private orbitalIds: ReadonlyArray<SpaceId> = [];

  public setOrbitals(ids: ReadonlyArray<SpaceId>) {
    this.orbitalIds = ids;
    this.placeOrbitals();
  }

  /**
   * Orbital spaces are fixed objects in world space. Their places are chosen from the default camera
   * (high in its sky, left and right of the board) so they are visible in the default view; after that
   * they stay put and leave the frame when the player pans or zooms in.
   */
  private placeOrbitals() {
    for (const child of [...this.orbitals.children]) {
      (child as Mesh).geometry?.dispose();
    }
    this.orbitals.clear();
    this.place(this.probe, this.home);
    const safeWidth = this.width - this.safe.left - this.safe.right;
    const safeHeight = this.height - this.safe.top - this.safe.bottom;
    // Each slot: horizontal place in the safe area, height above the horizon (fraction of the view),
    // distance as a multiple of the distance to the horizon (> 1 rises from behind the limb) and size.
    const slots = [
      {sx: 0.9, lift: 0.035, behind: 2.4, size: 0.085, kind: 'ganymede'},
      {sx: 0.1, lift: 0.06, behind: 0.8, size: 0.045, kind: 'phobos'},
      {sx: 0.5, lift: 0.05, behind: 1.1, size: 0.03, kind: 'station'},
      {sx: 0.3, lift: 0.05, behind: 1.1, size: 0.03, kind: 'station'},
      {sx: 0.7, lift: 0.05, behind: 1.1, size: 0.03, kind: 'station'},
    ];
    const o = this.probe.position;
    const horizonDistance = Math.sqrt(Math.max(0.01, o.lengthSq() - PLANET_RADIUS * PLANET_RADIUS));
    const rayAt = (x: number, y: number) => new Vector3(x / this.width * 2 - 1, -(y / this.height * 2 - 1), 0.5).unproject(this.probe).sub(o).normalize();
    const hits = (dir: Vector3) => {
      const b = o.dot(dir);
      return b < 0 && b * b - (o.lengthSq() - PLANET_RADIUS * PLANET_RADIUS) > 0;
    };
    // Screen row of the limb at a given column (0 if the limb is above the view).
    const horizonY = (x: number) => {
      if (hits(rayAt(x, 0))) {
        return 0;
      }
      let low = 0;
      let high = this.height;
      for (let i = 0; i < 18; i++) {
        const mid = (low + high) / 2;
        if (hits(rayAt(x, mid))) {
          high = mid;
        } else {
          low = mid;
        }
      }
      return high;
    };
    this.orbitalAnchors = this.orbitalIds.map((id, index) => {
      const slot = slots[index] ?? {sx: 0.2 + (index * 0.13) % 0.6, lift: 0.05, behind: 1.1, size: 0.03, kind: 'station'};
      const narrow = safeWidth < 600;
      const sx = this.safe.left + safeWidth * (narrow ? 0.5 + (slot.sx - 0.5) * 0.8 : slot.sx);
      // Never under the top HUD: if the limb is hidden there, the moon sits in front of the planet instead.
      const sy = Math.max(this.safe.top + 36, this.height * 0.05, horizonY(sx) - this.height * slot.lift);
      const dir = rayAt(sx, sy);
      const b = o.dot(dir);
      const disc = b * b - (o.lengthSq() - PLANET_RADIUS * PLANET_RADIUS);
      let distance = horizonDistance * slot.behind;
      if (disc > 0 && b < 0) {
        // The ray meets the surface: keep the object in front of it.
        distance = Math.min(distance, (-b - Math.sqrt(disc)) * 0.7);
      }
      const position = o.clone().addScaledVector(dir, distance);
      // `size` is the apparent radius as a fraction of the smaller side of the safe area at the default camera.
      const apparent = slot.size * Math.min(safeWidth, safeHeight) / this.height;
      const radius = apparent * distance * Math.tan(FOV * Math.PI / 360) * 2;
      this.orbitals.add(this.orbitalMesh(slot.kind, radius, position));
      return {id, position, radius};
    });
    this.dirty = true;
    this.projectionDirty = true;
  }

  private orbitalMesh(kind: string, radius: number, position: Vector3) {
    let mesh: Mesh;
    if (kind === 'ganymede') {
      const material = new MeshStandardMaterial({color: 0xffffff, roughness: 0.95});
      new TextureLoader().load('assets/colonies-planets/ganymede.jpg', (texture) => {
        texture.colorSpace = SRGBColorSpace;
        material.map = texture;
        // A little self-light so the moon never reads as a black hole against space.
        material.emissiveMap = texture;
        material.emissive = new Color(0.32, 0.32, 0.34);
        material.needsUpdate = true;
        this.dirty = true;
      });
      mesh = new Mesh(new SphereGeometry(radius, 64, 32), material);
    } else if (kind === 'phobos') {
      const geometry = new IcosahedronGeometry(radius, 5);
      const positions = geometry.getAttribute('position') as BufferAttribute;
      for (let i = 0; i < positions.count; i++) {
        scratch.fromBufferAttribute(positions, i).normalize();
        const bumps = Math.sin(scratch.x * 9.1 + scratch.y * 3.3) * 0.06 + Math.sin(scratch.y * 13.7 - scratch.z * 7.2) * 0.04 +
          Math.max(0, 0.9 - scratch.distanceTo(scratch2.set(0.5, 0.6, 0.62).normalize()) * 2.4) * -0.25;
        scratch.multiply(scratch2.set(1.35, 0.95, 1.0)).multiplyScalar(radius * (1 + bumps));
        positions.setXYZ(i, scratch.x, scratch.y, scratch.z);
      }
      geometry.computeVertexNormals();
      mesh = new Mesh(geometry, new MeshStandardMaterial({color: new Color(0.42, 0.36, 0.31), roughness: 1}));
    } else {
      mesh = new Mesh(new CylinderGeometry(radius * 0.25, radius * 0.25, radius * 2, 12), new MeshStandardMaterial({color: 0xd8dde3, metalness: 0.6, roughness: 0.35}));
      const ring = new Mesh(new CylinderGeometry(radius, radius, radius * 0.18, 32, 1, true), new MeshStandardMaterial({color: 0xbfc6cf, metalness: 0.6, roughness: 0.4, side: BackSide}));
      mesh.add(ring);
      mesh.rotation.set(0.6, 0.2, 0.4);
    }
    mesh.position.copy(position);
    return mesh;
  }

  private rebuildBuildings() {
    const domeKey = (dome: {id: SpaceId, x: number, y: number}) => `${dome.id}:${dome.x}:${dome.y}`;
    const keys = new Set(this.state.domes.map(domeKey));
    const sharedMaterials = new Set(Object.values(this.cityMaterials));
    for (const [key, group] of this.domeGroups) {
      if (keys.has(key)) {
        continue;
      }
      group.traverse((object) => {
        if (object instanceof Mesh) {
          object.geometry.dispose();
          const material = object.material as MeshStandardMaterial;
          if (!sharedMaterials.has(material)) {
            material.dispose();
          }
        }
      });
      this.buildings.remove(group);
      this.domeGroups.delete(key);
    }
    this.cityLights.length = 0;
    const up = new Vector3(0, 1, 0);
    const {base, glass, frame, garden} = this.cityMaterials;
    for (const dome of this.state.domes) {
      const key = domeKey(dome);
      const existing = this.domeGroups.get(key);
      if (existing !== undefined) {
        existing.traverse((object) => {
          if (object instanceof Mesh && typeof object.userData.phase === 'number') {
            this.cityLights.push(object);
          }
        });
        continue;
      }
      const r = dome.radius * BOARD_SCALE;
      const group = new Group();
      const point = this.surface(dome.x, dome.y);
      group.position.copy(point);
      group.quaternion.copy(new Quaternion().setFromUnitVectors(up, scratch2.copy(point).normalize()));
      const ring = new Mesh(new CylinderGeometry(r * 1.14, r * 1.24, r * 0.2, 40), base);
      ring.position.y = r * 0.06;
      group.add(ring);
      const inner = new Mesh(new SphereGeometry(r * 0.92, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), garden);
      inner.position.y = r * 0.12;
      inner.scale.y = 0.32;
      group.add(inner);
      const shell = new Mesh(new SphereGeometry(r, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), glass);
      shell.position.y = r * 0.14;
      shell.scale.y = 0.62;
      group.add(shell);
      const ribs = new Mesh(new SphereGeometry(r * 1.003, dome.main ? 12 : 8, dome.main ? 5 : 3, 0, Math.PI * 2, 0, Math.PI / 2), frame);
      ribs.position.y = r * 0.14;
      ribs.scale.y = 0.62;
      group.add(ribs);
      const lights = dome.main ? 5 : 2;
      for (let i = 0; i < lights; i++) {
        const light = new Mesh(new SphereGeometry(r * 0.05, 6, 4), new MeshStandardMaterial({color: 0x000000, emissive: new Color(1.0, 0.78, 0.45), emissiveIntensity: 2.4}));
        const angle = (i / lights) * Math.PI * 2 + dome.x;
        light.position.set(Math.cos(angle) * r * 1.2, r * 0.2, Math.sin(angle) * r * 1.2);
        light.userData.phase = (dome.x * 13.1 + dome.y * 7.7 + i * 2.3) % 6.28;
        group.add(light);
        this.cityLights.push(light);
      }
      this.buildings.add(group);
      this.domeGroups.set(key, group);
    }
  }

  private stars() {
    const count = 2200;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    let seed = 7;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < count; i++) {
      const u = random() * 2 - 1;
      const t = random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      positions.set([s * Math.cos(t) * 90, s * Math.sin(t) * 90, u * 90], i * 3);
      const b = 0.35 + random() * random() * 0.9;
      const warm = random();
      colors.set([b * (0.9 + warm * 0.1), b * 0.93, b * (1.0 - warm * 0.15)], i * 3);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    return new Points(geometry, new PointsMaterial({size: 1.3, sizeAttenuation: false, vertexColors: true, depthWrite: false}));
  }

  /* ---------- Camera ---------- */

  private tilt(d: number) {
    const t = clamp((Math.log(d) - Math.log(MIN_DISTANCE)) / (Math.log(MAX_DISTANCE) - Math.log(MIN_DISTANCE)), 0, 1);
    return TILT_NEAR + (TILT_FAR - TILT_NEAR) * Math.pow(t, 1.7);
  }

  private place(camera: PerspectiveCamera, state: CameraState) {
    if (!Number.isFinite(state.x) || !Number.isFinite(state.y) || !Number.isFinite(state.d)) {
      state = this.home;
      this.current = {...this.home};
      this.target = {...this.home};
    }
    const target = this.surface(state.x, state.y);
    const n = target.clone().normalize();
    const north = this.surface(state.x, state.y - 1).sub(target).normalize();
    const tilt = this.tilt(state.d);
    camera.position.copy(target)
      .addScaledVector(n, state.d * Math.cos(tilt))
      .addScaledVector(north, -state.d * Math.sin(tilt));
    camera.up.copy(n).multiplyScalar(Math.sin(tilt)).addScaledVector(north, Math.cos(tilt));
    camera.lookAt(target);
    const altitude = camera.position.length() - PLANET_RADIUS;
    camera.near = Math.max(0.0002, altitude * 0.3);
    camera.far = 200;
    camera.aspect = this.width / this.height;
    camera.updateProjectionMatrix();
    // Move the principal point to the centre of the safe area between the HUD panels.
    const shiftX = (this.safe.left - this.safe.right) / 2;
    const shiftY = (this.safe.top - this.safe.bottom) / 2;
    camera.projectionMatrix.elements[8] = -2 * shiftX / this.width;
    camera.projectionMatrix.elements[9] = 2 * shiftY / this.height;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    camera.updateMatrixWorld(true);
  }

  private project(camera: PerspectiveCamera, world: Vector3): ScreenPoint {
    const v = scratch2.copy(world).project(camera);
    const inFront = v.z < 1 && v.z > -1;
    return {x: (v.x + 1) / 2 * this.width, y: (1 - v.y) / 2 * this.height, visible: inFront};
  }

  /** Board coordinates under a canvas pixel for a camera state, if the ray meets the board region. */
  private pick(state: CameraState, sx: number, sy: number) {
    this.place(this.probe, state);
    const ndc = new Vector3(sx / this.width * 2 - 1, -(sy / this.height * 2 - 1), 0.5).unproject(this.probe);
    const dir = ndc.sub(this.probe.position).normalize();
    const o = this.probe.position;
    const b = o.dot(dir);
    const c = o.lengthSq() - PLANET_RADIUS * PLANET_RADIUS;
    const disc = b * b - c;
    if (disc < 0) {
      return undefined;
    }
    const t = -b - Math.sqrt(disc);
    if (t < 0) {
      return undefined;
    }
    return this.boardOf(o.clone().addScaledVector(dir, t));
  }

  private bound(state: CameraState): CameraState {
    if (!Number.isFinite(state.x) || !Number.isFinite(state.y) || !Number.isFinite(state.d)) {
      return this.target;
    }
    const {minX, maxX, minY, maxY} = this.geometry.bounds;
    const d = clamp(state.d, MIN_DISTANCE, MAX_DISTANCE);
    // Close up the camera stays over the board; zoomed out the globe can be turned much further.
    const freedom = clamp((Math.log(d) - Math.log(this.home.d)) / (Math.log(MAX_DISTANCE) - Math.log(this.home.d)), 0, 1) * 1400;
    return {
      x: clamp(state.x, minX - freedom, maxX + freedom),
      y: clamp(state.y, minY - 40 - freedom, maxY + 20 + freedom),
      d,
    };
  }

  /**
   * Where the default framing fits the board. On a wide screen it is the whole page (the board
   * fills it, Mars still shows around it; the HUD panels may cover its edges), on a phone the
   * area between the HUD panels.
   */
  private fitArea(): SafeArea {
    if (this.width >= 900) {
      const edge = 4;
      return {top: edge, right: edge, bottom: edge, left: edge};
    }
    return this.safe;
  }

  private fitsSafeArea(state: CameraState, area: SafeArea = this.safe) {
    this.place(this.probe, state);
    const margin = 6;
    const {minX, maxX, minY, maxY} = this.geometry.bounds;
    const corners: Array<[number, number]> = [
      [minX + SPACE_WIDTH, minY + SPACE_HEIGHT * 0.6], [maxX - SPACE_WIDTH, minY + SPACE_HEIGHT * 0.6],
      [minX + SPACE_WIDTH * 0.6, this.geometry.centerY], [maxX - SPACE_WIDTH * 0.6, this.geometry.centerY],
      [minX + SPACE_WIDTH, maxY - SPACE_HEIGHT * 0.6], [maxX - SPACE_WIDTH, maxY - SPACE_HEIGHT * 0.6],
    ];
    return corners.every(([x, y]) => {
      const p = this.project(this.probe, this.surface(x, y));
      return p.visible && p.x >= area.left + margin && p.x <= this.width - area.right - margin &&
        p.y >= area.top + margin && p.y <= this.height - area.bottom - margin;
    });
  }

  /** Default framing: the closest view that shows the whole board inside the fit area. */
  private computeHome() {
    let low = MIN_DISTANCE;
    let high = MAX_DISTANCE;
    const base = {x: this.geometry.centerX, y: this.geometry.centerY + 8};
    const area = this.fitArea();
    for (let i = 0; i < 28; i++) {
      const mid = Math.sqrt(low * high);
      if (this.fitsSafeArea({...base, d: mid}, area)) {
        high = mid;
      } else {
        low = mid;
      }
    }
    this.home = {...base, d: high};
  }

  public get maxDistance() {
    return MAX_DISTANCE;
  }

  public setSize(width: number, height: number, safe: SafeArea) {
    width = Math.max(1, width);
    height = Math.max(1, height);
    if (width === this.width && height === this.height && safe.top === this.safe.top && safe.right === this.safe.right &&
      safe.bottom === this.safe.bottom && safe.left === this.safe.left) {
      return;
    }
    const homeBefore = this.home;
    const atHome = Math.abs(this.target.d - homeBefore.d) < 1e-4 && Math.abs(this.target.x - homeBefore.x) < 0.5 && Math.abs(this.target.y - homeBefore.y) < 0.5;
    this.width = width;
    this.height = height;
    this.safe = safe;
    this.renderer.setDrawingBufferSize(this.width, this.height, this.pixelRatio());
    this.computeHome();
    this.placeOrbitals();
    if (atHome) {
      this.target = {...this.home};
      this.current = {...this.home};
    }
    this.dirty = true;
  }

  public reset() {
    this.target = {...this.home};
    this.wake();
  }

  public panPixels(fromX: number, fromY: number, toX: number, toY: number) {
    const before = this.pick(this.target, fromX, fromY);
    const after = this.pick(this.target, toX, toY);
    if (before !== undefined && after !== undefined) {
      this.target = this.bound({...this.target, x: this.target.x + before.x - after.x, y: this.target.y + before.y - after.y});
    } else {
      const perPixel = this.target.d * 2 * Math.tan(FOV * Math.PI / 360) / this.height / BOARD_SCALE;
      this.target = this.bound({...this.target, x: this.target.x - (toX - fromX) * perPixel, y: this.target.y - (toY - fromY) * perPixel / Math.max(0.4, Math.cos(this.tilt(this.target.d)))});
    }
    this.wake();
  }

  public pan(dx: number, dy: number) {
    const cx = this.safe.left + (this.width - this.safe.left - this.safe.right) / 2;
    const cy = this.safe.top + (this.height - this.safe.top - this.safe.bottom) / 2;
    this.panPixels(cx, cy, cx + dx, cy + dy);
  }

  /** Zooms by `factor` (> 1 brings the camera closer) keeping the point under (sx, sy) fixed. */
  public zoomAt(factor: number, sx?: number, sy?: number) {
    const px = sx ?? this.safe.left + (this.width - this.safe.left - this.safe.right) / 2;
    const py = sy ?? this.safe.top + (this.height - this.safe.top - this.safe.bottom) / 2;
    const anchor = this.pick(this.target, px, py);
    let next = this.bound({...this.target, d: this.target.d / factor});
    if (anchor !== undefined) {
      for (let i = 0; i < 3; i++) {
        const now = this.pick(next, px, py);
        if (now === undefined) {
          break;
        }
        next = this.bound({...next, x: next.x + anchor.x - now.x, y: next.y + anchor.y - now.y});
      }
    }
    this.target = next;
    this.wake();
  }

  /** Brings a space into the safe area if it is outside it. */
  public reveal(id: SpaceId) {
    const cell = this.geometry.byId.get(id);
    if (cell === undefined) {
      return;
    }
    this.place(this.probe, this.target);
    const p = this.project(this.probe, this.surface(cell.x, cell.y));
    const inset = 36;
    if (!p.visible || p.x < this.safe.left + inset || p.x > this.width - this.safe.right - inset ||
      p.y < this.safe.top + inset || p.y > this.height - this.safe.bottom - inset) {
      this.target = this.bound({...this.target, x: cell.x, y: cell.y, d: Math.min(this.target.d, this.home.d)});
      this.wake();
    }
  }

  public get isHome() {
    return Math.abs(this.target.d - this.home.d) < 1e-3 && Math.abs(this.target.x - this.home.x) < 1 && Math.abs(this.target.y - this.home.y) < 1;
  }

  public setReducedMotion(reduced: boolean) {
    this.reducedMotion = reduced;
    this.wake();
  }

  /* ---------- Projection for DOM hit areas ---------- */

  public spaceTransform(id: SpaceId): SpaceTransform | undefined {
    const cell = this.geometry.byId.get(id);
    if (cell === undefined) {
      return undefined;
    }
    const world = this.surface(cell.x, cell.y);
    const toCamera = scratch.copy(this.camera.position).sub(world);
    const facing = toCamera.dot(world) > 0;
    const centre = this.project(this.camera, world);
    const right = this.project(this.camera, this.surface(cell.x + 1, cell.y));
    const down = this.project(this.camera, this.surface(cell.x, cell.y + 1));
    const a = right.x - centre.x;
    const b = right.y - centre.y;
    const c = down.x - centre.x;
    const d = down.y - centre.y;
    const hx = SPACE_WIDTH / 2;
    const hy = SPACE_HEIGHT / 2;
    const onScreen = centre.x > -60 && centre.y > -60 && centre.x < this.width + 60 && centre.y < this.height + 60;
    return {
      matrix: [a, b, c, d, centre.x - (a * hx + c * hy), centre.y - (b * hx + d * hy)],
      visible: facing && centre.visible && onScreen,
    };
  }

  public orbitalScreen(): Array<{id: SpaceId, x: number, y: number, size: number, visible: boolean}> {
    return this.orbitalAnchors.map(({id, position, radius}) => {
      const p = this.project(this.camera, position);
      const distance = this.camera.position.distanceTo(position);
      const size = radius / distance / Math.tan(FOV * Math.PI / 360) * this.height;
      const occluded = this.occludedByPlanet(position);
      return {id, x: p.x, y: p.y, size, visible: p.visible && !occluded && p.x > -40 && p.y > -40 && p.x < this.width + 40 && p.y < this.height + 40};
    });
  }

  private occludedByPlanet(point: Vector3) {
    const o = this.camera.position;
    const dir = scratch.copy(point).sub(o);
    const length = dir.length();
    dir.divideScalar(length);
    const b = o.dot(dir);
    const disc = b * b - (o.lengthSq() - PLANET_RADIUS * PLANET_RADIUS);
    if (disc < 0) {
      return false;
    }
    const t = -b - Math.sqrt(disc);
    return t > 0 && t < length;
  }

  /* ---------- Loop ---------- */

  private wake() {
    this.dirty = true;
  }

  private loop(now: number) {
    if (this.disposed) {
      return;
    }
    this.frameHandle = requestAnimationFrame(this.loop);
    if (document.hidden) {
      this.lastFrame = 0;
      this.lastRender = 0;
      return;
    }
    const dt = Math.min(0.1, (now - (this.lastFrame || now)) / 1000);
    this.lastFrame = now;

    const before = this.current;
    if (this.reducedMotion) {
      this.current = {...this.target};
    } else {
      const k = 1 - Math.exp(-dt * 11);
      this.current = {
        x: before.x + (this.target.x - before.x) * k,
        y: before.y + (this.target.y - before.y) * k,
        d: Math.exp(Math.log(before.d) + (Math.log(this.target.d) - Math.log(before.d)) * k),
      };
      if (Math.abs(this.current.x - this.target.x) < 0.02 && Math.abs(this.current.y - this.target.y) < 0.02 && Math.abs(this.current.d / this.target.d - 1) < 1e-4) {
        this.current = {...this.target};
      }
    }
    const moving = before.x !== this.current.x || before.y !== this.current.y || before.d !== this.current.d;

    // Keep camera movement responsive, with fewer idle frames on touch phones.
    const pulsing = this.pulseStart > 0 && now - this.pulseStart < PULSE_MS + 100;
    const ambientInterval = this.compactDisplay ? 125 : 66;
    const ambientDue = !this.reducedMotion && !document.hidden && (now - this.lastRender > ambientInterval || (pulsing && !this.compactDisplay));
    if (!moving && !this.dirty && !ambientDue) {
      return;
    }
    if (this.lastRender > 0 && (moving || ambientDue)) {
      // Idle animation also needs to adapt when the planet shader stalls the GPU.
      const interval = now - this.lastRender;
      this.adaptResolution(now, moving ? interval : interval - ambientInterval + 16);
    }
    const seconds = this.reducedMotion ? 0 : (now - this.start) / 1000;
    this.planetMaterial.uniforms.time.value = seconds;
    const pulse = this.pulseStart > 0 ? Math.max(0, 1 - (now - this.pulseStart) / PULSE_MS) : 0;
    this.planetMaterial.uniforms.pulse.value = pulse;
    this.atmosphereMaterial.uniforms.pulse.value = pulse;
    this.animateAmbient(seconds);
    const projectionChanged = moving || this.projectionDirty;
    if (projectionChanged) {
      this.place(this.camera, this.current);
      this.projectionDirty = false;
    }
    this.renderer.render(this.scene, this.camera);
    this.lastRender = now;
    if (projectionChanged) {
      this.onFrame();
    }
    this.dirty = false;
  }

  private pixelRatio() {
    const pixelBudget = this.compactDisplay ? 750_000 : 1_800_000;
    const budgetRatio = Math.sqrt(pixelBudget / (this.width * this.height));
    return Math.min(window.devicePixelRatio || 1, this.compactDisplay ? 1 : 1.5, budgetRatio) * this.renderScale;
  }

  /**
   * Dynamic resolution: the surface shader costs per pixel, so on large or high-DPI screens the
   * scene drops its resolution while frames take too long and recovers it when they are fast again.
   */
  private adaptResolution(now: number, interval: number) {
    if (interval <= 0) {
      return;
    }
    if (interval > 26) {
      this.slowFrames++;
      this.fastFrames = 0;
    } else if (interval < 18) {
      this.fastFrames++;
      this.slowFrames = 0;
    }
    let next = this.renderScale;
    if (this.slowFrames >= 4 && this.renderScale > 0.5) {
      next = Math.max(0.5, this.renderScale - 0.15);
    } else if (this.fastFrames >= 45 && this.renderScale < 1) {
      next = Math.min(1, this.renderScale + 0.1);
    }
    if (next !== this.renderScale && now - this.lastScaleChange > 300) {
      this.renderScale = next;
      this.slowFrames = 0;
      this.fastFrames = 0;
      this.lastScaleChange = now;
      this.renderer.setDrawingBufferSize(this.width, this.height, this.pixelRatio());
    }
  }

  private animateAmbient(seconds: number) {
    for (const light of this.cityLights) {
      const phase = light.userData.phase as number;
      const material = light.material as MeshStandardMaterial;
      material.emissiveIntensity = this.reducedMotion ? 2.2 : 1.8 + Math.sin(seconds * 0.9 + phase) * 0.5 + (Math.sin(seconds * 7.3 + phase * 3) > 0.985 ? 1.2 : 0);
    }
    // A shuttle crosses the sky now and then, far from the board.
    const period = 38;
    const t = (seconds % period) / 7;
    this.shuttle.visible = !this.reducedMotion && t < 1;
    if (this.shuttle.visible) {
      const angle = -0.9 + t * 1.8;
      this.shuttle.position.copy(C).multiplyScalar(Math.cos(angle) * 1.0)
        .addScaledVector(E, Math.sin(angle) * 1.0)
        .addScaledVector(N, 0.62)
        .normalize().multiplyScalar(1.1);
    }
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameHandle);
    const materials = new Set<MeshStandardMaterial>(Object.values(this.cityMaterials));
    this.scene.traverse((object) => {
      const mesh = object as Mesh;
      mesh.geometry?.dispose();
      const material = mesh.material as MeshStandardMaterial | undefined;
      if (material !== undefined) {
        materials.add(material);
      }
    });
    materials.forEach((material) => {
      material.map?.dispose();
      material.dispose();
    });
    this.state.dispose();
    this.domeGroups.clear();
    this.renderer.dispose();
  }
}

export function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return canvas.getContext('webgl2') !== null || canvas.getContext('webgl') !== null;
  } catch {
    return false;
  }
}
