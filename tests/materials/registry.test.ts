import { describe, expect, it } from 'vitest';
import { buildAssembly, buildHull } from '../../src/parts/hull/index.js';
import { MATERIAL_PRESETS } from '../../src/materials/presets.js';

/**
 * Every material the hull asks for must exist.
 *
 * `MaterialId` used to be `string`, so a misspelling fell through to the
 * magenta fallback and rendered as a bright pink track guard that no test
 * failed on. The type now catches it at compile time; this catches anything
 * that reaches the builder as a computed or widened string, which the type
 * cannot see.
 */
describe('material registry', () => {
  it('resolves every material the hull uses', () => {
    const { materials } = buildAssembly(buildHull).context.render.toGeometry();
    const known = new Set(Object.keys(MATERIAL_PRESETS));
    const missing = [...new Set(materials)].filter((id) => !known.has(id));
    expect(missing, `unknown material ids: ${missing.join(', ')}`).toEqual([]);
  });

  it('does not fall back to the debug material anywhere', () => {
    const { materials } = buildAssembly(buildHull).context.render.toGeometry();
    expect(materials).not.toContain('default');
  });
});
