import test from 'node:test';
import assert from 'node:assert/strict';
import {
  IDLE_DRIFT_SPEED,
  KEYBOARD_SCROLL_TAP_DELTA,
  MAX_SCROLL_SPEED,
  TOUCH_SCROLL_MULTIPLIER,
  computeAssetLoadPercent,
  computeCameraTilt,
  computeVignetteParams,
  createInitialScrollState,
  createSeededRandom,
  getArrowKeyDirection,
  getTerrainHeight,
  getValleySplinePoints,
  stepVirtualScroll,
  wrapProgress,
} from './valleyMath';

test('wrapProgress normalizes positive and negative values to [0, 1)', () => {
  assert.equal(wrapProgress(0), 0);
  assert.ok(Math.abs(wrapProgress(1.25) - 0.25) < 1e-9);
  assert.ok(Math.abs(wrapProgress(-0.2) - 0.8) < 1e-9);
});

test('getTerrainHeight produces finite elevation and valley walls rise away from path', () => {
  const pts = getValleySplinePoints(85);
  assert.equal(pts.length, 16);
  const p0 = pts[0];
  const floorHeight = getTerrainHeight(p0.x, p0.z);
  const outerSlopeHeight = getTerrainHeight(p0.x * 1.45, p0.z * 1.45);
  assert.equal(Number.isFinite(floorHeight), true);
  assert.equal(Number.isFinite(outerSlopeHeight), true);
  assert.ok(outerSlopeHeight > floorHeight, 'Expected flanking valley slope to rise above path floor');
});

test('stepVirtualScroll applies 20x touch multiplier vs wheel delta', () => {
  const base = createInitialScrollState();
  const afterWheel = stepVirtualScroll(base, { wheelDelta: 10, touchDelta: 0 }, 0.016);
  const afterTouch = stepVirtualScroll(base, { wheelDelta: 0, touchDelta: 10 }, 0.016);
  assert.ok(
    afterTouch.targetVelocity - IDLE_DRIFT_SPEED >
      (afterWheel.targetVelocity - IDLE_DRIFT_SPEED) * (TOUCH_SCROLL_MULTIPLIER - 1),
    'Touch delta should scale with 20x multiplier',
  );
  assert.ok(Math.abs(afterTouch.velocity) <= MAX_SCROLL_SPEED);
});

test('stepVirtualScroll eases flight to a stop when hovering and resumes when unhovering', () => {
  let state = { ...createInitialScrollState(), isHovering: true, velocity: 0.04, targetVelocity: 0.04 };
  for (let i = 0; i < 120; i++) {
    state = stepVirtualScroll(state, { wheelDelta: 0, touchDelta: 0 }, 0.016);
  }
  assert.ok(state.hoverEase > 0.98, 'hoverEase should approach 1');
  assert.ok(Math.abs(state.velocity) < 0.001, 'velocity should ease to near 0 while hovering');

  state = { ...state, isHovering: false };
  for (let i = 0; i < 120; i++) {
    state = stepVirtualScroll(state, { wheelDelta: 0, touchDelta: 0 }, 0.016);
  }
  assert.ok(state.hoverEase < 0.05, 'hoverEase should return toward 0');
  assert.ok(state.velocity > 0.004, 'velocity should resume idle drift');
});

test('computeVignetteParams tightens vignette with higher speed', () => {
  const slow = computeVignetteParams(0);
  const fast = computeVignetteParams(1);
  assert.ok(fast.offset < slow.offset);
  assert.ok(fast.darkness > slow.darkness);
});

test('computeCameraTilt bounds yaw and pitch', () => {
  const tilt = computeCameraTilt(5, -5);
  assert.ok(Math.abs(tilt.yaw) <= 0.12);
  assert.ok(Math.abs(tilt.pitch) <= 0.08);
});

test('createSeededRandom is deterministic', () => {
  const a = createSeededRandom(42);
  const b = createSeededRandom(42);
  assert.equal(a(), b());
  assert.equal(a(), b());
});

test('computeAssetLoadPercent calculates clamped integer percentages', () => {
  assert.equal(computeAssetLoadPercent(0, 100), 0);
  assert.equal(computeAssetLoadPercent(32, 100), 32);
  assert.equal(computeAssetLoadPercent(150, 100), 100);
  assert.equal(computeAssetLoadPercent(-10, 100), 0);
  assert.equal(computeAssetLoadPercent(50, 0), 0);
});

test('getArrowKeyDirection maps arrow keys to forward/backward directions', () => {
  assert.equal(getArrowKeyDirection('ArrowDown'), 1);
  assert.equal(getArrowKeyDirection('ArrowRight'), 1);
  assert.equal(getArrowKeyDirection('ArrowUp'), -1);
  assert.equal(getArrowKeyDirection('ArrowLeft'), -1);
  assert.equal(getArrowKeyDirection('Enter'), 0);

  const base = createInitialScrollState();
  const forward = stepVirtualScroll(
    base,
    { wheelDelta: getArrowKeyDirection('ArrowDown') * KEYBOARD_SCROLL_TAP_DELTA, touchDelta: 0 },
    0.016,
  );
  const backward = stepVirtualScroll(
    base,
    { wheelDelta: getArrowKeyDirection('ArrowUp') * KEYBOARD_SCROLL_TAP_DELTA, touchDelta: 0 },
    0.016,
  );
  assert.ok(forward.velocity > base.velocity);
  assert.ok(backward.velocity < base.velocity);
});
