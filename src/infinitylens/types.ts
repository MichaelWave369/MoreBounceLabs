export type FractalMode =
  | 'mandelbrot'
  | 'julia'
  | 'acid-melt'
  | 'tunnel-bloom'
  | 'kaleido-trip'
  | 'pixel-melt'
  | 'cosmic-drift'
  | 'black-hole-lens';

export type PaletteName =
  | 'violet-gold-duality'
  | 'solar-ember'
  | 'abyss-cyan'
  | 'aurora-phi';

export type AudioFeatures = {
  bass: number;
  mid: number;
  high: number;
  rms: number;
  beat: number;
  waveform: number;
};

export type VisualSettings = {
  mode: FractalMode;
  palette: PaletteName;
  showPhi: boolean;
  showGrid369: boolean;
  showEquations: boolean;
  audioReactive: boolean;
  zoomSpeed: number;
  audioDrive: number;
  audioBassDrive: number;
  audioMidDrive: number;
  audioHighDrive: number;
  audioBeatDrive: number;
  audioResponse: number;
  glow: number;
};

export type CameraState = {
  centerX: number;
  centerY: number;
  zoom: number;
  rotation: number;
};

export type VisualAddress = {
  protocol: 'INFINITYLENS369://scene';
  mode: FractalMode;
  center: [number, number];
  zoom: number;
  rotation: number;
  palette: PaletteName;
  overlays: string[];
  audioMode: 'bass-reactive' | 'static';
  time: number;
  createdAt: string;
};
