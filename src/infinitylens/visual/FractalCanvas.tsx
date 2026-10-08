/*
 * Reused from MichaelWave369/infinitylens369, MIT License.
 * Copyright (c) 2026 Michael Hughes.
 * Source: https://github.com/MichaelWave369/infinitylens369/blob/main/src/visual/FractalCanvas.tsx
 * Adaptation: cap DPR/frame-rate and avoid running while hidden; display a fallback on WebGL2 failures.
 */
import { useEffect, useRef, type PointerEvent, type WheelEvent } from 'react';
import type { AudioFeatures, CameraState, PaletteName, VisualSettings } from '../types';

type FractalCanvasProps = {
  features: AudioFeatures;
  settings: VisualSettings;
  onCameraChange: (camera: CameraState) => void;
  onUnavailable?: (reason: string) => void;
};

const SAFE_MAX_ZOOM = 95000;
const SAFE_MIN_ZOOM = 0.25;

const mandelbrotFlightAnchors = [
  { centerX: -0.743643887037151, centerY: 0.13182590420533, zoom: 1.1 },
  { centerX: -0.74529, centerY: 0.113075, zoom: 1.2 },
  { centerX: -0.761574, centerY: -0.0847596, zoom: 1.15 },
  { centerX: -0.10109636384562, centerY: 0.95628651080914, zoom: 1.05 },
  { centerX: -1.25066, centerY: 0.02012, zoom: 1.1 },
];

const emptyFeatures: AudioFeatures = {
  bass: 0,
  mid: 0,
  high: 0,
  rms: 0,
  beat: 0,
  waveform: 0,
};

