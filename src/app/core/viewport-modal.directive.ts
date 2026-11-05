import { AfterViewInit, Directive, ElementRef, EventEmitter, HostListener, Input, OnDestroy, Output, inject } from '@angular/core';

/** Native top layer keeps the dialog centered even inside animated route containers. */
@Directive({ selector: 'dialog[viewportModal]', standalone: true })
export class ViewportModalDirective implements AfterViewInit, OnDestroy {
  private readonly dialog = inject(ElementRef<HTMLDialogElement>).nativeElement;
  @Input() modalBusy = false;
  @Output() modalDismiss = new EventEmitter<void>();
  ngAfterViewInit(): void { if (!this.dialog.open) this.dialog.showModal(); }
  @HostListener('cancel', ['$event']) cancel(event: Event): void {
    event.preventDefault();
    if (!this.modalBusy) this.modalDismiss.emit();
  }
  ngOnDestroy(): void { if (this.dialog.open) this.dialog.close(); }
}
