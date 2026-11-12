export class LoginCountdown {
  private timer?:ReturnType<typeof setInterval>;
  constructor(private readonly update:(seconds:number)=>void,private readonly done:()=>void){}
  start():void {
    this.cancel();const deadline=Date.now()+3000;this.update(3);
    this.timer=setInterval(()=>{const seconds=Math.max(0,Math.ceil((deadline-Date.now())/1000));this.update(seconds);if(seconds===0){this.cancel();this.done();}},100);
  }
  cancel():void {if(this.timer!==undefined){clearInterval(this.timer);this.timer=undefined;}}
}
