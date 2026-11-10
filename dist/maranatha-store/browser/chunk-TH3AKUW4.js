import{Aa as j,D as k,F as D,U as _,c as F,ea as B,i as L,k as T,ma as H,na as X,oa as G}from"./chunk-WABLOCAC.js";var nt=(()=>{class o{constructor(){this.mode=_(localStorage.getItem("maranatha-ui-mode")==="dark"),this.dark=this.mode.asReadonly(),this.transitioning=!1}toggle(n,r){if(this.transitioning)return;let u=()=>{this.mode.update(f=>!f),localStorage.setItem("maranatha-ui-mode",this.dark()?"dark":"light"),r.detectChanges()},e=document;if(!e.startViewTransition||matchMedia("(prefers-reduced-motion: reduce)").matches){u();return}let s=n.currentTarget.getBoundingClientRect(),p=s.left+s.width/2,h=s.top+s.height/2,x=Math.hypot(Math.max(p,innerWidth-p),Math.max(h,innerHeight-h)),c=e.documentElement;c.style.setProperty("--theme-reveal-origin",`${p}px ${h}px`),c.style.setProperty("--theme-reveal-radius",`${Math.ceil(x)}px`),c.classList.add("theme-reveal"),this.transitioning=!0;let v=e.startViewTransition(u);v.ready.catch(()=>{});let d=()=>{this.transitioning=!1,c.classList.remove("theme-reveal"),c.style.removeProperty("--theme-reveal-origin"),c.style.removeProperty("--theme-reveal-radius")};v.finished.then(d,d)}static{this.\u0275fac=function(r){return new(r||o)}}static{this.\u0275prov=F({token:o,factory:o.\u0275fac,providedIn:"root"})}}return o})();var N=(o,t,n)=>Math.min(n,Math.max(t,o)),Y=[[-.35,.272,7],[0,.339,7],[.0625,.361,7],[.125,.387,7],[.1875,.417,7],[.25,.444,7],[.3125,.462,7],[.375,.476,6.8],[.44,.49,6.6],[.5,.497,6.5],[.56,.49,6.6],[.62,.468,7],[.68,.432,7.6],[.75,.39,8.2],[.8125,.368,8.5],[.875,.364,8.5],[.9375,.371,8.5],[1,.38,8.5],[1.35,.4,8.5]],Q=[[-.35,.5,10.5],[0,.492,10.5],[.2,.482,11],[.3,.466,12],[.375,.452,13],[.4375,.437,13.6],[.5,.416,14],[.5625,.401,14],[.625,.398,13.8],[.6875,.394,13.4],[.75,.4,13],[.85,.41,12.5],[1,.42,12],[1.35,.44,12]];function U(o,t,n){let r=o.length,u=N(n,o[0][0],o[r-1][0]),e=0;for(;e<r-2&&u>o[e+1][0];)e++;let s=o[Math.max(e-1,0)][t],p=o[e][t],h=o[e+1][t],x=o[Math.min(e+2,r-1)][t],c=(u-o[e][0])/(o[e+1][0]-o[e][0]);return .5*(2*p+(-s+h)*c+(2*s-5*p+4*h-x)*c*c+(-s+3*p-3*h+x)*c*c*c)}function O(o){let t=o.getContext("2d",{alpha:!1});if(!t)return;let n=140,r=[Q,Y].map(f=>Array.from({length:n+1},(i,w)=>U(f,1,w/n))),u=7,e=()=>(u=Math.imul(1664525,u)+1013904223>>>0,u/4294967296),s=Array.from({length:3200},()=>{let f=Math.floor(e()*n),i=e()**2.2,w=.4+e()*1.7,a=e()*Math.PI*2;return{column:f,offset:i,size:w,phase:a,jitter:Math.sin(a)*5,opacity:(1-i)**2,color:e()>.55?"#f6cd8c":"#9fd9bf"}}),p=Array.from({length:32},()=>({x:e(),y:.65+.36*e(),radius:.007+e()*.028,warm:e()>.46})),h=["#9ed5a87a","#f4c48d82"].map(f=>{let i=document.createElement("canvas");i.width=i.height=64;let w=i.getContext("2d"),a=w.createRadialGradient(32,32,0,32,32,32);return a.addColorStop(0,f),a.addColorStop(1,"#b5dec000"),w.fillStyle=a,w.fillRect(0,0,64,64),i}),x=r.map(()=>new Float32Array(n+1)),c=0,v,d;return{draw(f,i,w){let a=o.width,m=o.height;c!==m&&(c=m,v=t.createLinearGradient(0,0,0,m),v.addColorStop(0,"#0b2329"),v.addColorStop(.43,"#34645a"),v.addColorStop(1,"#0a1d20"),d=["#3b6858","#254b43"].map(M=>{let g=t.createLinearGradient(0,m*.53,0,m);return g.addColorStop(0,M),g.addColorStop(1,"#0b2024"),g})),t.fillStyle=v,t.fillRect(0,0,a,m),r.forEach((M,g)=>{let S=x[g],R=(i-.5)*a*.021*(g+1),y=g-f*.78;for(let l=0;l<=n;l++)S[l]=(.34+M[l]*.64+.018*Math.sin(l*.048+y))*m;t.fillStyle=d[g],t.beginPath(),t.moveTo(-32,m);for(let l=0;l<=n;l++)t.lineTo(l/n*(a+64)-32+R,S[l]);t.lineTo(a+32+R,m),t.fill();for(let l=g;l<s.length;l+=2){let b=s[l],E=.68+.32*Math.sin(b.phase+f*.75);t.globalAlpha=b.opacity*E*(g?.88:.62),t.fillStyle=b.color;let I=b.column/n*(a+64)-32+R+b.jitter,A=S[b.column]+b.offset*m*.48;t.fillRect(I,A,b.size,b.size)}t.globalAlpha=1});for(let M of p){let g=(M.x+(i-.5)*.025)*a,S=(M.y+(w-.5)*.015)*m,R=M.radius*Math.min(a,m),y=h[M.warm?1:0];t.drawImage(y,g-R,S-R,R*2,R*2)}},destroy(){}}}var $=2*Math.PI;function q(o){let t=o.getContext("2d");if(t)return{draw(n,r,u,e){let{width:s,height:p}=o,h=Math.max(19,s/43),x=h*.33,c=Math.max(p*.75,76),v={x:r*s,y:u*p};t.clearRect(0,0,s,p),t.lineCap="round",t.lineWidth=1.3;for(let d=0;d<2;d++){t.beginPath();for(let f=0,i=h/2;i<s;f++,i+=h)for(let w=0,a=h/2;a<p;w++,a+=h){if(+((f+w*2)%5===0)!==d)continue;let m=Math.sin(i*.011+a*.024-n*1.8),M=m*1.35+Math.sin(i*.007-a*.017+n)*.65,g=i-v.x,S=a-v.y,R=e*Math.max(0,1-(g*g+S*S)/(c*c)),y=M+R*Math.sin(Math.atan2(S,g)+$/4-M),l=Math.cos(y)*x,b=Math.sin(y)*x,E=a+3*m+S*R*.12;t.moveTo(i-l,E-b),t.lineTo(i+l,E+b)}t.strokeStyle=d?"#ecc58d9c":"#9bd6c49c",t.stroke()}},destroy(){}}}function z(o){let t=o.getContext("2d");if(!t)return;let n=30,r=new Float32Array(n+1),u=.5,e=.5;return{draw(s,p,h,x){let{width:c,height:v}=o;u+=((x?p:.5)-u)*.11,e+=((x?h:.5)-e)*.14;let d=.6-u*.2,f=Math.round(13+e*14),i={x:c*1.08,y:-v*.56},w=Math.sin(s*.85)*.07;for(let a=0;a<=n;a++){let m=a/n;r[a]=2*m**(1.4*(1-d))*(1-m)**(1.4*d)}t.clearRect(0,0,c,v),t.lineWidth=1.15;for(let a=0;a<2;a++){t.beginPath();for(let m=0;m<f;m++){if(+(m%5===0)!==a)continue;let M=(m/(f-1))**2,g=c*(-.36+M*.63),S=v*(-.24+M*1.85),R=c*(.22+w+(u-.5)*.14),y=v*(.64+(e-.5)*.28-M*.3);t.moveTo(i.x,i.y);for(let l=1;l<=n;l++){let b=l/n;t.lineTo(i.x+(g-i.x)*b+R*r[l],i.y+(S-i.y)*b+y*r[l])}}t.strokeStyle=a?"#c18a429c":"#419b889c",t.stroke()}},destroy(){}}}var K=`#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform float uHover;
uniform vec3 uBg;
uniform vec3 uBase;
uniform vec3 uAccent;
uniform float uScale;
uniform float uAmp;
uniform int uLines;
uniform float uGlow;
uniform float uDpr;
uniform float uEnvPeriod;
uniform float uEnvMin;
uniform float uDrift;
uniform float uTwist;
uniform float uSway;
uniform float uFreq;
uniform float uLineW;
uniform float uLineA;
uniform float uExposure;
uniform float uEdgeFade;
uniform float uCurl;
uniform float uFill;
uniform float uGlowR;
uniform float uBias;
uniform float uHoverLift;
uniform float uSeed;
uniform float uDirAngle;
uniform vec4 uR0;
uniform vec4 uR1;
uniform vec4 uR2;
out vec4 outColor;
const float PI = 3.14159265;

float ribbon(float X, float py, float t, float env, vec4 R, float ph, float om, float w, float lift, out float glow) {
    ph += uSeed;
    float amp = R.y * uAmp;
    float a = sin(PI * X - uDrift * om * t + ph);
    float b = sin(2.0 * PI * 0.65 * X + uSway * om * t + ph * 1.7);
    float c = sin(2.0 * PI * 1.35 * X - 0.6 * uSway * om * t + ph * 2.3);
    float cy = R.x - env * amp * (0.8 * a + 0.28 * b + 0.14 * c) - lift;
    float tw = sin(2.0 * PI * 0.8 * X - uTwist * om * t + ph - 0.94);
    float th = R.z * mix(1.0, env, 0.45) * (uBias + tw) / max(1.0 + uBias, 1e-4);
    float cu = uCurl * sin(2.0 * PI * 1.7 * X + 0.8 * uSway * om * t + ph * 0.7);

    float d0 = py - cy;
    float half_ = 0.5 * abs(th);
    float I = 0.0;
    if (abs(d0) < half_ + abs(cu) * 0.7 + 4.0 * w) {
        float n = float(max(uLines, 2));
        float w2 = max(w * w, 1e-10);
        for (int j = 0; j < 128; j++) {
            if (j >= uLines) break;
            float s = float(j) / max(n - 1.0, 1.0) - 0.5;
            float d = d0 - s * th - cu * (s * s - 0.0833) * 4.0;
            float k = 1.0 - uEdgeFade * (s + 0.5);
            I += k * exp(-d * d / w2);
        }
        I *= uLineA;
    }
    float inside = 1.0 - smoothstep(half_, half_ + 2.0 * w, abs(d0));
    I += uFill * inside;
    float dd = max(abs(d0) - half_, 0.0) / max(uGlowR, 1e-4);
    glow = exp(-dd * dd) * R.w;
    return I * R.w;
}

void main() {
    vec2 fc = gl_FragCoord.xy;
    float H = max(uRes.y, 1.0);
    float x = fc.x / max(uRes.x, 1.0);
    float py0 = 1.0 - fc.y / H;
    float aspect = uRes.x / H;
    float ca = cos(uDirAngle);
    float sa = sin(uDirAngle);
    float dx = x - 0.5;
    float dy = py0 - 0.5;
    float X = (dx * ca - dy * sa) * uFreq / max(uScale, 0.05) + 0.5;
    float py = (dx * sa + dy * ca) + 0.5;
    float t = uTime;
    float env = mix(uEnvMin, 1.0, 0.5 + 0.5 * cos(2.0 * PI * t / max(uEnvPeriod, 0.1)));
    float w = max(0.6 * uLineW * uDpr / H, 0.5 / H);
    float mdx = (x - uMouse.x) * aspect;
    float lift = uHover * uHoverLift * exp(-mdx * mdx * 6.0);

    float g0, g1, g2;
    float I = ribbon(X, py, t, env, uR2, 0.5, 0.73, w, lift * 0.6, g2);
    I += ribbon(X, py, t, env, uR1, 2.4, 1.37, w, lift * 0.8, g1);
    I += ribbon(X, py, t, env, uR0, 0.0, 1.0, w, lift, g0);
    I += uGlow * 0.035 * (g0 + g1 + g2);

    float v = 1.0 - exp(-max(I, 0.0) * uExposure);
    vec3 c1 = uBase * vec3(0.16, 0.16, 0.24);
    vec3 c2 = uBase * vec3(0.40, 0.40, 0.62);
    vec3 c3 = uBase * vec3(0.61, 0.60, 0.81);
    vec3 col = mix(uBg, c1, smoothstep(0.0, 0.12, v));
    col = mix(col, c2, smoothstep(0.12, 0.3, v));
    col = mix(col, c3, smoothstep(0.3, 0.5, v));
    col = mix(col, uBase, smoothstep(0.5, 0.72, v));
    col = mix(col, uAccent, smoothstep(0.72, 1.0, v));
    outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,Z=`#version 300 es
