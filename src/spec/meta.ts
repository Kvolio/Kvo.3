/**
 * Provenance for every dimension in the specification.
 *
 * The brief requires that uncertainty be documented rather than invented. Prose
 * cannot enforce that, so this module makes it a type constraint: `MetaOf<T>` is
 * a TOTAL mapping over the numeric leaves of a spec object. Add a dimension to
 * `HULL` and `HULL_META` stops compiling until a source and a tolerance are
 * supplied for it.
 *
 * The dimension tests read the same records, so "is this number sourced?" is
 * asserted mechanically alongside "is this number correct?".
 */

export type Confidence =
  /** Original wartime documentation, technical manuals, engineering drawings. */
  | 'primary'
  /** Specialist historical research or high-quality museum documentation. */
  | 'secondary'
  /** Computed from other spec values; asserted against an independent figure where one exists. */
  | 'derived'
  /**
   * Reconstructed from engineering reasoning because no source documents it.
   * Must be declared as such in the Gauntlet report for the owning subsystem.
   */
  | 'estimated';

export interface Meta {
  /** Acceptable deviation, in the same unit as the value it describes. */
  readonly tol: number;
  /** Source key from docs/RESEARCH.md, or a full citation. */
  readonly source: string;
  readonly confidence: Confidence;
  /** Uncertainty register entry number from docs/UNCERTAINTY.md, if this figure is disputed. */
  readonly uncertainty?: number;
  readonly note?: string;
}

/**
 * A meta tree mirroring the shape of a spec object.
 *
 * Numeric leaves and numeric arrays each require one `Meta`. Nested objects
 * recurse. String and boolean properties are dropped from the mapping, because
 * a designation or a flag has nothing to have a tolerance about.
 */
export type MetaOf<T> = {
  readonly [K in keyof T as T[K] extends number
    ? K
    : T[K] extends readonly number[]
      ? K
      : T[K] extends string | boolean
        ? never
        : T[K] extends object
          ? K
          : never]: T[K] extends number
    ? Meta
    : T[K] extends readonly number[]
      ? Meta
      : MetaOf<T[K]>;
};

/** Narrowing guard used by the meta-totality test to walk a meta tree. */
export function isMeta(v: unknown): v is Meta {
  return (
    typeof v === 'object' &&
    v !== null &&
    'tol' in v &&
    'source' in v &&
    'confidence' in v &&
    typeof (v as Meta).tol === 'number' &&
    typeof (v as Meta).source === 'string'
  );
}

/**
 * Walk a meta tree and yield every `Meta` record with its dotted path.
 * Used by `tests/spec/meta.test.ts` to assert totality and by the debug
 * DimensionOverlay to label measurements on the live model.
 */
export function* walkMeta(
  tree: unknown,
  path: string[] = [],
): Generator<{ path: string; meta: Meta }> {
  if (isMeta(tree)) {
    yield { path: path.join('.'), meta: tree };
    return;
  }
  if (typeof tree === 'object' && tree !== null) {
    for (const [key, value] of Object.entries(tree)) {
      yield* walkMeta(value, [...path, key]);
    }
  }
}

/**
 * Collect every dimension that is reconstructed rather than sourced.
 * Each subsystem's Gauntlet report must list the ones it depends on.
 */
export function estimatedValues(tree: unknown): { path: string; meta: Meta }[] {
  return [...walkMeta(tree)].filter((e) => e.meta.confidence === 'estimated');
}

/** Collect every dimension tied to an open uncertainty-register entry. */
export function disputedValues(tree: unknown): { path: string; meta: Meta }[] {
  return [...walkMeta(tree)].filter((e) => e.meta.uncertainty !== undefined);
}
