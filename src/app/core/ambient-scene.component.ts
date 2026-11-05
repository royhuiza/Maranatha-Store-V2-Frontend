import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild, inject } from '@angular/core';

/** Original procedural scenery; no external scenes, trackers or video downloads. */
@Component({
  selector: 'app-ambient-scene', standalone: true,
  template: `<canvas #field aria-hidden="true"></canvas><div class="ambient-halo" aria-hidden="true"></div>`,
  styles: [`:host{display:block;position:absolute;inset:0;overflow:hidden;pointer-events:none}canvas{width:100%;height:100%;opacity:.62}.ambient-halo{position:absolute;width:65%;aspect-ratio:1;border:1px solid #d6a15d25;border-radius:50%;left:10%;top:15%;box-shadow:0 0 100px #5fafa018,inset 0 0 100px #d6a15d08}`]
})
export class AmbientSceneComponent implements AfterViewInit, OnDestroy {
  @ViewChild('field', {static:true}) field!:ElementRef<HTMLCanvasElement>;
  private zone=inject(NgZone); private frame=0; private observer?:ResizeObserver;
  private media=matchMedia('(prefers-reduced-motion: reduce)');
  private visible=true; private width=1; private height=1; private phase=0; private last=0;
  private draw=()=>{};
  private visibility=()=>{this.visible=!document.hidden;this.restart();};
  private restart=()=>{cancelAnimationFrame(this.frame);this.last=0;if(this.visible)this.draw();};
  ngAfterViewInit(){this.zone.runOutsideAngular(()=>{
    const canvas=this.field.nativeElement,ctx=canvas.getContext('2d');if(!ctx)return;
    this.draw=()=>{const now=performance.now();
      if(now-this.last>32 || this.media.matches){
        this.last=now;this.phase+=this.media.matches?0:.005;
        ctx.clearRect(0,0,this.width,this.height);
        // Perspective-projected ribbon of points: near rows spread and brighten.
        for(let row=0;row<26;row++)for(let col=0;col<48;col++){
          const depth=(row+1)/26,x=(col/47-.5)*2;
          const px=this.width*(.5+x*(.15+depth*.65));
          const wave=Math.sin(x*4+this.phase+row*.12)*.055;
          const py=this.height*(.39+depth*depth*.63+wave*depth);
          ctx.fillStyle=col%5===0?`rgba(222,178,111,${.18+depth*.45})`:`rgba(100,176,160,${.1+depth*.35})`;
          ctx.beginPath();ctx.arc(px,py,.5+depth*1.25,0,Math.PI*2);ctx.fill();
        }
      }
      if(!this.media.matches && this.visible)this.frame=requestAnimationFrame(this.draw);
    };
    this.observer=new ResizeObserver(entries=>{const r=entries[0].contentRect;this.width=r.width;this.height=r.height;const d=Math.min(devicePixelRatio,1.5);canvas.width=r.width*d;canvas.height=r.height*d;ctx.setTransform(d,0,0,d,0,0);this.restart();});
    this.observer.observe(canvas);document.addEventListener('visibilitychange',this.visibility);this.media.addEventListener('change',this.restart);
  });}
  ngOnDestroy(){cancelAnimationFrame(this.frame);this.observer?.disconnect();document.removeEventListener('visibilitychange',this.visibility);this.media.removeEventListener('change',this.restart);}
}
