/**
 * Custom vertex attributes.
 *
 * These are the highest-leverage decision in the whole rendering approach.
 * Because the geometry is authored in code rather than imported, the builders
 * already know where a plate's edges are, where its crevices are, and which
 * surfaces a crew member's hands and boots actually touch. Writing that
 * knowledge into vertex attributes at build time lets the shader put paint
 * chipping on real edges, dirt in real crevices and polish on real handles —
 * without a single texture file, and more accurately than any noise function
 * could guess.
 */

/** Attribute names as they appear in the shader. */
export const ATTR = {
  edgeDist: 'aEdgeDist',
  cavity: 'aCavity',
  wear: 'aWear',
  region: 'aRegion',
} as const;

/**
 * Which part of the vehicle a surface belongs to. Drives the wear profile
 * (exterior surfaces get sun-faded paint, dust and rust; interior surfaces get
 * oil, foot-traffic polish and no dust at all) and the portal culling.
 */
export enum Region {
  Exterior = 0,
  FightingCompartment = 1,
  DriverCompartment = 2,
  TurretInterior = 3,
  EngineBay = 4,
  /** Surfaces inside a mechanism that are only visible in x-ray mode. */
  Internal = 5,
}

export const REGION_COUNT = 6;

export function regionName(r: Region): string {
  return (
    {
      [Region.Exterior]: 'Exterior',
      [Region.FightingCompartment]: 'Fighting compartment',
      [Region.DriverCompartment]: 'Driver compartment',
      [Region.TurretInterior]: 'Turret interior',
      [Region.EngineBay]: 'Engine bay',
      [Region.Internal]: 'Internal',
    }[r] ?? 'Unknown'
  );
}

export function isInterior(r: Region): boolean {
  return r !== Region.Exterior;
}

/** Per-vertex attribute values carried by the builder's current state. */
export interface VertexState {
  /**
   * Millimetres to the nearest structural edge of the surface this vertex
   * belongs to. Drives paint chipping, which concentrates on edges.
   * Large values mean "middle of a plate".
   */
  edgeDist: number;
  /**
   * 0 = flat or convex, 1 = deep crevice. Drives dirt and rust accumulation.
   * Computed geometrically by `MeshBuilder.recomputeNormals`, or set by hand
   * where a builder knows better.
   */
  cavity: number;
  /**
   * 0 = untouched, 1 = constantly handled. Authored, not computed: only the
   * builder knows that this is a grab handle, a hatch rim, a seat cushion or a
   * gear lever knob.
   */
  wear: number;
  region: Region;
}

export const DEFAULT_VERTEX_STATE: VertexState = {
  edgeDist: 1000,
  cavity: 0,
  wear: 0,
  region: Region.Exterior,
};

/** Wear levels worth naming, so builders express intent rather than magic numbers. */
export const WEAR = {
  none: 0,
  /** Surfaces brushed past — sponson walls, plate faces near a walkway. */
  incidental: 0.2,
  /** Surfaces stepped on — engine deck, fender tops, turret roof. */
  footTraffic: 0.5,
  /** Surfaces gripped daily — hatch rims, grab handles, ladder rungs. */
  handled: 0.8,
  /** Surfaces in constant contact — levers, handwheels, pedals, seat cushions. */
  constant: 1.0,
} as const;

/**
 * Give a geometry the custom attributes the material system expects.
 *
 * Geometry built through `MeshBuilder` always carries these. Anything built
 * another way — three's parametric geometries, an imported mesh, a debug
 * placeholder — does not, and a missing attribute reads as 0 in WebGL rather
 * than as an error. For `aEdgeDist` that means "on an edge", so the shader
 * treats the entire surface as fully chipped and renders it as bare metal at
 * near-full metalness: a dark, faintly checkered mess that looks like a
 * lighting bug rather than a missing attribute.
 *
 * Rather than leave that as a trap, this fills them in explicitly.
 */
export function ensureProcAttributes(
  geometry: {
    getAttribute(name: string): unknown;
    setAttribute(name: string, attribute: unknown): unknown;
    attributes: Record<string, { count: number }>;
  },
  values: Partial<VertexState> = {},
  makeAttribute: (data: Float32Array, itemSize: number) => unknown = defaultAttributeFactory,
): void {
  const position = geometry.attributes['position'];
  if (!position) throw new Error('ensureProcAttributes: geometry has no position attribute');
  const count = position.count;

  const fill = (name: string, value: number): void => {
    if (geometry.getAttribute(name)) return;
    geometry.setAttribute(name, makeAttribute(new Float32Array(count).fill(value), 1));
  };

  // A large default edge distance means "middle of a plate", which is the safe
  // reading: no chipping, rather than all of it.
  fill(ATTR.edgeDist, values.edgeDist ?? DEFAULT_VERTEX_STATE.edgeDist);
  fill(ATTR.cavity, values.cavity ?? DEFAULT_VERTEX_STATE.cavity);
  fill(ATTR.wear, values.wear ?? DEFAULT_VERTEX_STATE.wear);
  fill(ATTR.region, values.region ?? DEFAULT_VERTEX_STATE.region);
}

/** Names of every attribute a Tiger material reads. */
export const REQUIRED_ATTRIBUTES: readonly string[] = Object.values(ATTR);

/** Which required attributes a geometry is missing. Used by the debug audit. */
export function missingProcAttributes(geometry: {
  getAttribute(name: string): unknown;
}): string[] {
  return REQUIRED_ATTRIBUTES.filter((name) => !geometry.getAttribute(name));
}

let defaultAttributeFactory: (data: Float32Array, itemSize: number) => unknown = () => {
  throw new Error('ensureProcAttributes: no attribute factory registered');
};

/**
 * Registered once at startup with three's BufferAttribute, so this module stays
 * free of a three import and remains testable on plain objects.
 */
export function registerAttributeFactory(
  factory: (data: Float32Array, itemSize: number) => unknown,
): void {
  defaultAttributeFactory = factory;
}