const vertexShaderSource = `#version 300 es
in vec2 aPosition;
out vec2 vUv;

void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const fragmentShaderSource = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 outColor;

uniform vec2 uResolution;
uniform vec2 uCenter;
uniform float uZoom;
uniform float uRotation;
uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uBeat;
uniform float uRms;
uniform float uGlow;
uniform float uPalette;
uniform float uMode;

const int MAX_ITER = 240;
const float TAU = 6.28318530718;

vec3 hsv2rgb(vec3 c) {
  vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  rgb = rgb * rgb * (3.0 - 2.0 * rgb);
  return c.z * mix(vec3(1.0), rgb, c.y);
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i += 1) {
    v += a * noise2(p);
    p = p * 2.03 + vec2(17.1, -9.2);
    a *= 0.5;
  }
  return v;
}

vec3 paletteVioletGold(float t) {
  vec3 a = vec3(0.08, 0.03, 0.16);
  vec3 b = vec3(0.88, 0.65, 0.26);
  vec3 c = vec3(0.30, 0.12, 0.58);
  return mix(a, b, smoothstep(0.05, 1.0, t)) + c * pow(1.0 - t, 2.4);
}

vec3 paletteSolar(float t) {
  return vec3(0.10 + 1.10 * pow(t, 0.72), 0.03 + 0.48 * pow(t, 1.35), 0.02 + 0.13 * sin(t * TAU));
}

vec3 paletteAbyss(float t) {
  return vec3(0.02 + 0.16 * t, 0.06 + 0.90 * pow(t, 1.9), 0.13 + 1.05 * pow(t, 0.68));
}

vec3 paletteAurora(float t) {
  vec3 base = 0.5 + 0.5 * cos(TAU * (vec3(0.00, 0.33, 0.67) + t + uTime * 0.035));
  return mix(vec3(0.03, 0.04, 0.09), base, smoothstep(0.02, 0.95, t));
}

vec3 pickPalette(float t) {
  if (uPalette < 0.5) return paletteVioletGold(t);
  if (uPalette < 1.5) return paletteSolar(t);
  if (uPalette < 2.5) return paletteAbyss(t);
  return paletteAurora(t);
}

float mandelbrot(vec2 p) {
  vec2 z = vec2(0.0);
  for (int i = 0; i < MAX_ITER; i += 1) {
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + p;
    if (dot(z, z) > 4.0) {
      float smoothIter = float(i) + 1.0 - log2(max(log(length(z)), 0.0001));
      return clamp(smoothIter / float(MAX_ITER), 0.0, 1.0);
    }
  }
  return 0.0;
}

float julia(vec2 z) {
  vec2 c = vec2(-0.77 + 0.07 * sin(uTime * 0.13 + uMid * 2.0), 0.156 + 0.05 * cos(uTime * 0.17 + uHigh * 3.0));
  for (int i = 0; i < MAX_ITER; i += 1) {
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
    if (dot(z, z) > 4.0) {
      float smoothIter = float(i) + 1.0 - log2(max(log(length(z)), 0.0001));
      return clamp(smoothIter / float(MAX_ITER), 0.0, 1.0);
    }
  }
  return 0.0;
}

float ring(vec2 p, float radius, float width) {
  return 1.0 - smoothstep(width, width * 2.0, abs(length(p) - radius));
}

vec3 renderFractal(vec2 uv, vec2 p) {
  float scale = 2.85 / max(uZoom, 0.0001);
  vec2 field = uCenter + p * scale;
  float escaped = uMode < 0.5 ? mandelbrot(field) : julia(field);
  float edge = escaped <= 0.0 ? 0.0 : pow(escaped, 0.70);
  vec3 color = escaped <= 0.0 ? vec3(0.012, 0.016, 0.030) : pickPalette(edge + uHigh * 0.035);
  float boundarySpark = smoothstep(0.015, 0.18, escaped) * (1.0 - smoothstep(0.58, 0.95, escaped));
  color += pickPalette(fract(edge + 0.24 + uTime * 0.015)) * boundarySpark * (0.08 + uGlow * 0.16);
  color += vec3(1.0, 0.76, 0.38) * ring(p, 0.24 + uBass * 0.08, 0.006 + uRms * 0.02) * (0.2 + uGlow * 0.9);
  color += vec3(0.32, 0.64, 1.0) * exp(-length(p) * (3.2 - uMid)) * (0.08 + uRms * 0.18);
  color *= 0.38 + 0.92 * smoothstep(1.35, 0.22, length(uv));
  color += vec3(uBeat * 0.08, uBeat * 0.045, uBeat * 0.13);
  return color;
}

vec2 acidWarp(vec2 p, float t) {
  vec2 q = vec2(fbm(p * 1.15 + vec2(t * 0.18, -t * 0.12)), fbm(p * 1.15 + vec2(-t * 0.14, t * 0.16)));
  p += (q - 0.5) * (0.72 + uMid * 2.6 + uRms * 0.6);
  p += 0.18 * sin(vec2(p.y, p.x) * 3.5 + t * (1.2 + uBass * 4.4));
  p *= 1.0 + 0.15 * sin(t * 0.45 + length(p) * 2.0 + uHigh * 5.0);
  return p;
}

vec3 renderAcidMelt(vec2 uv) {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  float t = uTime * (0.45 + uRms * 0.28);
  vec2 p = uv * 2.0 - 1.0;
  p.x *= aspect;
  p *= 1.85;
  p *= 1.0 + 0.08 * sin(t * 2.5 + uBass * 8.0 + uBeat * 4.0);
  float spin = uRotation * 0.4 + sin(t * 0.25) * 0.35 + uMid * 0.25;
  p = mat2(cos(spin), -sin(spin), sin(spin), cos(spin)) * acidWarp(p, t);
  float r = length(p);
  float a = atan(p.y, p.x);
  float tunnel = sin(14.0 / max(r + 0.16, 0.05) - t * 5.0 + uBass * 8.0);
  float rings = sin(r * (9.0 + uBass * 8.0) - t * 4.4 - uBeat * 5.0);
  float swirl = sin(a * (7.0 + uMid * 5.0) + r * 6.0 - t * 3.2 + uMid * 4.0);
  float plasma = fbm(p * (2.25 + uHigh * 1.4) + vec2(t * 0.72, -t * 0.48));
  float secondPlasma = fbm(p * 5.2 - vec2(t * 0.22, t * 0.31));
  float pulse = 0.5 + 0.5 * sin(t * 5.0 + r * 8.0 + uBass * 10.0 + uBeat * 8.0);
  float coreGlow = exp(-2.75 * abs(rings + swirl * 0.55 + tunnel * 0.18 - plasma));
  float hotEdge = smoothstep(0.42, 1.0, coreGlow) + 0.45 * smoothstep(0.55, 1.0, secondPlasma);
  float hue = fract(0.54 + plasma * 0.22 + secondPlasma * 0.09 + swirl * 0.08 + tunnel * 0.035 + t * 0.035 + uHigh * 0.22);
  vec3 color = hsv2rgb(vec3(hue, 0.74 + 0.24 * pulse, 0.10 + 0.68 * coreGlow + 0.30 * plasma + 0.20 * hotEdge));
  color += 0.25 * hsv2rgb(vec3(fract(hue + 0.18), 0.95, coreGlow));
  color += 0.14 * hsv2rgb(vec3(fract(hue + 0.50), 0.82, pulse));
  color += exp(-r * (1.8 + uBass)) * vec3(0.24, 0.12, 0.44) * (0.35 + uGlow);
  color += vec3(uBeat * 0.11, uBeat * 0.035, uBeat * 0.16);
  color *= 0.42 + 0.94 * smoothstep(1.85, 0.16, length(uv * 2.0 - 1.0));
  color *= 1.0 + uGlow * 0.78;
  return color;
}

vec3 renderTunnelBloom(vec2 uv) {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  float t = uTime * (0.52 + uRms * 0.35);
  vec2 p = uv * 2.0 - 1.0;
  p.x *= aspect;
  p *= 1.0 + 0.16 * sin(t * 1.75 + uBass * 7.0 + uBeat * 5.0);
  float r = max(length(p), 0.018);
  float a = atan(p.y, p.x);
  float pull = 1.0 / r;
  a += uRotation * 0.72 + t * (0.18 + uMid * 0.32) + pull * 0.035;
  a += 0.16 * sin(pull * 0.9 + t * 2.2 + uBass * 4.0);
  vec2 tunnelUv = vec2(a / TAU + 0.5, pull * (0.24 + uRms * 0.09) - t * (0.42 + uBass * 0.36));
  float tubeNoise = fbm(vec2(tunnelUv.x * 5.0, tunnelUv.y * 1.25));
  float fineNoise = fbm(vec2(tunnelUv.x * 18.0 + t * 0.12, tunnelUv.y * 2.8 - t * 0.20));
  float lanes = abs(sin((a * (6.0 + floor(uMid * 5.0)) + pull * 0.50 - t * 3.2)));
  float ringFlow = sin(pull * (1.6 + uBass * 0.9) - t * (7.0 + uBass * 5.0) + tubeNoise * 3.2);
  float ringMask = smoothstep(0.22, 0.94, 1.0 - abs(ringFlow));
  float laneMask = smoothstep(0.52, 0.96, lanes);
  float centerStar = exp(-r * (3.2 - uBass * 0.8));
  float bloom = ringMask * (0.36 + laneMask * 0.52) + centerStar * (0.65 + uBeat * 1.25);
  bloom += smoothstep(0.72, 1.0, fineNoise) * 0.20 * (0.3 + uHigh);
  float hue = fract(0.62 + tunnelUv.y * 0.045 + tubeNoise * 0.16 + laneMask * 0.08 + t * 0.025 + uHigh * 0.20);
  vec3 color = hsv2rgb(vec3(hue, 0.72 + 0.25 * laneMask, 0.12 + bloom * 0.88));
  color += pickPalette(fract(hue + 0.24 + ringMask * 0.12)) * bloom * (0.38 + uGlow * 0.72);
  color += vec3(0.22, 0.10, 0.52) * centerStar * (0.55 + uBass + uBeat);
  color *= 0.34 + 1.04 * smoothstep(1.65, 0.20, r) * smoothstep(1.22, 0.10, r);
  color += vec3(uBeat * 0.10, uBeat * 0.045, uBeat * 0.18);
  color *= 1.0 + uGlow * 0.92;
  return color;
}

vec3 renderKaleidoTrip(vec2 uv) {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  float t = uTime * (0.46 + uRms * 0.38);
  vec2 p = uv * 2.0 - 1.0;
  p.x *= aspect;
  p *= 1.0 + 0.10 * sin(t * 1.6 + uBass * 7.0 + uBeat * 5.0);
  float spin = uRotation * 0.62 + t * (0.10 + uMid * 0.22) + sin(t * 0.23) * 0.28;
  p = mat2(cos(spin), -sin(spin), sin(spin), cos(spin)) * p;
  float r = max(length(p), 0.0001);
  float a = atan(p.y, p.x);
  float folds = 6.0 + floor(uMid * 6.0) + floor(uBeat * 3.0);
  float sector = TAU / folds;
  a += 0.38 * sin(r * (2.8 + uBass * 3.0) - t * 1.7) + uBass * 0.22;
  float foldedAngle = abs(mod(a + sector * 0.5, sector) - sector * 0.5);
  vec2 q = vec2(cos(foldedAngle), sin(foldedAngle)) * r;
  q += 0.14 * vec2(sin(q.y * 5.0 + t * 1.8 + uBass * 3.0), cos(q.x * 5.0 - t * 1.5 + uHigh * 3.0));
  float plasma = fbm(q * (3.0 + uHigh * 2.1) + vec2(t * 0.38, -t * 0.31));
  float crystalNoise = fbm(q * 7.0 - vec2(t * 0.16, t * 0.22));
  float spokes = pow(1.0 - abs(sin(foldedAngle * folds * 2.0 + r * (12.0 + uBass * 8.0) - t * 4.2 + plasma * 3.0)), 5.0);
  float rings = pow(1.0 - abs(sin(r * (18.0 + uBass * 12.0) - t * (4.5 + uBeat * 5.0) + crystalNoise * 2.0)), 4.0);
  float cells = smoothstep(0.42, 1.0, crystalNoise);
  float centerStar = exp(-r * (2.0 - uBass * 0.35));
  float mandala = spokes * 0.72 + rings * 0.56 + cells * 0.24 + centerStar * (0.42 + uBeat * 0.65);
  float pulse = 0.5 + 0.5 * sin(t * 4.2 + r * 9.0 + uBass * 8.0);
  float hue = fract(0.74 + foldedAngle * folds * 0.08 + r * 0.10 + plasma * 0.22 + t * 0.026 + uHigh * 0.18);
  vec3 color = hsv2rgb(vec3(hue, 0.70 + 0.28 * pulse, 0.10 + mandala * 0.82 + plasma * 0.16));
  color += pickPalette(fract(hue + 0.18 + rings * 0.14)) * mandala * (0.28 + uGlow * 0.78);
  color += hsv2rgb(vec3(fract(hue + 0.42), 0.82, spokes * 0.24 + uBeat * 0.12));
  color += vec3(0.36, 0.10, 0.52) * centerStar * (0.26 + uGlow + uBass);
  color *= 0.38 + smoothstep(1.75, 0.18, length(uv * 2.0 - 1.0));
  color += vec3(uBeat * 0.12, uBeat * 0.05, uBeat * 0.18);
  color *= 1.0 + uGlow * 0.86;
  return color;
}

vec3 renderPixelMelt(vec2 uv) {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  float t = uTime * (0.38 + uRms * 0.55);
  float grid = mix(148.0, 36.0, clamp(uBass * 0.95 + uBeat * 0.55, 0.0, 1.0));
  vec2 gridSize = vec2(grid * aspect, grid);
  vec2 pixUv = (floor(uv * gridSize) + 0.5) / gridSize;
  vec2 p = pixUv * 2.0 - 1.0;
  p.x *= aspect;
  float meltWave = fbm(vec2(p.x * 1.25 + t * 0.25, p.y * 1.8 - t * 0.33));
  p.y += (meltWave - 0.5) * (0.30 + uMid * 0.52 + uBeat * 0.25);
  p.x += sin(p.y * (5.0 + uBass * 5.0) + t * 2.2) * (0.05 + uHigh * 0.07);
  float r = length(p);
  float a = atan(p.y, p.x);
  float cell = fbm(floor((p + 3.0) * (7.0 + uBass * 10.0)) * 0.37 + vec2(t * 0.15, -t * 0.11));
  float bands = sin((p.y + cell * 0.38) * (22.0 + uMid * 18.0) - t * (3.0 + uBass * 5.0));
  float arcs = sin(a * (5.0 + floor(uMid * 7.0)) + 9.0 / max(r + 0.22, 0.08) - t * 3.8);
  float blocks = smoothstep(0.44, 1.0, cell) * 0.55 + pow(1.0 - abs(bands), 4.0) * 0.46 + pow(1.0 - abs(arcs), 4.0) * 0.56;
  float checker = step(0.5, fract((floor(uv.x * gridSize.x) + floor(uv.y * gridSize.y)) * 0.5));
  float dither = hash21(floor(uv * uResolution.xy * 0.45));
  float scanline = 0.86 + 0.14 * sin(uv.y * uResolution.y * 3.14159);
  float tear = smoothstep(0.92, 1.0, fbm(vec2(floor(uv.y * 72.0) * 0.08, t * 0.7))) * (0.08 + uBeat * 0.12);
  float hue = fract(0.08 + cell * 0.32 + bands * 0.05 + arcs * 0.07 + t * 0.045 + uHigh * 0.28 + checker * 0.03);
  vec3 color = hsv2rgb(vec3(hue, 0.78 + 0.20 * uRms, 0.09 + blocks * 0.90 + dither * 0.06));
  color += pickPalette(fract(hue + 0.18 + cell * 0.20)) * blocks * (0.24 + uGlow * 0.64);
  color += vec3(tear * 0.85, tear * 0.28, uHigh * smoothstep(0.62, 1.0, dither) * 0.12);
  color *= scanline;
  color *= 0.42 + 0.98 * smoothstep(1.75, 0.16, length(uv * 2.0 - 1.0));
  color += vec3(uBeat * 0.18, uBeat * 0.07, uBeat * 0.20);
  color *= 1.0 + uGlow * 0.62;
  return color;
}

vec3 renderCosmicDrift(vec2 uv) {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  float t = uTime * (0.32 + uRms * 0.50);
  vec2 p = uv * 2.0 - 1.0;
  p.x *= aspect;
  float drift = uRotation * 0.33 + t * (0.10 + uMid * 0.24);
  p = mat2(cos(drift), -sin(drift), sin(drift), cos(drift)) * p;
  float r = max(length(p), 0.02);
  float a = atan(p.y, p.x);
  float pull = 1.0 / (r + 0.08);
  vec2 warp = vec2(fbm(p * 1.6 + vec2(t * 0.26, -t * 0.18)), fbm(p * 1.6 + vec2(-t * 0.20, t * 0.24))) - 0.5;
  vec2 q = p + warp * (0.45 + uMid * 0.75 + uBeat * 0.25);
  float nebulaA = fbm(q * (1.45 + uBass * 1.2) + vec2(t * 0.26, -t * 0.18));
  float nebulaB = fbm(q * 3.2 - vec2(t * 0.18, t * 0.29));
  float river = sin(a * (3.0 + floor(uMid * 6.0)) + pull * (1.3 + uBass * 1.1) - t * (2.2 + uBass * 2.4) + nebulaA * 4.0);
  float lane = pow(1.0 - abs(river), 4.5);
  float horizon = exp(-r * (1.15 - uBass * 0.18));
  float core = exp(-r * (5.8 - uBass * 1.6)) * (0.8 + uBeat * 1.6);
  float stars = 0.0;
  float streaks = 0.0;
  for (int i = 0; i < 4; i += 1) {
    float fi = float(i);
    vec2 starP = q * (24.0 + fi * 22.0) + vec2(t * (1.5 + fi * 0.35), -t * (1.0 + fi * 0.28));
    vec2 cell = floor(starP);
    vec2 local = fract(starP) - 0.5;
    float seed = hash21(cell + fi * 19.7);
    float star = smoothstep(0.984, 1.0, seed) * exp(-dot(local, local) * (42.0 - uHigh * 16.0));
    float ray = pow(max(0.0, 1.0 - abs(sin(atan(local.y, local.x) * 4.0 + t * 2.0))), 8.0);
    stars += star * (0.32 + fi * 0.10 + uHigh * 0.45 + uBeat * 0.35);
    streaks += star * ray * (0.35 + uBass * 0.55);
  }
  float hue = fract(0.60 + nebulaA * 0.18 + nebulaB * 0.10 + lane * 0.08 + t * 0.018 + uHigh * 0.18);
  vec3 color = hsv2rgb(vec3(hue, 0.62 + 0.28 * nebulaB, 0.06 + nebulaA * 0.32 + lane * 0.46 + horizon * 0.14));
  color += pickPalette(fract(hue + 0.24 + nebulaB * 0.15)) * (lane * 0.32 + nebulaB * 0.18) * (0.45 + uGlow * 0.80);
  color += vec3(0.55, 0.75, 1.0) * stars;
  color += vec3(1.0, 0.72, 0.38) * streaks;
  color += vec3(0.45, 0.20, 0.95) * core * (0.8 + uGlow);
  color += vec3(uBeat * 0.10, uBeat * 0.06, uBeat * 0.22);
  color *= 0.46 + 0.92 * smoothstep(1.85, 0.12, length(uv * 2.0 - 1.0));
  color *= 1.0 + uGlow * 0.72;
  return color;
}

vec3 renderBlackHoleLens(vec2 uv) {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  float t = uTime * (0.34 + uRms * 0.50);
  vec2 p = uv * 2.0 - 1.0;
  p.x *= aspect;
  float spin = uRotation * 0.58 + t * (0.18 + uMid * 0.22);
  p = mat2(cos(spin), -sin(spin), sin(spin), cos(spin)) * p;

  float r = max(length(p), 0.006);
  float a = atan(p.y, p.x);
  float gravity = 1.0 / (r + 0.055);
  float bend = gravity * (0.085 + uBass * 0.045 + uBeat * 0.035);
  vec2 lensP = p * (1.0 + bend) + normalize(p + 0.0001) * sin(gravity * 0.68 - t * 1.7) * (0.010 + uMid * 0.020);

  float eventHorizon = 1.0 - smoothstep(0.115 + uBass * 0.014, 0.158 + uBass * 0.020, r);
  float photonRing = ring(p, 0.166 + uBeat * 0.016, 0.010 + uHigh * 0.012);
  float innerRing = ring(p, 0.245 + uBass * 0.030, 0.018 + uRms * 0.012);
  float diskBand = exp(-abs(lensP.y + sin(lensP.x * 4.0 + t) * 0.035) * (9.0 - uBass * 2.2));
  float diskShape = smoothstep(0.18, 1.25, abs(lensP.x)) * smoothstep(1.80, 0.42, abs(lensP.x)) * diskBand;
  float diskTexture = fbm(vec2(a * 2.2 + t * (1.5 + uBass), gravity * 0.44 - t * 0.35));
  float accretion = diskShape * (0.48 + diskTexture * 0.62 + uBeat * 0.28);
  float spiral = pow(1.0 - abs(sin(a * (3.0 + floor(uMid * 5.0)) + gravity * 1.18 - t * (2.9 + uBass * 2.0))), 4.6);
  float jet = exp(-abs(p.x) * (18.0 - uHigh * 5.0)) * smoothstep(0.12, 1.05, abs(p.y)) * smoothstep(1.55, 0.22, abs(p.y));

  float stars = 0.0;
  for (int i = 0; i < 4; i += 1) {
    float fi = float(i);
    vec2 starP = lensP * (25.0 + fi * 26.0) + vec2(t * (0.8 + fi * 0.4), -t * (1.0 + fi * 0.25));
    vec2 cell = floor(starP);
    vec2 local = fract(starP) - 0.5;
    float seed = hash21(cell + fi * 23.1);
    stars += smoothstep(0.986, 1.0, seed) * exp(-dot(local, local) * (32.0 - uHigh * 10.0)) * (0.26 + uHigh * 0.46);
  }

  float hue = fract(0.055 + diskTexture * 0.12 + spiral * 0.07 + t * 0.018 + uHigh * 0.16);
  vec3 color = vec3(0.006, 0.004, 0.014);
  color += pickPalette(fract(hue + 0.08)) * accretion * (0.95 + uGlow * 0.95);
  color += vec3(1.00, 0.82, 0.44) * photonRing * (0.85 + uGlow + uBeat);
  color += vec3(0.96, 0.32, 0.12) * innerRing * (0.42 + uBass + uGlow * 0.4);
  color += hsv2rgb(vec3(fract(hue + 0.58), 0.72, 0.34 + uHigh * 0.24)) * spiral * smoothstep(0.18, 1.4, r) * 0.55;
  color += vec3(0.28, 0.60, 1.0) * jet * (0.34 + uHigh * 0.62 + uBeat * 0.30);
  color += vec3(0.74, 0.86, 1.0) * stars;
  color *= 1.0 - eventHorizon * 0.96;
  color += vec3(0.008, 0.004, 0.018) * eventHorizon;
  color += vec3(uBeat * 0.13, uBeat * 0.06, uBeat * 0.035);
  color *= 0.48 + 0.90 * smoothstep(1.82, 0.12, length(uv * 2.0 - 1.0));
  color *= 1.0 + uGlow * 0.78;
  return color;
}

void main() {
  vec2 uv = vUv;
  vec2 centered = uv * 2.0 - 1.0;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  centered.x *= aspect;
  float audioWarp = uBass * 0.035 + uBeat * 0.018;
  float angle = uRotation + audioWarp * sin(uTime * 0.8 + length(centered) * 3.0);
  vec2 p = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * centered;

  vec3 color;
  if (uMode < 1.5) {
    color = renderFractal(centered, p);
  } else if (uMode < 2.5) {
    color = renderAcidMelt(uv);
  } else if (uMode < 3.5) {
    color = renderTunnelBloom(uv);
  } else if (uMode < 4.5) {
    color = renderKaleidoTrip(uv);
  } else if (uMode < 5.5) {
    color = renderPixelMelt(uv);
  } else if (uMode < 6.5) {
    color = renderCosmicDrift(uv);
  } else {
    color = renderBlackHoleLens(uv);
  }

  outColor = vec4(color, 1.0);
}
`;

