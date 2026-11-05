// Glimmer Vale — Originkit. Ridge profiles and interpolation from the supplied reference.
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const RIDGE_A: number[][] = [
    [-0.35, 0.272, 7], [0, 0.339, 7], [0.0625, 0.361, 7], [0.125, 0.387, 7], [0.1875, 0.417, 7],
    [0.25, 0.444, 7], [0.3125, 0.462, 7], [0.375, 0.476, 6.8], [0.44, 0.49, 6.6], [0.5, 0.497, 6.5],
    [0.56, 0.49, 6.6], [0.62, 0.468, 7], [0.68, 0.432, 7.6], [0.75, 0.39, 8.2], [0.8125, 0.368, 8.5],
    [0.875, 0.364, 8.5], [0.9375, 0.371, 8.5], [1.0, 0.38, 8.5], [1.35, 0.4, 8.5],
]
// The far ridge, seen only in the valley: elsewhere it sits below the near
// crest, standing close enough behind it to hide the floor.
const RIDGE_B: number[][] = [
    [-0.35, 0.5, 10.5], [0, 0.492, 10.5], [0.2, 0.482, 11], [0.3, 0.466, 12], [0.375, 0.452, 13],
    [0.4375, 0.437, 13.6], [0.5, 0.416, 14], [0.5625, 0.401, 14], [0.625, 0.398, 13.8],
    [0.6875, 0.394, 13.4], [0.75, 0.4, 13], [0.85, 0.41, 12.5], [1.0, 0.42, 12], [1.35, 0.44, 12],
]
function catmull(pts: number[][], col: number, u: number) {
    const n = pts.length
    const x = clamp(u, pts[0][0], pts[n - 1][0])
    let i = 0
    while (i < n - 2 && x > pts[i + 1][0]) i++
    const p0 = pts[Math.max(i - 1, 0)][col], p1 = pts[i][col], p2 = pts[i + 1][col], p3 = pts[Math.min(i + 2, n - 1)][col]
    const t = (x - pts[i][0]) / (pts[i + 1][0] - pts[i][0])
    return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t)
}

/** Canvas port of the two ridges, crest glitter, and defocused foreground. */
export function createMeadow(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return undefined;
  const columns = 140;
  const profiles = [RIDGE_B, RIDGE_A].map(ridge =>
    Array.from({ length: columns + 1 }, (_, index) => catmull(ridge, 1, index / columns))
  );
  let seed = 7;
  const random = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const scatter = Array.from({ length: 4600 }, () => ({
    column: Math.floor(random() * columns),
    offset: random() ** 2.2,
    size: .4 + random() * 1.7,
    phase: random() * Math.PI * 2,
    warm: random() > .55
  }));
  const foreground = Array.from({ length: 40 }, () => ({
    x: random(),
    y: .65 + .36 * random(),
    radius: .007 + random() * .028,
    warm: random() > .46
  }));

  return {
    draw(time: number, pointerX: number, pointerY: number) {
      const width = canvas.width;
      const height = canvas.height;
      const sky = context.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, '#0b2329');
      sky.addColorStop(.43, '#34645a');
      sky.addColorStop(1, '#0a1d20');
      context.fillStyle = sky;
      context.fillRect(0, 0, width, height);

      profiles.forEach((profile, layer) => {
        const crest = (column: number) =>
          (.34 + profile[column] * .64 + .018 * Math.sin(column * .048 - time * .52 + layer)) * height;
        const offset = (pointerX - .5) * width * .021 * (layer + 1);
        const ground = context.createLinearGradient(0, height * .53, 0, height);
        ground.addColorStop(0, layer ? '#254b43' : '#3b6858');
        ground.addColorStop(1, '#0b2024');
        context.fillStyle = ground;
        context.beginPath();
        context.moveTo(-32, height);
        for (let column = 0; column <= columns; column++) {
          context.lineTo((column / columns) * (width + 64) - 32 + offset, crest(column));
        }
        context.lineTo(width + 32 + offset, height);
        context.fill();

        for (let i = layer; i < scatter.length; i += 2) {
          const dot = scatter[i];
          const flicker = .68 + .32 * Math.sin(dot.phase + time * .75);
          context.globalAlpha = (1 - dot.offset) ** 2 * flicker * (layer ? .88 : .62);
          context.fillStyle = dot.warm ? '#f6cd8c' : '#9fd9bf';
          const x = dot.column / columns * (width + 64) - 32 + offset + Math.sin(dot.phase) * 5;
          const y = crest(dot.column) + dot.offset * height * .48;
          context.fillRect(x, y, dot.size, dot.size);
        }
        context.globalAlpha = 1;
      });

      for (const light of foreground) {
        const x = (light.x + (pointerX - .5) * .025) * width;
        const y = (light.y + (pointerY - .5) * .015) * height;
        const radius = light.radius * Math.min(width, height);
        const glow = context.createRadialGradient(x, y, 0, x, y, radius);
        glow.addColorStop(0, light.warm ? '#f4c48d82' : '#9ed5a87a');
        glow.addColorStop(1, '#b5dec000');
        context.fillStyle = glow;
        context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      }
    },
    destroy() {}
  };
}
