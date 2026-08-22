import { InstancedMesh, Mesh, type Material, type Object3D, type Scene } from 'three';
import type { MaterialLibrary } from '../materials/MaterialLibrary.js';
import { CollisionFlags, type CollisionWorld } from '../collision/CollisionWorld.js';
import type { BuiltAssembly } from '../parts/hull/index.js';
import { Region } from '../geom/attributes.js';

/**
 * Put a built assembly into the scene and the collision world.
 *
 * Render geometry and collision geometry come from the same builders and the
 * same outlines, so mounting is the one place they meet — and the only place
 * they could be mismatched. Keeping it to a single function means a part cannot
 * quietly appear on screen without also being solid.
 */
export interface MountOptions {
  readonly name?: string;
  readonly castShadow?: boolean;
  readonly receiveShadow?: boolean;
  readonly collisionFlags?: number;
  readonly region?: Region;
}

export interface MountedAssembly {
  readonly mesh: Mesh;
  readonly fasteners: Object3D[];
  readonly triangleCount: number;
  readonly collisionTriangleCount: number;
}

export function mountAssembly(
  scene: Scene,
  world: CollisionWorld,
  materials: MaterialLibrary,
  built: BuiltAssembly,
  opts: MountOptions = {},
): MountedAssembly {
  const name = opts.name ?? built.part.name;

  const { geometry, materials: materialIds } = built.context.render.toGeometry();
  const resolved: Material[] = materials.resolve(materialIds);
  const mesh = new Mesh(geometry, resolved.length === 1 ? resolved[0]! : resolved);
  mesh.name = name;
  mesh.castShadow = opts.castShadow ?? true;
  mesh.receiveShadow = opts.receiveShadow ?? true;
  scene.add(mesh);

  const { geometry: collisionGeometry } = built.context.collision.toGeometry();
  world.addStatic(collisionGeometry, {
    id: name,
    flags: opts.collisionFlags ?? CollisionFlags.Walkable | CollisionFlags.MantleTarget,
    region: opts.region ?? Region.Exterior,
  });

  // Whatever the builders registered, materialised into a handful of instanced
  // meshes rather than thousands of objects.
  const fasteners: Object3D[] = [];
  for (const batch of built.context.fasteners.materialize()) {
    const instanced = new InstancedMesh(
      batch.geometry,
      materials.get('machinedSteel'),
      batch.matrices.length,
    );
    instanced.name = `${name}.${batch.kind}`;
    batch.matrices.forEach((m, i) => instanced.setMatrixAt(i, m));
    instanced.instanceMatrix.needsUpdate = true;
    instanced.castShadow = opts.castShadow ?? true;
    scene.add(instanced);
    fasteners.push(instanced);
  }

  return {
    mesh,
    fasteners,
    triangleCount: geometry.getIndex()!.count / 3,
    collisionTriangleCount: collisionGeometry.getIndex()!.count / 3,
  };
}
