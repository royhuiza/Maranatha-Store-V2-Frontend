import { AfterViewInit, Component, ElementRef, Input, NgZone, OnDestroy, ViewChild, inject } from '@angular/core';
import { createMeadow } from './originkit-meadow';
import { createLineRipple, createReactiveLines } from './originkit-lines';
import { createRibbons } from './originkit-ribbons';

const scenes = {
  meadow: createMeadow,
  ribbons: createRibbons,
  ripple: createLineRipple,
  reactive: createReactiveLines
};

@Component({
  selector: 'app-originkit-scene',
  standalone: true,
  template: '<canvas #canvas aria-hidden="true"></canvas>',
  styles: [`:host { position:absolute; inset:0; display:block; pointer-events:none; overflow:hidden }
    canvas { display:block; width:100%; height:100% }`]
})
export class OriginkitSceneComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) effect!: keyof typeof scenes;
  @ViewChild('canvas', { static: true }) private canvas!: ElementRef<HTMLCanvasElement>;
  private readonly zone = inject(NgZone);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private startFrame = 0;
  private cleanup?: () => void;

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      this.startFrame = requestAnimationFrame(() => {
        this.startFrame = requestAnimationFrame(() => this.start());
      });
    });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.startFrame);
    this.cleanup?.();
  }

  private start(): void {
    const canvas = this.canvas.nativeElement;
    const surface = this.host.nativeElement.parentElement;
    if (!surface) return;
    const scene = scenes[this.effect](canvas);
    if (!scene) {
      canvas.hidden = true;
      return;
    }
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const frameInterval = this.effect === 'reactive' ? 48 : 32;
    let inView = false;
    let lost = false;
    let frameId = 0;
    let previous = 0;
    let elapsed = 0;
    let x = .5;
    let y = .5;
    let over = 0;
    const animate = (now: number) => {
      if (now - previous >= frameInterval) {
        elapsed += previous ? Math.min((now - previous) / 1000, .08) : 0;
        previous = now;
        scene.draw(elapsed, x, y, over);
      }
      frameId = requestAnimationFrame(animate);
    };
    const refresh = () => {
      cancelAnimationFrame(frameId);
      previous = 0;
      if (lost || document.hidden || !inView) return;
      if (preference.matches) scene.draw(0, .5, .5, 0);
      else frameId = requestAnimationFrame(animate);
    };
    const resize = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (!width || !height) return;
      const meadow = this.effect === 'meadow';
      const tall = meadow || this.effect === 'reactive';
      const scale = Math.min(devicePixelRatio, 1, (meadow ? 1120 : 940) / width, (tall ? 820 : 420) / height);
      const pixelWidth = Math.max(1, Math.round(width * scale));
      const pixelHeight = Math.max(1, Math.round(height * scale));
      if (canvas.width === pixelWidth && canvas.height === pixelHeight) return;
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      refresh();
    });
    const intersection = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      refresh();
    });
    const move = (event: PointerEvent) => {
      const rect = surface.getBoundingClientRect();
      x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
      over = 1;
    };
    const leave = () => { x = y = .5; over = 0; };
    const contextLost = () => { lost = true; canvas.hidden = true; refresh(); };
    resize.observe(this.host.nativeElement);
    intersection.observe(surface);
    surface.addEventListener('pointermove', move, { passive: true });
    surface.addEventListener('pointerleave', leave);
    canvas.addEventListener('webglcontextlost', contextLost);
    preference.addEventListener('change', refresh);
    document.addEventListener('visibilitychange', refresh);
    this.cleanup = () => {
      cancelAnimationFrame(frameId);
      resize.disconnect();
      intersection.disconnect();
      surface.removeEventListener('pointermove', move);
      surface.removeEventListener('pointerleave', leave);
      canvas.removeEventListener('webglcontextlost', contextLost);
      preference.removeEventListener('change', refresh);
      document.removeEventListener('visibilitychange', refresh);
      scene.destroy();
    };
  }
}
