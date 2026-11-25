import * as THREE from 'three';
import {
  KEYBOARD_HOLD_RATE,
  KEYBOARD_SCROLL_TAP_DELTA,
  createInitialScrollState,
  createSeededRandom,
  computeAssetLoadPercent,
  computeCameraTilt,
  damp,
  getArrowKeyDirection,
  getTerrainHeight,
  getValleySplinePoints,
  stepVirtualScroll,
  wrapProgress,
  type ScrollState,
} from './valleyMath';
import {
  createFlowerAtlasTexture,
  createLeafAtlasTexture,
  createLightRayTexture,
  createSoftGlowTexture,
} from './textures';
import {
  DUST_FRAGMENT_SHADER,
  DUST_VERTEX_SHADER,
  VALLEY_POINT_FRAGMENT_SHADER,
  VALLEY_POINT_VERTEX_SHADER,
} from './shaders';
import type { ValleyAudioEngine } from './audio';

const detectSoftwareGl = (): boolean => {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
};

// Reusable scratch objects outside render loop (zero GC)
const _camPos = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _lookMatrix = new THREE.Matrix4();
const _baseQuat = new THREE.Quaternion();
const _tiltQuat = new THREE.Quaternion();
const _tiltEuler = new THREE.Euler(0, 0, 0, 'YXZ');

export interface ValleyEngineOptions {
  container: HTMLElement;
  audio: ValleyAudioEngine;
  onProgress?: (percent: number) => void;
  onLoaded?: () => void;
  onIntroDone?: () => void;
  onScrollStateChange?: (speedNorm: number, hoverEase: number) => void;
}

export class ValleyEngine {
  private container: HTMLElement;
  private canvasContainer: HTMLElement;
  private audio: ValleyAudioEngine;
  private onProgress?: (percent: number) => void;
  private onLoaded?: () => void;
  private onIntroDone?: () => void;
  private onScrollStateChange?: (speedNorm: number, hoverEase: number) => void;

  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  private spline: THREE.CatmullRomCurve3;
  private scrollState: ScrollState = createInitialScrollState();
  private wheelAccumulator = 0;
  private touchAccumulator = 0;
  private keyAccumulator = 0;
  private activeArrowKeys = new Set<string>();
  private lastTouchY: number | null = null;

  private mouseTarget = new THREE.Vector2(0, 0);
  private mouseCurrent = new THREE.Vector2(0, 0);
  private mouseActive = 0;
  private mouseActiveTarget = 0;
  private smoothedYaw = 0;
  private smoothedPitch = 0;

  private flowerMat: THREE.ShaderMaterial | null = null;
  private leafMat: THREE.ShaderMaterial | null = null;
  private dustMat: THREE.ShaderMaterial | null = null;
  private lightRays: { sprite: THREE.Sprite; baseOpacity: number; phase: number; baseX: number; baseZ: number }[] = [];

  private disposables: { dispose: () => void }[] = [];
  private lastFrameTime = performance.now();
  private elapsed = 0;
  private frameId = 0;
  private isDisposed = false;
  private introCalled = false;
  private reducedMotion = false;

  constructor(options: ValleyEngineOptions) {
    this.container = options.container;
    this.canvasContainer =
      (options.container.querySelector('.js-canvas-container') as HTMLElement) || options.container;
    this.audio = options.audio;
    this.onProgress = options.onProgress;
    this.onLoaded = options.onLoaded;
    this.onIntroDone = options.onIntroDone;
    this.onScrollStateChange = options.onScrollStateChange;

    this.reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.isSoftwareGl = detectSoftwareGl();

    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const pixelRatio = this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x000000, 0);

    this.canvasContainer.innerHTML = '';
    this.canvasContainer.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const fogColor = new THREE.Color(0x03050d);

    this.camera = new THREE.PerspectiveCamera(56, width / height, 0.25, 240);

    // Closed camera spline matching valley layout
    const splinePoints = getValleySplinePoints(85).map((p) => new THREE.Vector3(p.x, p.y, p.z));
    this.spline = new THREE.CatmullRomCurve3(splinePoints, true, 'catmullrom', 0.5);

