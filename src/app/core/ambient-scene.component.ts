import { Component } from '@angular/core';

@Component({
  selector: 'app-ambient-scene',
  standalone: true,
  template: '<div class="ambient-light" aria-hidden="true"></div>',
  styles: [`
    :host {
      display: block;
      position: absolute;
      inset: 0;
      overflow: hidden;
      pointer-events: none;
      background:
        repeating-radial-gradient(ellipse at 82% 115%, transparent 0 36px, #c6e6ce18 37px 38px),
        radial-gradient(ellipse at 88% 100%, #85bc9d2e, transparent 60%);
      mask-image: linear-gradient(90deg, transparent 12%, #000);
    }
    .ambient-light {
      position: absolute;
      inset: -40% 8% -70% 32%;
      background: radial-gradient(ellipse, #f1bf7845, transparent 68%);
      animation: ambient-drift 9s ease-in-out infinite alternate;
    }
    @keyframes ambient-drift {
      from { transform: translateX(-14%); }
      to { transform: translateX(17%); }
    }
    @media (prefers-reduced-motion: reduce) { .ambient-light { animation: none; } }
  `]
})
export class AmbientSceneComponent {}