void main() {
    vec2 vertex = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
    gl_Position = vec4(vertex * 2.0 - 1.0, 0.0, 1.0);
}`;function V(o){let t=o.getContext("webgl2",{alpha:!1,antialias:!1});if(!t)return;let n=(d,f)=>{let i=t.createShader(d);return i?(t.shaderSource(i,f),t.compileShader(i),t.getShaderParameter(i,t.COMPILE_STATUS)?i:(t.deleteShader(i),null)):null},r=n(t.VERTEX_SHADER,Z),u=n(t.FRAGMENT_SHADER,K),e=t.createProgram();if(r&&u&&e&&(t.attachShader(e,r),t.attachShader(e,u),t.linkProgram(e)),t.deleteShader(r),t.deleteShader(u),!e||!t.getProgramParameter(e,t.LINK_STATUS)){t.deleteProgram(e);return}t.useProgram(e);let s=d=>t.getUniformLocation(e,d),p={uScale:1,uAmp:.75,uGlow:.9,uDpr:1,uEnvPeriod:7,uEnvMin:.55,uDrift:.105,uTwist:.7,uSway:.91,uFreq:1.2,uLineW:.95,uLineA:.42,uExposure:3.2,uEdgeFade:.6,uCurl:.04,uFill:.1,uGlowR:.06,uBias:.3,uHoverLift:.04,uSeed:0,uDirAngle:-.17};for(let[d,f]of Object.entries(p))t.uniform1f(s(d),f);t.uniform1i(s("uLines"),36),t.uniform3f(s("uBg"),.05,.15,.16),t.uniform3f(s("uBase"),.27,.65,.55),t.uniform3f(s("uAccent"),.97,.77,.5),t.uniform4f(s("uR0"),.55,.19,.2,1),t.uniform4f(s("uR1"),.72,.15,.12,.65),t.uniform4f(s("uR2"),.44,.14,.27,.52);let h=s("uRes"),x=s("uTime"),c=s("uMouse"),v=s("uHover");return{draw(d,f,i,w){t.viewport(0,0,o.width,o.height),t.uniform2f(h,o.width,o.height),t.uniform1f(x,d*.65),t.uniform2f(c,f,i),t.uniform1f(v,w),t.drawArrays(t.TRIANGLES,0,3)},destroy(){t.deleteProgram(e)}}}var J=["canvas"],tt={meadow:O,ribbons:V,ripple:q,reactive:z},pt=(()=>{class o{constructor(){this.zone=L(k),this.host=L(D),this.startFrame=0}ngAfterViewInit(){this.zone.runOutsideAngular(()=>{this.startFrame=requestAnimationFrame(()=>{this.startFrame=requestAnimationFrame(()=>this.start())})})}ngOnDestroy(){cancelAnimationFrame(this.startFrame),this.cleanup?.()}start(){let n=this.canvas.nativeElement,r=this.host.nativeElement.parentElement;if(!r)return;let u=tt[this.effect](n);if(!u){n.hidden=!0;return}let e=matchMedia("(prefers-reduced-motion: reduce)"),s=this.effect==="reactive"?48:32,p=!1,h=!1,x=0,c=0,v=0,d=.5,f=.5,i=0,w=y=>{y-c>=s&&(v+=c?Math.min((y-c)/1e3,.08):0,c=y,u.draw(v,d,f,i)),x=requestAnimationFrame(w)},a=()=>{cancelAnimationFrame(x),c=0,!(h||document.hidden||!p)&&(e.matches?u.draw(0,.5,.5,0):x=requestAnimationFrame(w))},m=new ResizeObserver(([y])=>{let{width:l,height:b}=y.contentRect;if(!l||!b)return;let E=this.effect==="meadow",I=E||this.effect==="reactive",A=Math.min(devicePixelRatio,1,(E?1120:940)/l,(I?820:420)/b),P=Math.max(1,Math.round(l*A)),C=Math.max(1,Math.round(b*A));n.width===P&&n.height===C||(n.width=P,n.height=C,a())}),M=new IntersectionObserver(([y])=>{p=y.isIntersecting,a()}),g=y=>{let l=r.getBoundingClientRect();d=Math.max(0,Math.min(1,(y.clientX-l.left)/l.width)),f=Math.max(0,Math.min(1,(y.clientY-l.top)/l.height)),i=1},S=()=>{d=f=.5,i=0},R=()=>{h=!0,n.hidden=!0,a()};m.observe(this.host.nativeElement),M.observe(r),r.addEventListener("pointermove",g,{passive:!0}),r.addEventListener("pointerleave",S),n.addEventListener("webglcontextlost",R),e.addEventListener("change",a),document.addEventListener("visibilitychange",a),this.cleanup=()=>{cancelAnimationFrame(x),m.disconnect(),M.disconnect(),r.removeEventListener("pointermove",g),r.removeEventListener("pointerleave",S),n.removeEventListener("webglcontextlost",R),e.removeEventListener("change",a),document.removeEventListener("visibilitychange",a),u.destroy()}}static{this.\u0275fac=function(r){return new(r||o)}}static{this.\u0275cmp=T({type:o,selectors:[["app-originkit-scene"]],viewQuery:function(r,u){if(r&1&&H(J,7),r&2){let e;X(e=G())&&(u.canvas=e.first)}},inputs:{effect:"effect"},standalone:!0,features:[j],decls:2,vars:0,consts:[["canvas",""],["aria-hidden","true"]],template:function(r,u){r&1&&B(0,"canvas",1,0)},styles:["[_nghost-%COMP%]{position:absolute;inset:0;display:block;pointer-events:none;overflow:hidden}canvas[_ngcontent-%COMP%]{display:block;width:100%;height:100%}"]})}}return o})();export{nt as a,pt as b};
