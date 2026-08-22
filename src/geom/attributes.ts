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
