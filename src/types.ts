export type Screen = "home" | "editor";
export type ShapeKind = "star" | "drop" | "snowflake" | "circle" | "square" | "text";
export type BaseStyle = "solid" | "stripes" | "duotone" | "pixel";
export type Distribution = "random" | "grid" | "bottom-heavy";
export type FillMode = "image-cutout" | "color-sample" | "solid";
export type PanelKey = "layout" | "fill" | "dots";
export type CanvasPreset = "poster" | "square" | "story" | "landscape";
export type ExportFormat = "png" | "jpeg";
export type LayoutMode = "single" | "double";
export type LayoutDirection = "horizontal" | "vertical";

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
  fillRatio: number;
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
  primaryBlockShare: number;
  photoBlockDistribution: Distribution;
  fillBlockDistribution: Distribution;
  fillMode: FillMode;
  opacity: number;
  seed: number;
  textContent: string;
  fontSize: number;
  useSizeVariance: boolean;
}

export interface PhotoCrop {
  x: number;
  y: number;
  scale: number;
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
  activePhotoId: string;
  photoCrops: Record<string, PhotoCrop>;
  layoutMode: LayoutMode;
  layoutDirection: LayoutDirection;
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
