export type Screen = "editor";
export type ShapeKind =
  | "star"
  | "drop"
  | "snowflake"
  | "circle"
  | "square"
  | "text"
  | "heart"
  | "meteor"
  | "butterfly"
  | "kitty";
export type BaseStyle = "solid" | "stripes" | "duotone" | "pixel";
export type Distribution = "random" | "single-side" | "double-side";
export type BrushMode = "same-size" | "large-to-small" | "small-to-large";
export type FillMode = "image-cutout" | "color-sample" | "solid";
export type PanelKey = "layout" | "fill" | "dots";
export type CanvasPreset = "poster" | "square" | "story" | "landscape";
export type ExportFormat = "png";
export type LayoutMode = "single" | "double";
export type PanelDirection = "horizontal" | "vertical";
export type LayoutDirection = PanelDirection;
export type PairedDotsMode = "auto";
export type PhotoFitMode = "contain" | "cover";

export interface SourceAsset {
  id: string;
  name: string;
  file: File;
  objectUrl: string;
  width: number;
  height: number;
  aspectRatio: number;
  image: CanvasImageSource;
  dominantColor: string;
}

export interface LayoutSettings {
  padding: number;
  gap: number;
  canvasPreset: CanvasPreset;
}

export interface BaseSettings {
  style: BaseStyle;
  primaryColor: string;
  secondaryColor: string;
  stripeThickness: number;
  backgroundTone: string;
}

export interface DotSettings {
  shape: ShapeKind;
  dotSize: number;
  sizeVariance: number;
  dotCount: number;
  decorativeCount: number;
  distribution: Distribution;
  brushMode: BrushMode;
  fillMode: FillMode;
  opacity: number;
  seed: number;
  textContent: string;
  fontSize: number;
  useSizeVariance: boolean;
}

export interface DotPlacement {
  id: string;
  xRatio: number;
  yRatio: number;
  profileSample: number;
  varianceSample: number;
  rotationSeed: number;
  sizeMultiplier?: number;
}

export interface DotStroke {
  id: string;
  bucket: "primary" | "secondary" | "shared";
  dotIds: string[];
}

export interface DotPlacementState {
  primary: DotPlacement[];
  secondary: DotPlacement[];
  shared: DotPlacement[];
  strokes: DotStroke[];
  nextId: number;
  nextStrokeId: number;
}

export interface PhotoCrop {
  x: number;
  y: number;
  scale: number;
  fitMode: PhotoFitMode;
}

export interface ThemePalette {
  primary: string;
  secondary: string;
  accent: string;
  surface: string;
}

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  palette: ThemePalette;
  layout: Partial<LayoutSettings>;
  base: Partial<BaseSettings>;
  dots: Partial<DotSettings>;
}

export interface ProjectState {
  id: string;
  themeId: string;
  photoIds: string[];
  fillPhotoId?: string;
  activePhotoId: string;
  photoCrops: Record<string, PhotoCrop>;
  dotPlacements: DotPlacementState;
  layoutMode: LayoutMode;
  panelDirection: PanelDirection;
  primaryShare: number;
  pairedDotsMode: PairedDotsMode;
  fillBlockEnabled: boolean;
  fillBlockDotsEnabled: boolean;
  layout: LayoutSettings;
  base: BaseSettings;
  dots: DotSettings;
  canvasWidth: number;
  canvasHeight: number;
  exportFormat: ExportFormat;
}

export interface RenderInput {
  project: ProjectState;
  theme: ThemePreset;
  sources: SourceAsset[];
  width: number;
  height: number;
  pixelRatio: number;
  exportQuality?: number;
}

export interface RenderOutput {
  blob: Blob;
  width: number;
  height: number;
  durationMs: number;
}

export interface ExportPreview {
  blob: Blob;
  url: string;
  durationMs: number;
}

export interface WorkerSourceInput {
  id: string;
  name: string;
  buffer: ArrayBuffer;
  mimeType: string;
}

export interface WorkerRenderInput {
  project: ProjectState;
  theme: ThemePreset;
  sources: WorkerSourceInput[];
  width: number;
  height: number;
  pixelRatio: number;
  exportQuality?: number;
  exportType?: string;
}
