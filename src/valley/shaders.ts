export const VALLEY_POINT_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uHover;
  uniform float uAspect;
  uniform float uIsLeaf;
  uniform vec2 uMouse;
  uniform float uMouseActive;

  attribute float aScale;
  attribute float aSpriteIndex;
  attribute float aPhase;
  attribute float aRotation;
  attribute vec3 aColor;
  attribute vec3 aDisperse;

  varying vec3 vColor;
  varying float vSpriteIndex;
  varying float vRotation;
  varying float vMouseGlow;
  varying float vFogDepth;
  varying float vHover;
  varying float vAlpha;

  void main() {
    vColor = aColor;
    vSpriteIndex = aSpriteIndex;
    vRotation = aRotation + sin(uTime * 0.45 + aPhase) * 0.08;
    vHover = uHover;

    // Gentle breeze sway in world space
    vec3 pos = position;
    float sway = sin(uTime * 0.95 + aPhase + pos.x * 0.08 + pos.z * 0.08);
    pos.x += sway * 0.22;
    pos.y += cos(uTime * 0.75 + aPhase * 1.3) * 0.11;

    // Hover transition: flowers lift & disperse outward into floating glowing particles
    float disperseAmt = uHover * uHover * (3.0 - 2.0 * uHover);
    pos += aDisperse * disperseAmt * (1.0 + 0.35 * sin(uTime * 1.2 + aPhase));

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    float dist = max(0.5, -mvPosition.z);
    vFogDepth = dist;

    // Distance-driven blooming:
    // Flowers bloom from small to full size as they approach the camera.
    // Leaves grow in further back to form deep nocturnal foliage.
    float bloomScale = 1.0;
    if (uIsLeaf > 0.5) {
      bloomScale = smoothstep(5.5, 24.0, dist) * (1.0 - smoothstep(88.0, 145.0, dist));
      bloomScale = mix(bloomScale, 0.62, disperseAmt);
    } else {
      float nearFade = smoothstep(1.0, 4.5, dist);
      float approachBloom = 1.0 - smoothstep(16.0, 82.0, dist) * 0.55;
      float farFade = 1.0 - smoothstep(105.0, 160.0, dist);
      bloomScale = nearFade * approachBloom * farFade;
      bloomScale = mix(bloomScale, 0.85, disperseAmt * 0.7);
    }

    vec4 clipPos = projectionMatrix * mvPosition;

    // Screen-space mouse repulsion & proximity glow
    vMouseGlow = 0.0;
    if (clipPos.w > 0.1 && uMouseActive > 0.01) {
      vec2 ndc = clipPos.xy / clipPos.w;
      vec2 diff = ndc - uMouse;
      diff.x *= uAspect;
      float screenDist = length(diff);
      float radius = 0.44;
      if (screenDist < radius) {
        float strength = pow(1.0 - screenDist / radius, 1.75) * uMouseActive;
        vec2 dir = screenDist > 0.0005 ? normalize(diff) : vec2(0.0, 1.0);
        dir.x /= uAspect;
        // Push points away from cursor in screen space
        clipPos.xy += dir * strength * 0.28 * clipPos.w;
        vMouseGlow = strength;
      }
    }

    float hoverSizeScale = mix(1.0, 0.58, disperseAmt);
    float sizeMul = uIsLeaf > 0.5 ? 360.0 : 420.0;
    float baseSize = aScale * (sizeMul / dist) * bloomScale * hoverSizeScale * (1.0 + vMouseGlow * 0.52);
    gl_PointSize = clamp(baseSize * uPixelRatio, 0.0, 260.0);
    gl_Position = clipPos;

    vAlpha = clamp(bloomScale * 1.25, 0.0, 1.0);
  }
