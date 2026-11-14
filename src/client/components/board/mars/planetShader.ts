// GLSL for the Mars surface, its atmosphere and the hex grid.
// Everything on the surface is lit by the single `sunDirection` uniform shared with the 3D objects.

const NOISE = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

vec3 hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
`;

export const PLANET_VERTEX = /* glsl */ `
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const PLANET_FRAGMENT = /* glsl */ `
precision highp float;

uniform vec3 sunDirection;
uniform vec3 sunColor;
uniform vec3 shadowColor;
uniform float time;

// Board frame: gnomonic projection of board pixels onto the sphere (see BoardGeometry.ts).
uniform vec3 boardCenter;
uniform vec3 boardEast;
uniform vec3 boardNorth;
uniform float boardScale;
uniform vec2 boardOrigin;
uniform vec4 terrainRect;       // minX, minY, width, height of the terrain texture in board pixels
uniform sampler2D terrain;      // r: ocean, g: greenery, b: settled ground, a: building shadow
uniform sampler2D cells;
uniform sampler2D owners;       // per lattice cell: rgb owner colour, a owned        // per lattice cell: r exists, g legal, b inspected, a ocean reserve
uniform vec2 cellsSize;
uniform vec4 lattice;           // latticeX, latticeY, middleRow, rowCount
uniform float gridStrength;
uniform float showBoard;
uniform float placing;          // 1 while the player chooses a space: everything but the legal spaces dims
// Climate from the global parameters, each 0 (start) .. 1 (maximum).
uniform float warmth;           // temperature
uniform float air;              // oxygen
uniform float seas;             // oceans
uniform float pulse;            // 1 .. 0 right after a global parameter rose
uniform vec3 pulseColor;

varying vec3 vWorld;
varying vec3 vNormal;

${NOISE}

float fbm(vec3 p, float octaves) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 14; i++) {
    float w = clamp(octaves - float(i), 0.0, 1.0);
    if (w <= 0.0) break;
    sum += amp * w * snoise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    amp *= 0.5;
  }
  return sum;
}

float ridged(vec3 p, float octaves) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 8; i++) {
    float w = clamp(octaves - float(i), 0.0, 1.0);
    if (w <= 0.0) break;
    float n = 1.0 - abs(snoise(p));
    sum += amp * w * n * n;
    p = p * 2.11 + vec3(4.1, 2.3, 7.7);
    amp *= 0.5;
  }
  return sum;
}

// One crater per lattice cell, kept inside its cell so a single lookup per layer is enough.
// Returns height offset; writes floor darkening and rim brightening into albedo hints.
float craterLayer(vec3 p, float scale, float density, inout float floorMask, inout float rimMask) {
  vec3 q = p * scale;
  vec3 cell = floor(q);
  vec3 h = hash33(cell);
  if (h.z > density) return 0.0;
  vec3 center = cell + 0.3 + 0.4 * hash33(cell + 17.0);
  float radius = 0.08 + 0.17 * h.x * h.x;
  float d = length(q - center) / radius;
  if (d > 1.6) return 0.0;
  float bowl = (d * d - 1.0) * 0.6;
  float rim = exp(-pow((d - 1.0) * 3.2, 2.0)) * 0.35;
  float outer = d > 1.0 ? 0.35 * exp(-(d - 1.0) * 4.0) * 0.4 : 0.0;
  float profile = d < 1.0 ? bowl + rim : rim + outer;
  floorMask = max(floorMask, (1.0 - smoothstep(0.55, 0.95, d)) * (0.5 + 0.5 * h.y));
  rimMask = max(rimMask, rim);
  return profile * radius / scale;
}

// Nearest board space and distance to its edge, in board pixels.
void hexCell(vec2 b, out vec2 cellId, out float edge, out vec2 centre) {
  float fr = (b.y - lattice.y) / 41.0 + lattice.z;
  float r0 = floor(fr);
  float best = 1e9;
  vec2 bestCentre = vec2(0.0);
  vec2 bestId = vec2(-1.0);
  vec2 cands[6];
  vec2 ids[6];
  for (int k = 0; k < 2; k++) {
    float r = r0 + float(k);
    float parity = mod(abs(r - lattice.z), 2.0);
    float fc = (b.x - lattice.x) / 24.5;
    float c = floor((fc - parity) / 2.0 + 0.5) * 2.0 + parity;
    for (int j = 0; j < 3; j++) {
      float cc = c + float(j - 1) * 2.0;
      vec2 ctr = vec2(lattice.x + cc * 24.5, lattice.y + (r - lattice.z) * 41.0);
      cands[k * 3 + j] = ctr;
      ids[k * 3 + j] = vec2(cc, r);
      float dd = dot(b - ctr, b - ctr);
      if (dd < best) {
        best = dd;
        bestCentre = ctr;
        bestId = vec2(cc, r);
      }
    }
  }
  float e = 1e9;
  for (int i = 0; i < 6; i++) {
    vec2 o = cands[i];
    vec2 diff = o - bestCentre;
    float len = length(diff);
    if (len < 1.0) continue;
    float di = (dot(b - o, b - o) - best) / (2.0 * len);
    e = min(e, di);
  }
  cellId = bestId;
  edge = e;
  centre = bestCentre;
}

vec4 cellData(vec2 id) {
  if (id.x < 0.0 || id.y < 0.0 || id.x >= cellsSize.x || id.y >= cellsSize.y) return vec4(0.0);
  return texture2D(cells, (id + 0.5) / cellsSize);
}

vec4 ownerData(vec2 id) {
  if (id.x < 0.0 || id.y < 0.0 || id.x >= cellsSize.x || id.y >= cellsSize.y) return vec4(0.0);
  return texture2D(owners, (id + 0.5) / cellsSize);
}

void main() {
  vec3 p = normalize(vWorld);
  vec3 viewVector = cameraPosition - vWorld;
  float viewDistance = length(viewVector);
  vec3 V = viewVector / viewDistance;

  // Level of detail from the size of one pixel on the surface.
  float footprint = max(length(fwidth(vWorld)), 1e-6);
  float octaves = clamp(log2(0.5 / (footprint * 3.0)), 3.0, 11.0);

  // Height field: continents, ridges, craters and fine grit.
  float continents = fbm(p * 2.2, 5.0);
  float ridges = ridged(p * 18.0 + continents, max(octaves - 5.0, 1.0));
  float detail = fbm(p * 60.0, max(octaves - 5.0, 1.0));
  float floorMask = 0.0;
  float rimMask = 0.0;
  float craters = 0.0;
  craters += craterLayer(p, 7.0, 0.5, floorMask, rimMask);
  craters += craterLayer(p.yzx + 3.1, 23.0, 0.35, floorMask, rimMask);
  craters += craterLayer(p.zxy + 7.7, 71.0, 0.22, floorMask, rimMask);
  craters += clamp(octaves - 7.0, 0.0, 1.0) * craterLayer(p + 11.3, 230.0, 0.16, floorMask, rimMask);
  craters += clamp(octaves - 9.0, 0.0, 1.0) * craterLayer(p.yxz + 5.9, 760.0, 0.22, floorMask, rimMask);
  craters += clamp(octaves - 10.0, 0.0, 1.0) * craterLayer(p.zyx + 2.4, 2400.0, 0.3, floorMask, rimMask);

  // Board coordinates of this point.
  float facing = dot(p, boardCenter);
  vec3 q = p / max(facing, 0.05) - boardCenter;
  vec2 b = vec2(dot(q, boardEast), -dot(q, boardNorth)) / boardScale + boardOrigin;
  vec2 rectMin = terrainRect.xy;
  vec2 rectMax = terrainRect.xy + terrainRect.zw;
  bool onBoard = facing > 0.3 && showBoard > 0.5 && b.x > rectMin.x && b.y > rectMin.y && b.x < rectMax.x && b.y < rectMax.y;
  // Cheap probe first: most of the planet has no terraforming, so skip the edge noise there.
  float nearby = 0.0;
  if (onBoard) {
    vec2 r = 24.0 / terrainRect.zw;
    vec2 c = (b - rectMin) / terrainRect.zw;
    vec4 probe = max(max(texture2D(terrain, c), texture2D(terrain, c + vec2(r.x, 0.0))),
      max(max(texture2D(terrain, c - vec2(r.x, 0.0)), texture2D(terrain, c + vec2(0.0, r.y))), texture2D(terrain, c - vec2(0.0, r.y))));
    nearby = max(max(probe.r, probe.g), max(probe.b, probe.a));
  }
  vec4 state = vec4(0.0);
  float oceanField = 0.0;
  float greenField = 0.0;
  float edgeNoise = 0.0;
  if (nearby > 0.003) {
    // Domain warp (about 10 board px) so terraformed areas never trace the hex outlines.
    vec2 warp = vec2(fbm(p * 38.0 + 3.0, 3.0), fbm(p * 38.0 + 11.0, 3.0)) * 16.0
      + vec2(snoise(p * 140.0), snoise(p * 140.0 + 7.0)) * 3.5;
    state = texture2D(terrain, clamp((b + warp - rectMin) / terrainRect.zw, 0.0, 1.0));
    // Irregular edges: the soft fields from the game state are cut with noise
    // so coastlines and meadows cross the hex borders and never follow them exactly.
    edgeNoise = fbm(p * 70.0, 3.0) * 0.2 + snoise(p * 330.0) * 0.05 + snoise(p * 1500.0) * 0.02;
    oceanField = state.r + edgeNoise;
    if (state.g > 0.003) {
      greenField = state.g + fbm(p * 90.0 + 4.0, 4.0) * 0.32 + snoise(p * 420.0) * 0.07;
    }
  }
  float water = smoothstep(0.47, 0.5, oceanField);
  float depth = smoothstep(0.5, 0.95, oceanField);
  float wet = smoothstep(0.36, 0.48, oceanField) * (1.0 - water);
  float green = smoothstep(0.36, 0.48, greenField) * (1.0 - water * 0.98);
  float settled = smoothstep(0.35, 0.7, state.b + edgeNoise * 0.5) * (1.0 - water);

  float height = continents * 0.004 + ridges * 0.0016 * (0.4 + continents) + detail * 0.0006 + craters * 0.5;
  height += fbm(p * 900.0, max(octaves - 8.0, 0.0)) * 0.00008;
  height = mix(height, height * 0.2, water);
  if (green > 0.0) {
    height += green * (fbm(p * 3200.0, max(octaves - 9.0, 0.0)) * 0.00005 + snoise(p * 900.0) * 0.00004);
  }

  // Bump-mapped normal from screen-space derivatives of the height field.
  vec3 N = normalize(vNormal);
  vec3 dpdx = dFdx(vWorld);
  vec3 dpdy = dFdy(vWorld);
  float dhdx = dFdx(height);
  float dhdy = dFdy(height);
  vec3 r1 = cross(dpdy, N);
  vec3 r2 = cross(N, dpdx);
  float det = dot(dpdx, r1);
  vec3 grad = sign(det) * (dhdx * r1 + dhdy * r2);
  vec3 bumped = normalize(abs(det) * N - grad * 2.6);

  // Albedo: rust dust, dark basalt, pale dust on ridges and dark crater floors.
  float tone = fbm(p * 5.0 + 2.0, 5.0);
  float basaltMask = smoothstep(0.05, 0.35, fbm(p * 3.1 + 9.0, 5.0) + tone * 0.3);
  vec3 dust = vec3(0.70, 0.41, 0.24);
  vec3 rust = vec3(0.54, 0.27, 0.15);
  vec3 basalt = vec3(0.30, 0.17, 0.11);
  vec3 albedo = mix(rust, dust, smoothstep(-0.3, 0.4, tone + ridges * 0.3));
  albedo = mix(albedo, basalt, basaltMask * 0.7);
  albedo *= 0.88 + 0.24 * fbm(p * 140.0, max(octaves - 6.0, 1.0));
  albedo = mix(albedo, albedo * 0.72, floorMask * 0.6);
  albedo = mix(albedo, albedo * 1.06 + 0.01, rimMask * 0.35);

  // Polar caps: ice that retreats towards the poles as the temperature rises.
  float latitude = abs(normalize(p).y);
  float capEdge = mix(0.80, 0.965, warmth) + fbm(p * 9.0 + 5.0, 4.0) * 0.05;
  float capIce = smoothstep(capEdge, capEdge + 0.025, latitude);
  albedo = mix(albedo, mix(vec3(0.86, 0.88, 0.92), vec3(0.95, 0.96, 1.0), fbm(p * 60.0, 3.0) + 0.5), capIce);

  // Settlement ground, damp soil, vegetation.
  albedo = mix(albedo, vec3(0.50, 0.40, 0.33), settled * 0.55);
  albedo = mix(albedo, albedo * 0.55 + vec3(0.02, 0.015, 0.01), wet);
  if (green > 0.0) {
    float meadowTone = fbm(p * 240.0, 3.0) + 0.4 * fbm(p * 1400.0, max(octaves - 8.0, 1.0));
    vec3 meadow = mix(vec3(0.09, 0.17, 0.06), vec3(0.30, 0.34, 0.12), smoothstep(-0.45, 0.55, meadowTone));
    meadow = mix(meadow, vec3(0.05, 0.11, 0.05), smoothstep(0.15, 0.6, snoise(p * 3800.0)) * 0.55);
    meadow = mix(meadow, vec3(0.42, 0.36, 0.20), smoothstep(0.35, 0.7, fbm(p * 600.0 + 2.0, 3.0)) * 0.35);
    meadow = mix(meadow, meadow * vec3(0.75, 1.15, 0.7), air * 0.6);
    float greenEdge = smoothstep(0.4, 0.62, greenField);
    vec3 scrub = mix(albedo, vec3(0.36, 0.31, 0.15), 0.6);
    albedo = mix(albedo, mix(scrub, meadow, greenEdge), green);
  }

  // Lighting: warm sun, cool shade.
  vec3 L = normalize(sunDirection);
  float diffuse = max(dot(bumped, L), 0.0);
  float terminator = smoothstep(-0.12, 0.2, dot(N, L));
  float buildingShadow = 1.0 - state.a * 0.75;
  vec3 lit = albedo * sunColor * diffuse * terminator * buildingShadow;
  vec3 shade = albedo * shadowColor * (0.55 + 0.45 * max(dot(bumped, N), 0.0));
  vec3 colour = lit * 1.6 + shade;

  // Water: depth tint, sky reflection and a gently moving sun glint.
  if (water > 0.001) {
    vec3 shallow = vec3(0.16, 0.42, 0.42);
    vec3 deep = vec3(0.03, 0.11, 0.20);
    vec3 body = mix(shallow, deep, depth) * (0.35 + 0.65 * terminator);
    vec3 bottom = albedo * sunColor * diffuse * terminator * 0.6;
    body = mix(bottom, body, smoothstep(0.0, 0.25, depth) * 0.8 + 0.2);
    vec2 flow = b * 0.09;
    vec3 rippleP = vec3(flow, time * 0.12);
    float r1n = snoise(rippleP) * 0.5 + snoise(rippleP * 2.7 + 3.0) * 0.25;
    vec3 wn = normalize(N + (boardEast * (snoise(rippleP * 1.3) + r1n * 0.4) + boardNorth * snoise(rippleP * 1.3 + 9.0)) * 0.035);
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(wn, H), 0.0), 260.0) * 2.2 + pow(max(dot(wn, H), 0.0), 30.0) * 0.12;
    float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(wn, V), 0.0), 5.0);
    vec3 sky = vec3(0.50, 0.60, 0.74) * terminator;
    vec3 waterColour = mix(body, sky, 0.06 + fresnel * 0.6) + sunColor * spec * terminator * buildingShadow;
    float foam = smoothstep(0.03, 0.0, abs(oceanField - 0.5)) * 0.25;
    waterColour += foam * terminator;
    colour = mix(colour, waterColour, water);
  }

  // Hex grid lying on the surface.
  float px = max(length(fwidth(b)), 0.001);
  float legalHere = 0.0;
  if (onBoard) {
    vec2 cellId; float edge; vec2 centre;
    hexCell(b, cellId, edge, centre);
    vec4 data = cellData(cellId);
    float line = 1.0 - smoothstep(0.85 * px, 1.65 * px, edge - 0.9);
    float outline = 1.0 - smoothstep(1.6 * px, 2.5 * px, edge - 0.9);
    float inner = 1.0 - smoothstep(0.0, 6.0, edge);
    float exists = data.r;
    vec3 rest = vec3(1.0, 0.86, 0.68);
    float restAlpha = gridStrength * (0.70 + 0.12 * data.a);
    colour = mix(colour, vec3(0.045, 0.035, 0.03), outline * 0.62 * exists);
    colour = mix(colour, rest, line * restAlpha * exists);
    // Ocean reserve: the whole space washed in translucent blue.
    if (data.a > 0.5 && water < 0.5) {
      colour = mix(colour, vec3(0.22, 0.52, 0.92) * (0.45 + 0.55 * terminator), 0.34 * exists);
    }
    vec4 owner = ownerData(cellId);
    if (owner.a > 0.5) {
      float band = 1.0 - smoothstep(2.6 * px, 3.6 * px, edge - 0.9);
      vec3 ownerColour = owner.rgb * (0.6 + 0.5 * terminator);
      colour = mix(colour, vec3(0.02), (1.0 - smoothstep(3.6 * px, 4.6 * px, edge - 0.9)) * 0.55);
      colour = mix(colour, ownerColour, band);
    }
    if (data.g > 0.5) {
      legalHere = 1.0;
      float beat = 0.85 + 0.15 * sin(time * 2.4);
      vec3 glowIce = vec3(0.45, 0.92, 1.0);
      float thick = 1.0 - smoothstep(2.2 * px, 3.4 * px, edge - 0.9);
      colour = mix(colour, glowIce, max(line, thick * placing) * 0.96 * beat);
      colour = mix(colour, colour + glowIce * (0.12 + 0.16 * placing * beat), inner * 0.45 + 0.35 * placing);
    }
    if (data.b > 0.5) {
      vec3 gold = vec3(1.0, 0.82, 0.58);
      colour = mix(colour, gold, min(1.0, line * 1.4));
      colour = mix(colour, colour + gold * 0.3, inner * 0.8);
    }
  }

  // Aerial perspective: thin blue haze where the view grazes the surface.
  float grazing = 1.0 - max(dot(N, V), 0.0);
  float haze = pow(grazing, 5.0) * 0.75;
  float sunSide = smoothstep(-0.25, 0.35, dot(N, L));
  vec3 hazeColour = mix(vec3(0.75, 0.55, 0.42), mix(vec3(0.80, 0.56, 0.46), vec3(0.42, 0.62, 1.0), 0.35 + 0.65 * air), pow(grazing, 2.5)) * sunSide;
  colour = mix(colour, hazeColour, haze * (0.75 + 0.5 * air));

  // Night side: city lights glow where the sun has set.
  float night = 1.0 - smoothstep(-0.05, 0.25, dot(N, L));
  if (settled > 0.01 && night > 0.01) {
    float sparks = smoothstep(0.55, 0.9, snoise(p * 2600.0)) + smoothstep(0.3, 0.8, snoise(p * 700.0)) * 0.4;
    colour += vec3(1.0, 0.72, 0.38) * settled * night * (0.25 + sparks * 1.4);
  }

  // Over the board clouds and storms thin out gradually, so the spaces stay readable.
  float awayFromBoard = smoothstep(0.18, 0.7, acos(clamp(dot(normalize(p), boardCenter), -1.0, 1.0)));
  float weatherOverBoard = mix(0.3, 1.0, awayFromBoard);

  // Clouds: none on the cold, dry planet; drifting bands as it gets warm and wet.
  float cloudCover = clamp(warmth * 0.55 + seas * 0.55 - 0.2, 0.0, 0.75);
  if (cloudCover > 0.0) {
    vec3 cp = p * 3.2 + vec3(time * 0.006, 0.0, time * 0.002);
    float cloudField = fbm(cp + fbm(cp * 1.7 + 4.0, 3.0) * 0.6, 4.0) + 0.5 * fbm(p * 18.0 + time * 0.01, 2.0);
    float cloud = smoothstep(0.5 - cloudCover * 0.5, 1.05 - cloudCover * 0.3, cloudField + 0.25);
    cloud *= weatherOverBoard * 0.8;
    float cloudLight = 0.25 + 0.75 * smoothstep(-0.15, 0.4, dot(N, L));
    colour = mix(colour, vec3(0.93, 0.94, 0.97) * cloudLight, cloud * cloudCover * 1.2);
  }

  // Dust storms: a rust front crossing the planet from time to time, weaker as the air thickens.
  float stormStrength = (1.0 - air) * smoothstep(0.2, 0.8, sin(time * 0.045) * 0.5 + 0.5);
  if (stormStrength > 0.01) {
    vec3 stormCentre = normalize(vec3(sin(time * 0.02) * 0.9, 0.15 + 0.2 * sin(time * 0.013), cos(time * 0.02)));
    float reach = smoothstep(0.55, 0.95, dot(normalize(p), stormCentre));
    if (reach > 0.001) {
      float dustField = fbm(p * 6.0 + vec3(time * 0.03, 0.0, -time * 0.02), 4.0) * 0.5 + 0.5;
      float storm = reach * smoothstep(0.35, 0.75, dustField) * stormStrength * weatherOverBoard * 0.85;
      vec3 dustColour = vec3(0.78, 0.46, 0.26) * (0.35 + 0.65 * smoothstep(-0.2, 0.4, dot(N, L)));
      colour = mix(colour, dustColour, storm * 0.7);
    }
  }

  // A parameter just rose: a wave of colour spreads from the board over the planet.
  if (pulse > 0.001) {
    float distanceFromBoard = acos(clamp(dot(normalize(p), boardCenter), -1.0, 1.0));
    float front = (1.0 - pulse) * 1.6;
    float ring = exp(-pow((distanceFromBoard - front) * 7.0, 2.0));
    colour += pulseColor * (ring * 0.55 + 0.08) * pulse;
  }
  // Choosing a space: the rest of the planet steps back.
  colour = mix(colour, colour * 0.28, placing * (1.0 - legalHere));

  gl_FragColor = vec4(colour, 1.0);
}
`;