const paletteIndex = (palette: PaletteName) => {
  switch (palette) {
    case 'solar-ember':
      return 1;
    case 'abyss-cyan':
      return 2;
    case 'aurora-phi':
      return 3;
    case 'violet-gold-duality':
    default:
      return 0;
  }
};

const modeIndex = (mode: VisualSettings['mode']) => {
  switch (mode) {
    case 'julia':
      return 1;
    case 'acid-melt':
      return 2;
    case 'tunnel-bloom':
      return 3;
    case 'kaleido-trip':
      return 4;
    case 'pixel-melt':
      return 5;
    case 'cosmic-drift':
      return 6;
    case 'black-hole-lens':
      return 7;
    case 'mandelbrot':
    default:
      return 0;
  }
};

const isExplorerMode = (mode: VisualSettings['mode']) => mode === 'mandelbrot' || mode === 'julia';
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const createShader = (gl: WebGL2RenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Unable to create shader.');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? 'Unknown shader compile error.';
    gl.deleteShader(shader);
    throw new Error(message);
  }

  return shader;
};

const createProgram = (gl: WebGL2RenderingContext) => {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  const program = gl.createProgram();
  if (!program) throw new Error('Unable to create WebGL program.');

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? 'Unknown shader link error.';
    gl.deleteProgram(program);
    throw new Error(message);
  }

  return program;
};

