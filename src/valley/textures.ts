import * as THREE from 'three';

/**
 * Generates a 4x2 sprite sheet of 8 luminous nocturnal botanical flowers.
 * Each cell is 256x256 on a 1024x512 canvas with clean alpha transparency.
 */
export function createFlowerAtlasTexture(): THREE.CanvasTexture {
  const cols = 4;
  const rows = 2;
  const cell = 256;
  const canvas = document.createElement('canvas');
  canvas.width = cols * cell;
  canvas.height = rows * cell;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const drawCell = (index: number, drawer: (cx: number, cy: number, r: number) => void) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const cx = col * cell + cell * 0.5;
    const cy = row * cell + cell * 0.5;
    ctx.save();
    ctx.beginPath();
    ctx.rect(col * cell, row * cell, cell, cell);
    ctx.clip();
    drawer(cx, cy, cell * 0.41);
    ctx.restore();
  };

  const drawGlowCore = (cx: number, cy: number, radius: number, coreAlpha = 0.95) => {
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0, `rgba(255, 252, 240, ${coreAlpha})`);
    grad.addColorStop(0.28, `rgba(255, 240, 205, ${coreAlpha * 0.72})`);
    grad.addColorStop(0.62, `rgba(235, 220, 255, ${coreAlpha * 0.24})`);
    grad.addColorStop(1, 'rgba(210, 200, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawPetal = (
    cx: number,
    cy: number,
    angle: number,
    length: number,
    width: number,
    innerAlpha = 0.95,
    outerAlpha = 0.34,
  ) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    const grad = ctx.createRadialGradient(0, -length * 0.42, length * 0.04, 0, -length * 0.48, length * 0.65);
    grad.addColorStop(0, `rgba(255, 255, 255, ${innerAlpha})`);
    grad.addColorStop(0.6, `rgba(246, 244, 255, ${innerAlpha * 0.8})`);
    grad.addColorStop(1, `rgba(220, 225, 255, ${outerAlpha})`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-width, -length * 0.35, -width * 0.72, -length * 0.92, 0, -length);
    ctx.bezierCurveTo(width * 0.72, -length * 0.92, width, -length * 0.35, 0, 0);
    ctx.fill();
    ctx.restore();
  };

  // 0: Five-petal Night Anemone
  drawCell(0, (cx, cy, r) => {
    drawGlowCore(cx, cy, r * 0.92, 0.32);
    for (let i = 0; i < 5; i++) {
      drawPetal(cx, cy, (i / 5) * Math.PI * 2 - 0.15, r * 0.92, r * 0.44, 0.94, 0.18);
    }
    drawGlowCore(cx, cy, r * 0.26, 0.98);
  });

  // 1: Delicate Star Lily (6 slender pointed petals)
  drawCell(1, (cx, cy, r) => {
    drawGlowCore(cx, cy, r * 0.9, 0.28);
    for (let i = 0; i < 6; i++) {
      drawPetal(cx, cy, (i / 6) * Math.PI * 2, r * 0.96, r * 0.25, 0.96, 0.12);
    }
    drawGlowCore(cx, cy, r * 0.22, 1.0);
  });

  // 2: Layered Night Lotus (8 inner + 8 outer petals)
  drawCell(2, (cx, cy, r) => {
    drawGlowCore(cx, cy, r * 0.96, 0.35);
    for (let i = 0; i < 8; i++) {
      drawPetal(cx, cy, (i / 8) * Math.PI * 2, r * 0.95, r * 0.32, 0.8, 0.14);
    }
    for (let i = 0; i < 8; i++) {
      drawPetal(cx, cy, ((i + 0.5) / 8) * Math.PI * 2, r * 0.68, r * 0.26, 0.95, 0.28);
    }
    drawGlowCore(cx, cy, r * 0.28, 0.95);
  });

  // 3: Wild Cosmos (8 notched petals)
  drawCell(3, (cx, cy, r) => {
    drawGlowCore(cx, cy, r * 0.85, 0.26);
    for (let i = 0; i < 8; i++) {
      drawPetal(cx, cy, (i / 8) * Math.PI * 2 + 0.2, r * 0.9, r * 0.29, 0.9, 0.16);
    }
    drawGlowCore(cx, cy, r * 0.25, 0.98);
  });

  // 4: Four-petal Moonflower
  drawCell(4, (cx, cy, r) => {
    drawGlowCore(cx, cy, r * 0.95, 0.3);
    for (let i = 0; i < 4; i++) {
      drawPetal(cx, cy, (i / 4) * Math.PI * 2 + Math.PI / 4, r * 0.94, r * 0.55, 0.92, 0.14);
    }
    drawGlowCore(cx, cy, r * 0.24, 0.96);
  });

  // 5: Delicate Bioluminescent Bell / Orchid Cluster
  drawCell(5, (cx, cy, r) => {
    drawGlowCore(cx, cy, r * 0.9, 0.32);
    for (let i = 0; i < 3; i++) {
      drawPetal(cx, cy, (i / 3) * Math.PI * 2, r * 0.95, r * 0.38, 0.92, 0.16);
    }
    for (let i = 0; i < 3; i++) {
      drawPetal(cx, cy, ((i + 0.5) / 3) * Math.PI * 2, r * 0.72, r * 0.32, 0.95, 0.24);
    }
    drawGlowCore(cx, cy, r * 0.24, 1.0);
  });

  // 6: Wild Meadow Daisy (12 fine petals)
  drawCell(6, (cx, cy, r) => {
    drawGlowCore(cx, cy, r * 0.85, 0.24);
    for (let i = 0; i < 12; i++) {
      drawPetal(cx, cy, (i / 12) * Math.PI * 2, r * 0.92, r * 0.18, 0.9, 0.15);
    }
    drawGlowCore(cx, cy, r * 0.27, 1.0);
  });

  // 7: Soft Radiant Blossom Bud / Pollen Cluster
  drawCell(7, (cx, cy, r) => {
    drawGlowCore(cx, cy, r * 0.98, 0.55);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      drawGlowCore(cx + Math.cos(a) * r * 0.32, cy + Math.sin(a) * r * 0.32, r * 0.36, 0.72);
    }
    drawGlowCore(cx, cy, r * 0.34, 1.0);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates a 2x2 sprite sheet of 4 nocturnal fern & botanical leaf silhouettes.
 */
export function createLeafAtlasTexture(): THREE.CanvasTexture {
  const cols = 2;
  const rows = 2;
  const cell = 256;
  const canvas = document.createElement('canvas');
  canvas.width = cols * cell;
  canvas.height = rows * cell;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const drawLeafCell = (index: number, drawer: (cx: number, cy: number, r: number) => void) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const cx = col * cell + cell * 0.5;
    const cy = row * cell + cell * 0.5;
    ctx.save();
    ctx.beginPath();
    ctx.rect(col * cell, row * cell, cell, cell);
    ctx.clip();
    drawer(cx, cy, cell * 0.42);
    ctx.restore();
  };

  // 0: Broad botanical leaf
  drawLeafCell(0, (cx, cy, r) => {
    const grad = ctx.createLinearGradient(cx, cy + r, cx, cy - r);
    grad.addColorStop(0, 'rgba(130, 175, 160, 0.55)');
    grad.addColorStop(0.5, 'rgba(195, 230, 210, 0.85)');
    grad.addColorStop(1, 'rgba(225, 245, 230, 0.35)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx, cy + r * 0.9);
    ctx.bezierCurveTo(cx - r * 0.65, cy + r * 0.3, cx - r * 0.55, cy - r * 0.5, cx, cy - r * 0.95);
    ctx.bezierCurveTo(cx + r * 0.55, cy - r * 0.5, cx + r * 0.65, cy + r * 0.3, cx, cy + r * 0.9);
    ctx.fill();
  });

  // 1: Slender blade cluster
  drawLeafCell(1, (cx, cy, r) => {
    for (let i = -1; i <= 1; i++) {
      ctx.save();
      ctx.translate(cx, cy + r * 0.75);
      ctx.rotate(i * 0.34);
      const grad = ctx.createLinearGradient(0, 0, 0, -r * 1.6);
      grad.addColorStop(0, 'rgba(120, 165, 150, 0.65)');
      grad.addColorStop(1, 'rgba(215, 240, 225, 0.4)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-r * 0.22, -r * 0.8, 0, -r * 1.65);
      ctx.quadraticCurveTo(r * 0.22, -r * 0.8, 0, 0);
      ctx.fill();
      ctx.restore();
    }
  });

  // 2: Fern frond
  drawLeafCell(2, (cx, cy, r) => {
    ctx.fillStyle = 'rgba(195, 230, 212, 0.82)';
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const y = cy + r * 0.75 - t * r * 1.45;
      const span = r * 0.52 * (1 - t * 0.7);
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(cx + dir * span * 0.55, y, span * 0.55, r * 0.09, dir * -0.35, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });

  // 3: Soft mossy rosette
  drawLeafCell(3, (cx, cy, r) => {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      const grad = ctx.createRadialGradient(0, -r * 0.4, 2, 0, -r * 0.4, r * 0.55);
      grad.addColorStop(0, 'rgba(205, 235, 220, 0.85)');
      grad.addColorStop(1, 'rgba(110, 155, 145, 0.1)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.45, r * 0.24, r * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates a soft bokeh glow texture for atmospheric dust & dispersed pollen particles.
 */
export function createSoftGlowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255, 252, 240, 1)');
  grad.addColorStop(0.28, 'rgba(245, 239, 226, 0.72)');
  grad.addColorStop(0.65, 'rgba(180, 210, 235, 0.22)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates a soft diagonal/vertical atmospheric light-ray sprite texture.
 */
export function createLightRayTexture(): THREE.CanvasTexture {
  const width = 256;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const horiz = ctx.createLinearGradient(0, 0, width, 0);
  horiz.addColorStop(0, 'rgba(200, 220, 255, 0)');
  horiz.addColorStop(0.35, 'rgba(215, 230, 255, 0.25)');
  horiz.addColorStop(0.5, 'rgba(245, 239, 226, 0.45)');
  horiz.addColorStop(0.65, 'rgba(215, 230, 255, 0.25)');
  horiz.addColorStop(1, 'rgba(200, 220, 255, 0)');

  ctx.fillStyle = horiz;
  ctx.fillRect(0, 0, width, height);

  ctx.globalCompositeOperation = 'destination-in';
  const vert = ctx.createLinearGradient(0, 0, 0, height);
  vert.addColorStop(0, 'rgba(255, 255, 255, 0)');
  vert.addColorStop(0.2, 'rgba(255, 255, 255, 0.9)');
  vert.addColorStop(0.75, 'rgba(255, 255, 255, 0.5)');
  vert.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = vert;
  ctx.fillRect(0, 0, width, height);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
