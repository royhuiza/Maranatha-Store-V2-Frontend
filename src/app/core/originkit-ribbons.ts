// Wave Ribbons — Originkit. Shader from the supplied reference, adapted for Maranatha.
const fragmentSource = `#version 300 es
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
}`;

const vertexSource = `#version 300 es
void main() {
    vec2 vertex = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
    gl_Position = vec4(vertex * 2.0 - 1.0, 0.0, 1.0);
}`;

export function createRibbons(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false });
  if (!gl) return undefined;

  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
    gl.deleteShader(shader);
    return null;
  };

  const vertex = compile(gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (vertex && fragment && program) {
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
  }
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!program || !gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return undefined;
  }

  gl.useProgram(program);
  const location = (name: string) => gl.getUniformLocation(program, name);
  const settings = {
    uScale: 1, uAmp: .75, uGlow: .9, uDpr: 1, uEnvPeriod: 7,
    uEnvMin: .55, uDrift: .105, uTwist: .7, uSway: .91, uFreq: 1.2,
    uLineW: .95, uLineA: .42, uExposure: 3.2, uEdgeFade: .6,
    uCurl: .04, uFill: .1, uGlowR: .06, uBias: .3, uHoverLift: .04,
    uSeed: 0, uDirAngle: -.17
  };
  for (const [name, value] of Object.entries(settings)) gl.uniform1f(location(name), value);
  gl.uniform1i(location('uLines'), 36);
  gl.uniform3f(location('uBg'), .05, .15, .16);
  gl.uniform3f(location('uBase'), .27, .65, .55);
  gl.uniform3f(location('uAccent'), .97, .77, .5);
  gl.uniform4f(location('uR0'), .55, .19, .20, 1);
  gl.uniform4f(location('uR1'), .72, .15, .12, .65);
  gl.uniform4f(location('uR2'), .44, .14, .27, .52);

  const resolution = location('uRes');
  const time = location('uTime');
  const mouse = location('uMouse');
  const hover = location('uHover');
  return {
    draw(seconds: number, pointerX: number, pointerY: number, over: number) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(resolution, canvas.width, canvas.height);
      gl.uniform1f(time, seconds * .65);
      gl.uniform2f(mouse, pointerX, pointerY);
      gl.uniform1f(hover, over);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    destroy() {
      gl.deleteProgram(program);
    }
  };
}
