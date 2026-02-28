export type VFXEngineType = 'FLUID' | 'STARDUST' | 'CYBER';

export interface VFXPreset {
  name: string;
  engine: VFXEngineType; // New property to switch shader kernels
  fade: number;
  brushR: number;
  stretch: number;
  warp: number;
  curl: number;
  diff: number;
  hue: number;
  hueRange: number;
  bloomS: number;
  bloomR: number;
  bloomT: number;
  ab: number; // Chromatic aberration
  rb: number; // Radial blur
  scan: number; // Scanlines
  grain: number;
}

export interface HandData {
  x: number; // 0..1 (Normalized, mirror corrected)
  y: number; // 0..1
  z: number; // Depth approx
  isPinching: boolean;
  isOpenPalm: boolean;
  detected: boolean;
}

export const MODES: VFXPreset[] = [
  { 
    name: "Ice Beam", 
    engine: 'FLUID',
    fade: 0.985, brushR: 0.030, stretch: 2.2, warp: 0.0040, curl: 0.010, diff: 0.10, 
    hue: 205, hueRange: 16, bloomS: 1.35, bloomR: 0.45, bloomT: 0.10, 
    ab: 0.0020, rb: 0.12, scan: 0.20, grain: 0.18 
  },
  { 
    name: "Stardust", 
    engine: 'STARDUST',
    fade: 0.92, brushR: 0.05, stretch: 0.5, warp: 0.0, curl: 0.0, diff: 0.0, 
    hue: 40, hueRange: 60, bloomS: 2.5, bloomR: 0.8, bloomT: 0.1, 
    ab: 0.005, rb: 0.05, scan: 0.1, grain: 0.4 
  },
  { 
    name: "Cyber Grid", 
    engine: 'CYBER',
    fade: 0.96, brushR: 0.15, stretch: 1.0, warp: 0.02, curl: 0.0, diff: 0.0, 
    hue: 280, hueRange: 90, bloomS: 2.0, bloomR: 0.3, bloomT: 0.2, 
    ab: 0.008, rb: 0.3, scan: 0.8, grain: 0.1 
  },
  { 
    name: "Inferno", 
    engine: 'FLUID',
    fade: 0.975, brushR: 0.022, stretch: 3.0, warp: 0.0070, curl: 0.016, diff: 0.08, 
    hue: 10, hueRange: 34, bloomS: 1.75, bloomR: 0.55, bloomT: 0.14, 
    ab: 0.0030, rb: 0.16, scan: 0.30, grain: 0.22 
  },
  { 
    name: "Hyper Core", 
    engine: 'FLUID',
    fade: 0.982, brushR: 0.030, stretch: 3.4, warp: 0.0105, curl: 0.028, diff: 0.06, 
    hue: 200, hueRange: 50, bloomS: 2.10, bloomR: 0.75, bloomT: 0.12, 
    ab: 0.0042, rb: 0.22, scan: 0.45, grain: 0.28 
  }
];