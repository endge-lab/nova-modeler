export const MODELER_THEME_TOKENS = {
  canvasBackground: '--modeler-canvas-background',
  canvasDotColor: '--modeler-canvas-dot-color',
  paletteBackground: '--modeler-palette-background',
  paletteBorderColor: '--modeler-palette-border-color',
  paletteItemHoverBackground: '--modeler-palette-item-hover-background',
  paletteItemPressedBackground: '--modeler-palette-item-pressed-background',
  paletteIconFill: '--modeler-palette-icon-fill',
  paletteIconStroke: '--modeler-palette-icon-stroke',
} as const

export const MODELER_THEME_FALLBACKS = {
  canvasBackground: '#eef3f8',
  canvasDotColor: 'rgba(100, 116, 139, 0.34)',
  paletteBackground: '#ffffff',
  paletteBorderColor: '#cbd5e1',
  paletteItemHoverBackground: '#eef2f7',
  paletteItemPressedBackground: '#e2e8f0',
  paletteIconFill: '#ffffff',
  paletteIconStroke: '#1f2937',
} as const
