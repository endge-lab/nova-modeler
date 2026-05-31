export const MODELER_GRID_RENDER_CONFIG = {
  minScreenSpacing: 9,
  minScreenSpacingLod: [
    { maxScale: 0.15, minScreenSpacing: 32 },
    { maxScale: 0.3, minScreenSpacing: 24 },
    { maxScale: 0.5, minScreenSpacing: 16 },
  ],
  maxDots: 32_000,
  dotRadiusScale: 1.05,
  minDotRadius: 0.25,
  maxDotRadius: 1.45,
} as const
