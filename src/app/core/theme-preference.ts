import { ChangeDetectorRef, Injectable, signal } from '@angular/core';

type ThemeTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => {
    ready: Promise<void>;
    finished: Promise<void>;
  };
};

@Injectable({ providedIn: 'root' })
export class ThemePreference {
  private readonly mode = signal(localStorage.getItem('maranatha-ui-mode') === 'dark');
  readonly dark = this.mode.asReadonly();
  private transitioning = false;

  toggle(event: MouseEvent, view: ChangeDetectorRef): void {
    if (this.transitioning) return;
    const update = () => {
      this.mode.update(dark => !dark);
      localStorage.setItem('maranatha-ui-mode', this.dark() ? 'dark' : 'light');
      view.detectChanges();
    };
    const doc: ThemeTransitionDocument = document;
    if (!doc.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      update();
      return;
    }

    const button = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = button.left + button.width / 2;
    const y = button.top + button.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const root = doc.documentElement;
    root.style.setProperty('--theme-reveal-origin', `${x}px ${y}px`);
    root.style.setProperty('--theme-reveal-radius', `${Math.ceil(radius)}px`);
    root.classList.add('theme-reveal');
    this.transitioning = true;
    const transition = doc.startViewTransition(update);
    void transition.ready.catch(() => {});
    const cleanup = () => {
      this.transitioning = false;
      root.classList.remove('theme-reveal');
      root.style.removeProperty('--theme-reveal-origin');
      root.style.removeProperty('--theme-reveal-radius');
    };
    void transition.finished.then(cleanup, cleanup);
  }
}
