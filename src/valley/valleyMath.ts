export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface ScrollState {
  progress: number;
  velocity: number;
  targetVelocity: number;
  hoverEase: number;
  isHovering: boolean;
  vignetteTightness: number;
}

export interface ScrollInput {
  wheelDelta: number;
  touchDelta: number;
}

export const TOUCH_SCROLL_MULTIPLIER = 20;
export const IDLE_DRIFT_SPEED = 0.0055;
export const MAX_SCROLL_SPEED = 0.085;

export function createSeededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function wrapProgress(t: number): number {
  const mod = t % 1;
  return mod < 0 ? mod + 1 : mod;
}

/**
 * Generates closed-loop spline waypoints winding gracefully through the night valley.
 */
export function getValleySplinePoints(radius = 85): Vec3[] {
  const count = 16;
  const pts: Vec3[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    // Organic figure-like meandering loop with gentle elevation waves
    const radialMod = 1 + 0.24 * Math.sin(angle * 2) + 0.11 * Math.cos(angle * 3);
    const r = radius * radialMod;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r * 0.88;
    const y = 3.2 + Math.sin(angle * 3 + 0.5) * 1.45 + Math.cos(angle * 2) * 0.7;
    pts.push({ x, y, z });
  }
  return pts;
}

/**
 * Continuous terrain heightmap for the night valley.
 * Forms a gently depressed valley channel around the camera path with rising floral hills flanking it.
 */
export function getTerrainHeight(x: number, z: number): number {
  const distFromCenter = Math.hypot(x, z / 0.88);
  const angle = Math.atan2(z / 0.88, x);
  const idealRadius = 85 * (1 + 0.24 * Math.sin(angle * 2) + 0.11 * Math.cos(angle * 3));
  const distFromPath = Math.abs(distFromCenter - idealRadius);

  // Rolling hills rise naturally away from the path centerline
  const valleyWalls = Math.pow(clamp(distFromPath / 26, 0, 2.2), 1.55) * 7.5;
  const undulation =
    Math.sin(x * 0.045) * Math.cos(z * 0.045) * 2.2 +
    Math.sin(x * 0.11 + z * 0.08) * 0.85 +
    Math.cos(x * 0.022 - z * 0.03) * 1.4;

  const pathElevation = Math.sin(angle * 3 + 0.5) * 1.45 + Math.cos(angle * 2) * 0.7;
  return pathElevation - 1.35 + valleyWalls + undulation * 0.55;
}

export function createInitialScrollState(): ScrollState {
  return {
    progress: 0,
    velocity: IDLE_DRIFT_SPEED,
    targetVelocity: IDLE_DRIFT_SPEED,
    hoverEase: 0,
    isHovering: false,
    vignetteTightness: 0,
  };
}

export function stepVirtualScroll(
  state: ScrollState,
  input: ScrollInput,
  dt: number,
): ScrollState {
  const safeDt = clamp(dt, 0.0001, 0.1);
  const wheelImpulse = input.wheelDelta * 0.000045;
  const touchImpulse = input.touchDelta * 0.000045 * TOUCH_SCROLL_MULTIPLIER;
  const combinedImpulse = wheelImpulse + touchImpulse;

  let targetVelocity = state.targetVelocity + combinedImpulse;
  // Decay targetVelocity back toward idle forward drift
  targetVelocity = damp(targetVelocity, IDLE_DRIFT_SPEED, 3.2, safeDt);
  targetVelocity = clamp(targetVelocity, -MAX_SCROLL_SPEED, MAX_SCROLL_SPEED);

  const hoverTarget = state.isHovering ? 1 : 0;
  const hoverEase = damp(state.hoverEase, hoverTarget, state.isHovering ? 2.8 : 2.2, safeDt);

  // Ease flight velocity toward 0 while hovering
  const effectiveTarget = targetVelocity * (1 - hoverEase);
  const velocity = damp(state.velocity, effectiveTarget, 5.5, safeDt);

  const progress = wrapProgress(state.progress + velocity * safeDt);
  const speedNorm = clamp(Math.abs(velocity) / MAX_SCROLL_SPEED, 0, 1);
  const vignetteTightness = damp(state.vignetteTightness, speedNorm, 6.0, safeDt);

  return {
    progress,
    velocity,
    targetVelocity,
    hoverEase,
    isHovering: state.isHovering,
    vignetteTightness,
  };
}

export function computeCameraTilt(mouseNdcX: number, mouseNdcY: number): {
  yaw: number;
  pitch: number;
} {
  const x = clamp(mouseNdcX, -1, 1);
  const y = clamp(mouseNdcY, -1, 1);
  return {
    yaw: -x * 0.11,
    pitch: y * 0.075,
  };
}

export function computeVignetteParams(tightness: number): {
  offset: number;
  darkness: number;
} {
  const t = clamp(tightness, 0, 1);
  return {
    offset: lerp(0.95, 0.62, t),
    darkness: lerp(0.85, 1.45, t),
  };
}

export const KEYBOARD_SCROLL_TAP_DELTA = 320;
export const KEYBOARD_HOLD_RATE = 1100;

export function getArrowKeyDirection(key: string): -1 | 0 | 1 {
  if (key === 'ArrowDown' || key === 'ArrowRight') return 1;
  if (key === 'ArrowUp' || key === 'ArrowLeft') return -1;
  return 0;
}

export function computeAssetLoadPercent(completedWeight: number, totalWeight: number): number {
  if (!Number.isFinite(completedWeight) || !Number.isFinite(totalWeight) || totalWeight <= 0) {
    return 0;
  }
  return Math.round(clamp((completedWeight / totalWeight) * 100, 0, 100));
}
