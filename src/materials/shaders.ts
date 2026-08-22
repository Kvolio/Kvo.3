/**
 * The procedural surface-detail shader chunks.
 *
 * Injected into three's MeshPhysicalMaterial via onBeforeCompile rather than
 * written as a standalone shader, so the model keeps three's full PBR, IBL,
 * shadow and tonemapping pipeline and only overrides albedo, roughness and
 * metalness.
 *
 * The interesting part is what drives the effects. Because every vertex was
 * authored in code, the geometry already knows things a texture would have to
 * guess: how far this point is from a structural edge, how deep a crevice it
 * sits in, and whether a crewman's hands are on it daily. Paint therefore chips
 * where edges actually are, dirt collects where crevices actually are, and grab
 * handles are polished because they were built as grab handles.
 */

export const PROC_DETAIL_PARS_VERTEX = /* glsl */ `
attribute float aEdgeDist;
attribute float aCavity;
attribute float aWear;
attribute float aRegion;

varying float vEdgeDist;
varying float vCavity;
varying float vWear;
varying float vRegion;
varying vec3 vProcWorldPos;
varying vec3 vProcWorldNormal;
`;

export const PROC_DETAIL_VERTEX = /* glsl */ `
vEdgeDist = aEdgeDist;
vCavity = aCavity;
vWear = aWear;
vRegion = aRegion;

vec3 procLocalPos = transformed;
vec3 procLocalNrm = objectNormal;
#ifdef USE_INSTANCING
  procLocalPos = (instanceMatrix * vec4(procLocalPos, 1.0)).xyz;
  procLocalNrm = mat3(instanceMatrix) * procLocalNrm;
#endif
vProcWorldPos = (modelMatrix * vec4(procLocalPos, 1.0)).xyz;
vProcWorldNormal = normalize(mat3(modelMatrix) * procLocalNrm);
`;

export const PROC_DETAIL_PARS_FRAGMENT = /* glsl */ `
uniform sampler2D uNoiseAtlas;
uniform float uNoiseScaleBroad;
uniform float uNoiseScaleFine;

uniform vec3 uPaint;
uniform vec3 uPrimer;
uniform vec3 uBareMetal;
uniform vec3 uRustColour;
uniform vec3 uDirtColour;

uniform float uChipWidth;      // millimetres over which chipping fades in
uniform float uChipAmount;
uniform float uWearChip;
uniform float uPolish;
uniform float uDirt;
uniform float uDust;
uniform float uRust;
uniform float uStreak;

uniform float uBaseRoughness;
uniform float uRoughVariation;
uniform float uBaseMetalness;
uniform float uChipMetalness;

uniform float uDebugMode;      // 0 off, 1 edgeDist, 2 cavity, 3 wear, 4 region

varying float vEdgeDist;
varying float vCavity;
varying float vWear;
varying float vRegion;
varying vec3 vProcWorldPos;
varying vec3 vProcWorldNormal;

// Sample the atlas by projecting from three axes and blending on the normal.
// The power-4 blend weight keeps the seams tight without a visible crossfade.
vec4 procTriplanar(vec3 p, vec3 n, float scale) {
  vec3 blend = pow(abs(n), vec3(4.0));
  blend /= max(blend.x + blend.y + blend.z, 1e-4);
  vec4 xs = texture2D(uNoiseAtlas, p.yz * scale);
  vec4 ys = texture2D(uNoiseAtlas, p.xz * scale);
  vec4 zs = texture2D(uNoiseAtlas, p.xy * scale);
  return xs * blend.x + ys * blend.y + zs * blend.z;
}

struct ProcSurface {
  vec3 albedo;
  float roughness;
  float metalness;
};

ProcSurface computeProcSurface() {
  vec3 n = normalize(vProcWorldNormal);
  vec4 broad = procTriplanar(vProcWorldPos, n, uNoiseScaleBroad);
  vec4 fine = procTriplanar(vProcWorldPos, n, uNoiseScaleFine);

  // Paint fails at edges first, and it fails unevenly: the noise gate is what
  // stops the chipping reading as a uniform outline around every plate.
  float edgeMask = 1.0 - smoothstep(0.0, max(uChipWidth, 0.001), vEdgeDist);
  float chip = edgeMask * uChipAmount * smoothstep(0.35, 0.80, fine.g);
  chip += vWear * uWearChip * smoothstep(0.30, 0.85, broad.g);
  chip = clamp(chip, 0.0, 1.0);

  // Dirt settles in crevices and on surfaces that face the sky.
  float upness = max(0.0, n.y);
  float dirt = clamp(vCavity * uDirt + upness * uDust * broad.r, 0.0, 1.0);

  // Rain streaking runs down vertical surfaces, so it is gated on how vertical
  // this fragment is as well as on the anisotropic channel.
  float verticality = 1.0 - abs(n.y);
  float streak = uStreak * verticality * smoothstep(0.55, 1.0, broad.a);

  float rust = clamp(vCavity * uRust * smoothstep(0.50, 0.92, broad.b), 0.0, 1.0);

  vec3 albedo = uPaint;
  albedo = mix(albedo, uPrimer, smoothstep(0.0, 0.55, chip));
  albedo = mix(albedo, uBareMetal, smoothstep(0.55, 1.0, chip));
  albedo = mix(albedo, uRustColour, rust);
  albedo = mix(albedo, uDirtColour, max(dirt, streak * 0.6));
  // Handled steel burnishes rather than darkening.
  albedo *= 1.0 + vWear * uPolish * 0.35;

  float roughness = uBaseRoughness + (broad.r - 0.5) * uRoughVariation;
  roughness += chip * 0.20 + rust * 0.28 + dirt * 0.14;
  roughness -= vWear * uPolish;
  roughness = clamp(roughness, 0.035, 1.0);

  float metalness = uBaseMetalness + chip * uChipMetalness - dirt * 0.35 - rust * 0.5;
  metalness = clamp(metalness, 0.0, 1.0);

  ProcSurface s;
  s.albedo = albedo;
  s.roughness = roughness;
  s.metalness = metalness;

  if (uDebugMode > 0.5) {
    // Attribute inspection, so a human can see what the shader is being told.
    if (uDebugMode < 1.5) s.albedo = vec3(clamp(vEdgeDist / 60.0, 0.0, 1.0));
    else if (uDebugMode < 2.5) s.albedo = vec3(vCavity, 0.1, 1.0 - vCavity);
    else if (uDebugMode < 3.5) s.albedo = vec3(vWear, vWear * 0.4, 0.0);
    else s.albedo = vec3(fract(vRegion * 0.37), fract(vRegion * 0.61), fract(vRegion * 0.83));
    s.roughness = 0.85;
    s.metalness = 0.0;
  }
  return s;
}
`;

export const PROC_DETAIL_MAP_FRAGMENT = /* glsl */ `
ProcSurface procSurface = computeProcSurface();
diffuseColor.rgb *= procSurface.albedo;
`;

export const PROC_DETAIL_ROUGHNESS_FRAGMENT = /* glsl */ `
roughnessFactor = procSurface.roughness;
`;

export const PROC_DETAIL_METALNESS_FRAGMENT = /* glsl */ `
metalnessFactor = procSurface.metalness;
`;