const resizeCanvasToDisplaySize = (canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) => {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
  const width = Math.floor(canvas.clientWidth * dpr);
  const height = Math.floor(canvas.clientHeight * dpr);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);
  }
};

export function FractalCanvas({ features, settings, onCameraChange, onUnavailable }: FractalCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const featuresRef = useRef(features);
  const settingsRef = useRef(settings);
  const cameraRef = useRef<CameraState>({
    centerX: mandelbrotFlightAnchors[0].centerX,
    centerY: mandelbrotFlightAnchors[0].centerY,
    zoom: mandelbrotFlightAnchors[0].zoom,
    rotation: 0,
  });
  const draggingRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    featuresRef.current = features;
  }, [features]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', { antialias: true, preserveDrawingBuffer: true });
    if (!gl) {
      onUnavailable?.('WebGL2 is not supported by this browser or device.');
      return;
    }

    let program: WebGLProgram;
    try {
      program = createProgram(gl);
    } catch (error) {
      onUnavailable?.(error instanceof Error ? error.message : 'Unable to initialize WebGL2 renderer.');
      return;
    }
    gl.useProgram(program);

    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    const vao = gl.createVertexArray();
    const buffer = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const uniforms = {
      resolution: gl.getUniformLocation(program, 'uResolution'),
      center: gl.getUniformLocation(program, 'uCenter'),
      zoom: gl.getUniformLocation(program, 'uZoom'),
      rotation: gl.getUniformLocation(program, 'uRotation'),
      time: gl.getUniformLocation(program, 'uTime'),
      bass: gl.getUniformLocation(program, 'uBass'),
      mid: gl.getUniformLocation(program, 'uMid'),
      high: gl.getUniformLocation(program, 'uHigh'),
      beat: gl.getUniformLocation(program, 'uBeat'),
      rms: gl.getUniformLocation(program, 'uRms'),
      glow: gl.getUniformLocation(program, 'uGlow'),
      palette: gl.getUniformLocation(program, 'uPalette'),
      mode: gl.getUniformLocation(program, 'uMode'),
    };

    let animation = 0;
    let lastPaint = 0;
    let frame = 0;
    let flightIndex = 0;
    const startedAt = performance.now();

    const render = () => {
      animation = requestAnimationFrame(render);
      if (document.hidden || !canvas.isConnected) return;
      const bounds = canvas.getBoundingClientRect();
      if (bounds.bottom < 0 || bounds.top > window.innerHeight || bounds.width < 1 || bounds.height < 1) return;
      const now = performance.now();
      if (now - lastPaint < 33) return;
      lastPaint = now;
      resizeCanvasToDisplaySize(canvas, gl);

      const time = (performance.now() - startedAt) / 1000;
      const currentSettings = settingsRef.current;
      const audio = currentSettings.audioReactive ? featuresRef.current : emptyFeatures;
      const camera = cameraRef.current;
      const explorer = isExplorerMode(currentSettings.mode);

      if (explorer) {
        const bassPush = 1 + (0.0016 + currentSettings.zoomSpeed * 0.0034) * (0.35 + audio.bass * 0.65 + audio.beat * 0.35);
        camera.zoom = clamp(camera.zoom * bassPush, SAFE_MIN_ZOOM, SAFE_MAX_ZOOM);
        camera.rotation += 0.0015 + audio.mid * 0.002;

        if (camera.zoom >= SAFE_MAX_ZOOM * 0.985) {
          flightIndex = (flightIndex + 1) % mandelbrotFlightAnchors.length;
          const next = mandelbrotFlightAnchors[flightIndex];
          camera.centerX = next.centerX;
          camera.centerY = next.centerY;
          camera.zoom = next.zoom;
        }
      } else {
        const pulse = 0.08 * Math.sin(time * (0.72 + currentSettings.zoomSpeed * 0.55) + audio.bass * 5 + audio.beat * 2);
        camera.zoom = 1 + pulse + audio.rms * 0.07;
        camera.rotation += 0.003 + currentSettings.zoomSpeed * 0.004 + audio.mid * 0.006 + audio.beat * 0.004;
      }

      gl.useProgram(program);
      gl.bindVertexArray(vao);
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      gl.uniform2f(uniforms.center, camera.centerX, camera.centerY);
      gl.uniform1f(uniforms.zoom, camera.zoom);
      gl.uniform1f(uniforms.rotation, camera.rotation);
      gl.uniform1f(uniforms.time, time);
      gl.uniform1f(uniforms.bass, audio.bass);
      gl.uniform1f(uniforms.mid, audio.mid);
      gl.uniform1f(uniforms.high, audio.high);
      gl.uniform1f(uniforms.beat, audio.beat);
      gl.uniform1f(uniforms.rms, audio.rms);
      gl.uniform1f(uniforms.glow, currentSettings.glow);
      gl.uniform1f(uniforms.palette, paletteIndex(currentSettings.palette));
      gl.uniform1f(uniforms.mode, modeIndex(currentSettings.mode));
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      frame += 1;
      if (frame % 3 === 0) onCameraChange({ ...camera });
    };

    animation = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animation);
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
    };
  }, [onCameraChange, onUnavailable]);

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    draggingRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const last = draggingRef.current;
    if (!last || !isExplorerMode(settingsRef.current.mode)) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const camera = cameraRef.current;
    const dx = event.clientX - last.x;
    const dy = event.clientY - last.y;
    const scale = 2.85 / Math.max(camera.zoom, 0.0001);
    const aspect = canvas.clientWidth / Math.max(canvas.clientHeight, 1);

    camera.centerX -= (dx / Math.max(canvas.clientWidth, 1)) * scale * aspect;
    camera.centerY += (dy / Math.max(canvas.clientHeight, 1)) * scale;
    draggingRef.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    draggingRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleWheel = (event: WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const camera = cameraRef.current;
    const currentSettings = settingsRef.current;

    if (isExplorerMode(currentSettings.mode)) {
      const factor = event.deltaY < 0 ? 1.18 : 0.84;
      camera.zoom = clamp(camera.zoom * factor, SAFE_MIN_ZOOM, SAFE_MAX_ZOOM);
    } else {
      camera.rotation += event.deltaY < 0 ? 0.06 : -0.06;
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className="fractal-canvas"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      aria-label="InfinityLens369 fractal and trip visualization canvas"
    />
  );
}
