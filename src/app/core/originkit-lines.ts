// Lightweight canvas adaptations of Line Ripple Background and Reactive Lines from OriginKit.
const TAU = 2 * Math.PI;

export function createLineRipple(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d');
  if (!context) return undefined;

  return {
    draw(time: number, pointerX: number, pointerY: number, over: number) {
      const { width, height } = canvas;
      const spacing = Math.max(19, width / 43);
      const half = spacing * .33;
      const radius = Math.max(height * .75, 76);
      const pointer = { x: pointerX * width, y: pointerY * height };
      context.clearRect(0, 0, width, height);
      context.lineCap = 'round';
      context.lineWidth = 1.3;

      for (let accent = 0; accent < 2; accent++) {
        context.beginPath();
        for (let column = 0, x = spacing / 2; x < width; column++, x += spacing) {
          for (let row = 0, y = spacing / 2; y < height; row++, y += spacing) {
            if (Number((column + row * 2) % 5 === 0) !== accent) continue;
            const wave = Math.sin(x * .011 + y * .024 - time * 1.8);
            const angle = wave * 1.35 + Math.sin(x * .007 - y * .017 + time) * .65;
            const dx = x - pointer.x;
            const dy = y - pointer.y;
            const influence = over * Math.max(0, 1 - (dx * dx + dy * dy) / (radius * radius));
            const direction = angle + influence * Math.sin(Math.atan2(dy, dx) + TAU / 4 - angle);
            const ux = Math.cos(direction) * half;
            const uy = Math.sin(direction) * half;
            const centerY = y + 3 * wave + dy * influence * .12;
            context.moveTo(x - ux, centerY - uy);
            context.lineTo(x + ux, centerY + uy);
          }
        }
        context.strokeStyle = accent ? '#ecc58d9c' : '#9bd6c49c';
        context.stroke();
      }
    },
    destroy() {}
  };
}

export function createReactiveLines(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d');
  if (!context) return undefined;

  const samples = 30;
  const curve = new Float32Array(samples + 1);
  let focusX = .5;
  let focusY = .5;

  return {
    draw(time: number, pointerX: number, pointerY: number, over: number) {
      const { width, height } = canvas;
      focusX += ((over ? pointerX : .5) - focusX) * .11;
      focusY += ((over ? pointerY : .5) - focusY) * .14;
      const bias = .6 - focusX * .2;
      const count = Math.round(13 + focusY * 14);
      const start = { x: width * 1.08, y: -height * .56 };
      const drift = Math.sin(time * .85) * .07;

      // All the lines use the same bend profile for the current pointer position.
      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        curve[i] = 2 * t ** (1.4 * (1 - bias)) * (1 - t) ** (1.4 * bias);
      }
      context.clearRect(0, 0, width, height);
      context.lineWidth = 1.15;

      for (let accent = 0; accent < 2; accent++) {
        context.beginPath();
        for (let line = 0; line < count; line++) {
          if (Number(line % 5 === 0) !== accent) continue;
          const spread = (line / (count - 1)) ** 2;
          const endX = width * (-.36 + spread * .63);
          const endY = height * (-.24 + spread * 1.85);
          const bendX = width * (.22 + drift + (focusX - .5) * .14);
          const bendY = height * (.64 + (focusY - .5) * .28 - spread * .3);
          context.moveTo(start.x, start.y);
          for (let i = 1; i <= samples; i++) {
            const t = i / samples;
            context.lineTo(start.x + (endX - start.x) * t + bendX * curve[i],
              start.y + (endY - start.y) * t + bendY * curve[i]);
          }
        }
        context.strokeStyle = accent ? '#c18a429c' : '#419b889c';
        context.stroke();
      }
    },
    destroy() {}
  };
}