    this.bindEvents();
    void this.loadAssetsAndStart(width, height, pixelRatio, fogColor);
  }

  private yieldFrame(ms: number): Promise<void> {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  private async loadAssetsAndStart(
    width: number,
    height: number,
    pixelRatio: number,
    fogColor: THREE.Color,
  ): Promise<void> {
    const isAutostart =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).has('autostart');
    const stepDelay = isAutostart || this.reducedMotion ? 0 : 45;
    const totalWeight = 100;

    const report = (weight: number) => {
      if (!this.isDisposed) {
        this.onProgress?.(computeAssetLoadPercent(weight, totalWeight));
      }
    };

    report(0);
    await this.yieldFrame(stepDelay);
    if (this.isDisposed) return;

    // Stage 1: Spline & scene preparation
    report(14);
    await this.yieldFrame(stepDelay);
    if (this.isDisposed) return;

    // Stage 2: Procedural botanical sprite atlases
    const flowerAtlas = createFlowerAtlasTexture();
    const leafAtlas = createLeafAtlasTexture();
    this.disposables.push(flowerAtlas, leafAtlas);
    report(36);
    await this.yieldFrame(stepDelay);
    if (this.isDisposed) return;

    // Stage 3: Nocturnal foliage scatter
    this.leafMat = this.createBotanicalPointCloud(
      4800,
      true,
      leafAtlas,
      new THREE.Vector2(2, 2),
      pixelRatio,
      width / height,
      fogColor,
    );
    report(62);
    await this.yieldFrame(stepDelay);
    if (this.isDisposed) return;

    // Stage 4: Luminous meadow flower scatter
    this.flowerMat = this.createBotanicalPointCloud(
      8600,
      false,
      flowerAtlas,
      new THREE.Vector2(4, 2),
      pixelRatio,
      width / height,
      fogColor,
    );
    report(86);
    await this.yieldFrame(stepDelay);
    if (this.isDisposed) return;

    // Stage 5: Dust particles & volumetric light rays
    this.buildDustParticles(pixelRatio);
    this.buildLightRays();

    this.updateCameraTransform(0.016);
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
    this.renderFrame();
    report(100);

    await this.yieldFrame(isAutostart || this.reducedMotion ? 0 : 160);
    if (this.isDisposed) return;

    this.onLoaded?.();

    if (isAutostart || this.reducedMotion) {
      this.introCalled = true;
      this.onIntroDone?.();
    } else {
      window.setTimeout(() => {
        if (!this.isDisposed && !this.introCalled) {
          this.introCalled = true;
          this.onIntroDone?.();
        }
      }, 320);
    }

    this.lastFrameTime = performance.now();
    this.scheduleNextTick();
  }

  private createBotanicalPointCloud(
    count: number,
    isLeaf: boolean,
    atlas: THREE.CanvasTexture,
    grid: THREE.Vector2,
    pixelRatio: number,
    aspect: number,
    fogColor: THREE.Color,
  ): THREE.ShaderMaterial {
    const rand = createSeededRandom(isLeaf ? 202604 : 406202);

    const flowerPalette = [
      new THREE.Color('#f5efe2'), // warm cream
      new THREE.Color('#f8da9e'), // moonlight gold
      new THREE.Color('#cdb9f5'), // twilight lavender
      new THREE.Color('#92b2ff'), // night periwinkle
      new THREE.Color('#f2b2a4'), // warm dusk rose
      new THREE.Color('#9cebd0'), // bioluminescent sage
      new THREE.Color('#fff9ee'), // ivory starlight
    ];

    const leafPalette = [
      new THREE.Color('#234f44'),
      new THREE.Color('#2c6153'),
      new THREE.Color('#1d4140'),
      new THREE.Color('#3b7360'),
    ];

    const positions = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const spriteIndices = new Float32Array(count);
    const phases = new Float32Array(count);
    const rotations = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    const disperses = new Float32Array(count * 3);

    const palette = isLeaf ? leafPalette : flowerPalette;
    const spriteCount = grid.x * grid.y;

    for (let i = 0; i < count; i++) {
      const t = rand();
      const pt = this.spline.getPointAt(t);
      const tangent = this.spline.getTangentAt(t);
      const sideDirX = -tangent.z;
      const sideDirZ = tangent.x;
      const sideLen = Math.hypot(sideDirX, sideDirZ) || 1;
      const nx = sideDirX / sideLen;
      const nz = sideDirZ / sideLen;

      const sideSign = rand() < 0.5 ? -1 : 1;
      const lateralDist = 0.35 + Math.pow(rand(), 0.78) * (isLeaf ? 44 : 40);
      const alongJitter = (rand() - 0.5) * 12;

      const x = pt.x + nx * sideSign * lateralDist + tangent.x * alongJitter;
      const z = pt.z + nz * sideSign * lateralDist + tangent.z * alongJitter;
      const groundY = getTerrainHeight(x, z);
      const stemHeight = isLeaf ? rand() * 0.75 : 0.2 + rand() * 1.65;
      const y = groundY + stemHeight;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      scales[i] = isLeaf ? 0.8 + rand() * 1.45 : 0.62 + Math.pow(rand(), 1.2) * 1.55;
      spriteIndices[i] = Math.floor(rand() * spriteCount);
      phases[i] = rand() * Math.PI * 2;
      rotations[i] = (rand() - 0.5) * (isLeaf ? 0.85 : Math.PI * 2);

      const col = palette[Math.floor(rand() * palette.length)];
      const brightness = isLeaf ? 0.75 + rand() * 0.45 : 0.85 + rand() * 0.5;
      colors[i * 3] = col.r * brightness;
      colors[i * 3 + 1] = col.g * brightness;
      colors[i * 3 + 2] = col.b * brightness;

      const theta = rand() * Math.PI * 2;
      const radial = 4.5 + rand() * 14.0;
      disperses[i * 3] = Math.cos(theta) * radial + nx * sideSign * 4.5;
      disperses[i * 3 + 1] = 2.5 + rand() * 12.0;
      disperses[i * 3 + 2] = Math.sin(theta) * radial;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    geo.setAttribute('aSpriteIndex', new THREE.BufferAttribute(spriteIndices, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geo.setAttribute('aRotation', new THREE.BufferAttribute(rotations, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aDisperse', new THREE.BufferAttribute(disperses, 3));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: pixelRatio },
        uHover: { value: 0 },
        uAspect: { value: aspect },
        uIsLeaf: { value: isLeaf ? 1.0 : 0.0 },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uMouseActive: { value: 0 },
        uAtlas: { value: atlas },
        uGrid: { value: grid },
        uFogColor: { value: fogColor },
        uFogDensity: { value: 0.0085 },
      },
      vertexShader: VALLEY_POINT_VERTEX_SHADER,
      fragmentShader: VALLEY_POINT_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: isLeaf ? THREE.NormalBlending : THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    points.renderOrder = isLeaf ? 1 : 2;
    this.scene.add(points);
    this.disposables.push(geo, mat);
    return mat;
  }

  private buildDustParticles(pixelRatio: number): void {
    const rand = createSeededRandom(99123);
    const count = 800;
    const positions = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const phases = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const t = rand();
      const pt = this.spline.getPointAt(t);
      const spread = 42;
      positions[i * 3] = pt.x + (rand() - 0.5) * spread;
      positions[i * 3 + 1] = pt.y + (rand() - 0.35) * 18;
      positions[i * 3 + 2] = pt.z + (rand() - 0.5) * spread;
      scales[i] = 0.4 + rand() * 1.1;
      phases[i] = rand() * Math.PI * 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

    const glowMap = createSoftGlowTexture();
    this.dustMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: pixelRatio },
        uHover: { value: 0 },
        uGlowMap: { value: glowMap },
      },
      vertexShader: DUST_VERTEX_SHADER,
      fragmentShader: DUST_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const dust = new THREE.Points(geo, this.dustMat);
    dust.frustumCulled = false;
    dust.renderOrder = 3;
    this.scene.add(dust);
    this.disposables.push(geo, this.dustMat, glowMap);
  }

  private buildLightRays(): void {
    const rand = createSeededRandom(7731);
    const rayTex = createLightRayTexture();
    this.disposables.push(rayTex);

    const rayCount = 14;
    for (let i = 0; i < rayCount; i++) {
      const t = i / rayCount;
      const pt = this.spline.getPointAt(t);
      const baseOpacity = 0.06 + rand() * 0.06;
      const mat = new THREE.SpriteMaterial({
        map: rayTex,
        color: i % 2 === 0 ? 0x9ab8ff : 0xf5efe2,
        transparent: true,
        opacity: baseOpacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      mat.rotation = (rand() - 0.5) * 0.35;

      const sprite = new THREE.Sprite(mat);
      const offsetX = (rand() - 0.5) * 28;
      const offsetZ = (rand() - 0.5) * 28;
      sprite.position.set(pt.x + offsetX, pt.y + 11, pt.z + offsetZ);
      sprite.scale.set(16 + rand() * 14, 34 + rand() * 16, 1);
      this.scene.add(sprite);
      this.disposables.push(mat);
      this.lightRays.push({
        sprite,
        baseOpacity,
        phase: rand() * Math.PI * 2,
        baseX: sprite.position.x,
        baseZ: sprite.position.z,
      });
    }
  }

  private onWheel = (e: WheelEvent): void => {
    this.wheelAccumulator += e.deltaY;
  };

  private onTouchStart = (e: TouchEvent): void => {
    if (e.touches.length > 0) {
      this.lastTouchY = e.touches[0].clientY;
    }
  };

  private onTouchMove = (e: TouchEvent): void => {
    if (e.touches.length > 0 && this.lastTouchY !== null) {
      const y = e.touches[0].clientY;
      this.touchAccumulator += this.lastTouchY - y;
      this.lastTouchY = y;
    }
  };

  private onTouchEnd = (): void => {
    this.lastTouchY = null;
  };

  private onPointerMove = (e: PointerEvent): void => {
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    this.mouseTarget.set((e.clientX / w) * 2 - 1, -(e.clientY / h) * 2 + 1);
    this.mouseActiveTarget = 1;
  };

  private onPointerLeave = (): void => {
    this.mouseActiveTarget = 0;
  };

  private onResize = (): void => {
    if (this.isDisposed) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const pixelRatio = this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2);

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height);

    if (this.flowerMat) {
      this.flowerMat.uniforms.uAspect.value = width / height;
      this.flowerMat.uniforms.uPixelRatio.value = pixelRatio;
    }
    if (this.leafMat) {
      this.leafMat.uniforms.uAspect.value = width / height;
      this.leafMat.uniforms.uPixelRatio.value = pixelRatio;
    }
    if (this.dustMat) {
      this.dustMat.uniforms.uPixelRatio.value = pixelRatio;
    }
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    const dir = getArrowKeyDirection(e.key);
    if (dir === 0) return;

    const active = document.activeElement as HTMLElement | null;
    if (
      active &&
      (active.tagName === 'INPUT' ||
        active.tagName === 'TEXTAREA' ||
        active.tagName === 'SELECT' ||
        active.isContentEditable)
    ) {
      return;
    }
    if (document.querySelector('[role="dialog"]')) {
      return;
    }

    e.preventDefault();
    if (!this.activeArrowKeys.has(e.key)) {
      this.activeArrowKeys.add(e.key);
      this.keyAccumulator += dir * KEYBOARD_SCROLL_TAP_DELTA;
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.activeArrowKeys.delete(e.key);
  };

  private onWindowBlur = (): void => {
    this.activeArrowKeys.clear();
  };

  private bindEvents(): void {
    window.addEventListener('wheel', this.onWheel, { passive: true });
    window.addEventListener('touchstart', this.onTouchStart, { passive: true });
    window.addEventListener('touchmove', this.onTouchMove, { passive: true });
    window.addEventListener('touchend', this.onTouchEnd, { passive: true });
    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    window.addEventListener('pointerleave', this.onPointerLeave, { passive: true });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
    window.addEventListener('resize', this.onResize);
  }

  private unbindEvents(): void {
    window.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('touchstart', this.onTouchStart);
    window.removeEventListener('touchmove', this.onTouchMove);
    window.removeEventListener('touchend', this.onTouchEnd);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerleave', this.onPointerLeave);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    window.removeEventListener('resize', this.onResize);
  }

  private updateCameraTransform(dt: number): void {
    const t = this.scrollState.progress;
    const lookT = wrapProgress(t + 0.025);

    this.spline.getPointAt(t, _camPos);
    this.spline.getPointAt(lookT, _lookTarget);

    this.camera.position.copy(_camPos);

    _forward.subVectors(_lookTarget, _camPos).normalize();
    _right.crossVectors(_forward, _up).normalize();
    _lookMatrix.lookAt(_camPos, _lookTarget, _up);
    _baseQuat.setFromRotationMatrix(_lookMatrix);

    // Subtle mouse camera tilt
    const targetTilt = computeCameraTilt(this.mouseCurrent.x, this.mouseCurrent.y);
    this.smoothedYaw = damp(this.smoothedYaw, targetTilt.yaw * this.mouseActive, 4.5, dt);
    this.smoothedPitch = damp(this.smoothedPitch, targetTilt.pitch * this.mouseActive, 4.5, dt);
    _tiltEuler.set(this.smoothedPitch, this.smoothedYaw, 0, 'YXZ');
    _tiltQuat.setFromEuler(_tiltEuler);

    this.camera.quaternion.copy(_baseQuat).multiply(_tiltQuat);
  }

  private stepSimulation(dt: number): void {
    if (!this.reducedMotion) {
      this.elapsed += dt;
    }

    let heldDir = 0;
    this.activeArrowKeys.forEach((key) => {
      heldDir += getArrowKeyDirection(key);
    });
    const clampedHeldDir = Math.max(-1, Math.min(1, heldDir));

    const wheelDelta =
      this.wheelAccumulator + this.keyAccumulator + clampedHeldDir * KEYBOARD_HOLD_RATE * dt;
    const touchDelta = this.touchAccumulator;
    this.wheelAccumulator = 0;
    this.keyAccumulator = 0;
    this.touchAccumulator = 0;

    this.scrollState = stepVirtualScroll(
      this.scrollState,
      { wheelDelta, touchDelta },
      dt,
    );
    this.container.dataset.scrollProgress = this.scrollState.progress.toFixed(4);

    // Smooth mouse coordinates
    this.mouseCurrent.x = damp(this.mouseCurrent.x, this.mouseTarget.x, 8.0, dt);
    this.mouseCurrent.y = damp(this.mouseCurrent.y, this.mouseTarget.y, 8.0, dt);
    this.mouseActive = damp(this.mouseActive, this.mouseActiveTarget, 5.0, dt);

    this.updateCameraTransform(dt);

    // Update shader uniforms
    if (this.flowerMat) {
      this.flowerMat.uniforms.uTime.value = this.elapsed;
      this.flowerMat.uniforms.uHover.value = this.scrollState.hoverEase;
      this.flowerMat.uniforms.uMouse.value.copy(this.mouseCurrent);
      this.flowerMat.uniforms.uMouseActive.value = this.mouseActive;
    }
    if (this.leafMat) {
      this.leafMat.uniforms.uTime.value = this.elapsed;
      this.leafMat.uniforms.uHover.value = this.scrollState.hoverEase;
      this.leafMat.uniforms.uMouse.value.copy(this.mouseCurrent);
      this.leafMat.uniforms.uMouseActive.value = this.mouseActive;
    }

    if (this.dustMat) {
      this.dustMat.uniforms.uTime.value = this.elapsed;
      this.dustMat.uniforms.uHover.value = this.scrollState.hoverEase;
    }

    for (const ray of this.lightRays) {
      ray.sprite.position.x = ray.baseX + Math.sin(this.elapsed * 0.18 + ray.phase) * 2.5;
      ray.sprite.material.opacity =
        ray.baseOpacity * (0.78 + 0.22 * Math.sin(this.elapsed * 0.4 + ray.phase));
    }

    this.onScrollStateChange?.(this.scrollState.vignetteTightness, this.scrollState.hoverEase);
  }

  private renderFrame(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.isDisposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } else {
      this.frameId = window.setTimeout(cb, 80);
    }
  }

  private scheduleNextTick(): void {
    if (this.isDisposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private tick = (): void => {
    if (this.isDisposed) return;
    const now = performance.now();
    const dt = Math.min(Math.max((now - this.lastFrameTime) / 1000, 0.001), 0.05);
    this.lastFrameTime = now;
    this.stepSimulation(dt);
    this.renderFrame();
    this.scheduleNextTick();
  };

  public startHoverTransition(): void {
    this.scrollState.isHovering = true;
    this.audio.setMuffled(true);
  }

  public stopHoverTransition(): void {
    this.scrollState.isHovering = false;
    this.audio.setMuffled(false);
  }

  public getProgress(): number {
    return this.scrollState.progress;
  }

  public dispose(): void {
    this.isDisposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.unbindEvents();
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    this.renderer.dispose();
  }
}