`;

export const VALLEY_POINT_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform vec2 uGrid;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform float uIsLeaf;

  varying vec3 vColor;
  varying float vSpriteIndex;
  varying float vRotation;
  varying float vMouseGlow;
  varying float vFogDepth;
  varying float vHover;
  varying float vAlpha;

  void main() {
    if (vAlpha < 0.015) discard;

    // Rotate sprite UVs around center
    vec2 uv = gl_PointCoord - 0.5;
    float c = cos(vRotation);
    float s = sin(vRotation);
    vec2 rotUv = vec2(uv.x * c - uv.y * s, uv.x * s + uv.y * c) + 0.5;

    if (rotUv.x < 0.0 || rotUv.x > 1.0 || rotUv.y < 0.0 || rotUv.y > 1.0) {
      discard;
    }

    // Atlas lookup
    float idx = floor(vSpriteIndex + 0.5);
    float col = mod(idx, uGrid.x);
    float row = floor(idx / uGrid.x);
    // Flip Y for CanvasTexture UV orientation
    vec2 cellUv = vec2(
      (col + rotUv.x) / uGrid.x,
      1.0 - (row + 1.0 - rotUv.y) / uGrid.y
    );

    vec4 tex = texture2D(uAtlas, cellUv);

    // Soft radial aura & hover particle morph
    float radialDist = length(gl_PointCoord - 0.5) * 2.0;
    float orbMask = smoothstep(1.0, 0.05, radialDist);
    float halo = pow(max(0.0, 1.0 - radialDist), 2.4) * (uIsLeaf > 0.5 ? 0.08 : 0.24);
    float baseMask = max(tex.a, halo);
    float hoverMask = mix(baseMask, orbMask * 0.94, vHover * 0.88);
    if (hoverMask < 0.02) discard;

    vec3 baseCol = tex.rgb * vColor * (uIsLeaf > 0.5 ? 1.15 : 1.32);
    // Add subtle bioluminescent center warmth to flowers
    if (uIsLeaf < 0.5) {
      baseCol += vColor * halo * 0.9;
    }
    // Cursor proximity glow + hover particle bioluminescence
    vec3 glowTint = uIsLeaf > 0.5 ? vec3(0.45, 0.88, 0.7) : vec3(1.0, 0.94, 0.8);
    vec3 colOut = mix(baseCol, glowTint * 1.45, vMouseGlow * 0.68 + vHover * 0.35);
    colOut += glowTint * vMouseGlow * 0.55;

    // Exponential depth fog fading cleanly into transparency over background video
    float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);
    float layerAlpha = uIsLeaf > 0.5 ? 0.38 : 0.72;
    float finalAlpha = hoverMask * vAlpha * (1.0 - clamp(fogFactor, 0.0, 1.0)) * layerAlpha;
    gl_FragColor = vec4(colOut, finalAlpha);
  }
`;

export const DUST_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uHover;

  attribute float aScale;
  attribute float aPhase;

  varying float vAlpha;

  void main() {
    vec3 pos = position;
    pos.x += sin(uTime * 0.35 + aPhase) * 1.8;
    pos.y += cos(uTime * 0.28 + aPhase * 1.4) * 1.2 + uHover * 1.5;
    pos.z += sin(uTime * 0.31 + aPhase * 0.8) * 1.8;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    float dist = max(1.0, -mvPosition.z);

    float fade = smoothstep(1.5, 8.0, dist) * (1.0 - smoothstep(55.0, 95.0, dist));
    float twinkle = 0.55 + 0.45 * sin(uTime * 1.6 + aPhase * 3.0);
    vAlpha = fade * twinkle * (0.48 + uHover * 0.35);

    gl_PointSize = clamp(aScale * (110.0 / dist) * uPixelRatio, 1.0, 40.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const DUST_FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D uGlowMap;
  varying float vAlpha;

  void main() {
    vec4 tex = texture2D(uGlowMap, gl_PointCoord);
    float alpha = tex.a * vAlpha;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(tex.rgb * vec3(0.95, 0.92, 0.85), alpha);
  }
`;

/**
 * Post-processing shader combining subtle split-RGB chromatic noise and speed-reactive vignette.
 */
export const VALLEY_POST_FX_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uNoiseAmount: { value: 0.042 },
    uRgbShift: { value: 0.0018 },
    uVignetteOffset: { value: 0.95 },
    uVignetteDarkness: { value: 0.85 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uNoiseAmount;
    uniform float uRgbShift;
    uniform float uVignetteOffset;
    uniform float uVignetteDarkness;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7)) + uTime * 19.3) * 43758.5453123);
    }

    void main() {
      vec2 dir = vUv - 0.5;
      float dist = length(dir);

      // Subtle radial split-RGB chromatic aberration
      vec2 shift = dir * uRgbShift * (0.5 + dist * 1.5);
      float r = texture2D(tDiffuse, vUv + shift).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - shift).b;
      vec3 col = vec3(r, g, b);

      // Split-RGB organic film grain noise
      vec3 grain = vec3(
        hash(vUv * 512.0 + vec2(0.0, 1.7)),
        hash(vUv * 512.0 + vec2(3.1, 0.4)),
        hash(vUv * 512.0 + vec2(5.9, 2.3))
      ) - 0.5;
      col += grain * uNoiseAmount;

      // Dynamic vignette that tightens with speed
      float vig = smoothstep(uVignetteOffset, uVignetteOffset - 0.72, dist * uVignetteDarkness);
      col *= mix(0.22, 1.0, vig);

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,
};