export const ATMOSPHERE_VERTEX = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const ATMOSPHERE_FRAGMENT = /* glsl */ `
precision highp float;
uniform vec3 sunDirection;
uniform float planetRadius;
uniform float atmosphereRadius;
uniform float air;
uniform float pulse;
uniform vec3 pulseColor;
varying vec3 vWorld;
void main() {
  vec3 dir = normalize(vWorld - cameraPosition);
  float t = -dot(cameraPosition, dir);
  vec3 closest = cameraPosition + dir * t;
  float b = length(closest);
  float thickness = atmosphereRadius - planetRadius;
  float above = (b - planetRadius) / thickness;
  float glow;
  if (b >= planetRadius) {
    glow = exp(-above * 5.0) * (1.0 - smoothstep(0.85, 1.0, above));
  } else {
    glow = exp((b - planetRadius) / (thickness * 0.12)) * 0.9;
  }
  if (t < 0.0) glow = 0.0;
  float lit = smoothstep(-0.25, 0.45, dot(normalize(closest), normalize(sunDirection)));
  // Thin and dusty pink at the start, a deep blue shell once the air is breathable.
  vec3 thin = mix(vec3(0.62, 0.40, 0.34), vec3(0.85, 0.66, 0.55), exp(-above * 2.0));
  vec3 thick = mix(vec3(0.20, 0.42, 1.0), vec3(0.55, 0.78, 1.0), exp(-above * 2.0));
  vec3 colour = mix(thin, thick, smoothstep(0.0, 0.8, air)) + pulseColor * pulse * 0.6;
  gl_FragColor = vec4(colour * glow * lit * (0.75 + 0.55 * air + pulse * 0.5), 1.0);
}
`;
