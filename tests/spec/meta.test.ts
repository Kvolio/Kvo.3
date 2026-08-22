import { describe, expect, it } from 'vitest';
import { SPEC, SPEC_META } from '../../src/spec/index.js';
import { estimatedValues, disputedValues, isMeta, walkMeta } from '../../src/spec/meta.js';

/**
 * Provenance, asserted mechanically.
 *
 * The brief requires uncertainty to be documented rather than invented. That is
 * only enforceable if "does this number have a source?" is a test rather than a
 * promise. `MetaOf<T>` already makes it a compile error to add a dimension
 * without provenance; these tests close the remaining gaps — empty sources,
 * dangling uncertainty references, and silent promotion of a guess to a fact.
 */

/** Every numeric leaf of the spec, as a dotted path. */
function* numericLeaves(node: unknown, path: string[] = []): Generator<string> {
  if (typeof node === 'number') {
    yield path.join('.');
    return;
  }
  if (typeof node === 'string' || typeof node === 'boolean') return;
  if (Array.isArray(node)) {
    yield path.join('.');
    return;
  }
  if (typeof node === 'object' && node !== null) {
    for (const [k, v] of Object.entries(node)) yield* numericLeaves(v, [...path, k]);
  }
}

function metaAt(path: string): unknown {
  let node: unknown = SPEC_META;
  for (const key of path.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[key];
  }
  return node;
}

describe('spec provenance', () => {
  it('gives every dimension in the spec a matching Meta record', () => {
    const missing: string[] = [];
    for (const path of numericLeaves(SPEC)) {
      if (!isMeta(metaAt(path))) missing.push(path);
    }
    expect(missing).toEqual([]);
  });

  it('never leaves a source blank', () => {
    const blank = [...walkMeta(SPEC_META)]
      .filter((e) => e.meta.source.trim().length === 0)
      .map((e) => e.path);
    expect(blank).toEqual([]);
  });

  it('gives every dimension a non-negative tolerance', () => {
    const bad = [...walkMeta(SPEC_META)]
      .filter((e) => !Number.isFinite(e.meta.tol) || e.meta.tol < 0)
      .map((e) => e.path);
    expect(bad).toEqual([]);
  });

  it('points every disputed figure at a real uncertainty-register entry', () => {
    // docs/UNCERTAINTY.md currently runs to twelve entries.
    for (const { path, meta } of disputedValues(SPEC_META)) {
      expect(meta.uncertainty, `${path} cites an uncertainty entry`).toBeGreaterThanOrEqual(1);
      expect(meta.uncertainty, `${path} cites entry <= 12`).toBeLessThanOrEqual(12);
    }
  });

  it('makes every reconstructed figure say so in a note', () => {
    // An estimate without an explanation is indistinguishable from a fact.
    for (const { path, meta } of estimatedValues(SPEC_META)) {
      const explained =
        (meta.note !== undefined && meta.note.trim().length > 0) || meta.uncertainty !== undefined;
      expect(explained, `${path} is estimated but carries no note or register entry`).toBe(true);
    }
  });

  it('keeps the headline dimensions sourced rather than estimated', () => {
    // These are the figures the whole reconstruction is scaled against. If one
    // of them ever degrades to an estimate, that is a finding, not a detail.
    const headline = [
      SPEC_META.overall.length,
      SPEC_META.overall.heightToCupola,
      SPEC_META.overall.groundClearance,
      SPEC_META.track.width,
      SPEC_META.track.pitch,
      SPEC_META.track.linksPerSide,
      SPEC_META.roadWheel.diameter,
      SPEC_META.gun.bore,
      SPEC_META.suspension.stationsPerSide,
      SPEC_META.turret.ring.bearingOuterDiameter,
    ];
    for (const meta of headline) {
      expect(meta.confidence).not.toBe('estimated');
    }
  });

  it('reports what is still reconstructed, so a Gauntlet cannot quietly skip it', () => {
    const estimated = estimatedValues(SPEC_META).map((e) => e.path);
    // Not a pass/fail bar — a visible count that must be declared in each
    // subsystem's Gauntlet report. It should fall as research closes entries.
    expect(estimated.length).toBeGreaterThan(0);
    console.log(`\n  ${estimated.length} reconstructed values pending research:`);
    for (const path of estimated) console.log(`    - ${path}`);
  });
});
