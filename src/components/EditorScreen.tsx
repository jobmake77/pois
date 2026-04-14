import { useMemo, useRef } from "react";
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  RefObject,
  WheelEvent as ReactWheelEvent
} from "react";
import {
  ArrowLeft,
  ChevronDown,
  Download,
  Plus,
  RotateCcw,
  Shuffle,
  Upload,
  X
} from "lucide-react";
import { resolveCanvasRegions } from "../render/blockLayout";
import {
  clampPhotoCrop,
  scalePhotoCropFromAnchor,
  translatePhotoCrop
} from "../render/crop";
import { clamp } from "../render/random";
import type {
  BaseStyle,
  CanvasPreset,
  DotSettings,
  ExportFormat,
  FillMode,
  LayoutDirection,
  LayoutMode,
  LayoutSettings,
  PanelKey,
  PhotoCrop,
  ProjectState,
  ShapeKind,
  SourceAsset,
  ThemePreset
} from "../types";

interface EditorScreenProps {
  project: ProjectState;
  theme: ThemePreset;
  themes: ThemePreset[];
  sources: SourceAsset[];
  previewStatus: string;
  renderTime: number | null;
  exportPending: boolean;
  activePanel: PanelKey;
  previewRef: RefObject<HTMLCanvasElement>;
  onActivePanelChange: (panel: PanelKey) => void;
  onThemeChange: (themeId: string) => void;
  onSelectSource: (sourceId: string) => void;
  onDeleteSource: (sourceId: string) => void;
  onOpenMoreFiles: () => void;
  onSetPhotoCrop: (photoId: string, crop: PhotoCrop) => void;
  onUpdateLayout: (patch: Partial<LayoutSettings>) => void;
  onSetLayoutMode: (layoutMode: LayoutMode) => void;
  onSetLayoutDirection: (layoutDirection: LayoutDirection) => void;
  onSetFillBlockEnabled: (enabled: boolean) => void;
  onSetFillBlockDotsEnabled: (enabled: boolean) => void;
  onResetTheme: () => void;
  onUpdateBase: (patch: Partial<ProjectState["base"]>) => void;
  onUpdateDots: (patch: Partial<DotSettings>) => void;
  onUpdateExportFormat: (format: ExportFormat) => void;
  onRandomize: () => void;
  onExport: () => void;
  onBack: () => void;
}

type PointerMap = Map<number, { x: number; y: number }>;

interface GestureState {
  photoId: string | null;
  pointers: PointerMap;
  dragOrigin: { x: number; y: number } | null;
  dragCrop: PhotoCrop | null;
  pinchOrigin:
    | {
        distance: number;
        centerX: number;
        centerY: number;
        anchorX: number;
        anchorY: number;
        crop: PhotoCrop;
      }
    | null;
}

export function EditorScreen({
  project,
  theme,
  themes,
  sources,
  previewStatus,
  renderTime,
  exportPending,
  activePanel,
  previewRef,
  onActivePanelChange,
  onThemeChange,
  onSelectSource,
  onDeleteSource,
  onOpenMoreFiles,
  onSetPhotoCrop,
  onUpdateLayout,
  onSetLayoutMode,
  onSetLayoutDirection,
  onSetFillBlockEnabled,
  onSetFillBlockDotsEnabled,
  onResetTheme,
  onUpdateBase,
  onUpdateDots,
  onUpdateExportFormat,
  onRandomize,
  onExport,
  onBack
}: EditorScreenProps) {
  const gestureRef = useRef<GestureState>({
    photoId: null,
    pointers: new Map(),
    dragOrigin: null,
    dragCrop: null,
    pinchOrigin: null
  });

  const regions = useMemo(
    () => resolveCanvasRegions(project, project.canvasWidth, project.canvasHeight),
    [project]
  );

  const photoRegions = useMemo(
    () =>
      regions
        .filter((region) => region.kind === "photo" && region.photoId)
        .map((region) => {
          const source = sources.find((candidate) => candidate.id === region.photoId);
          if (!source) {
            return null;
          }
          return {
            photoId: source.id,
            source,
            region,
            style: {
              left: `${(region.rect.x / project.canvasWidth) * 100}%`,
              top: `${(region.rect.y / project.canvasHeight) * 100}%`,
              width: `${(region.rect.width / project.canvasWidth) * 100}%`,
              height: `${(region.rect.height / project.canvasHeight) * 100}%`
            }
          };
        })
        .filter(Boolean) as Array<{
        photoId: string;
        source: SourceAsset;
        region: ReturnType<typeof resolveCanvasRegions>[number];
        style: Record<string, string>;
      }>,
    [project, regions, sources]
  );

  const activeCrop = project.activePhotoId
    ? project.photoCrops[project.activePhotoId] ?? { x: 0, y: 0, scale: 1 }
    : null;
  const activeRegion = photoRegions.find((item) => item.photoId === project.activePhotoId);
  const previewShellStyle = {
    aspectRatio: `${project.canvasWidth} / ${project.canvasHeight}`,
    "--poster-ratio": String(project.canvasWidth / project.canvasHeight)
  } as CSSProperties;

  const startGesture = (
    event: ReactPointerEvent<HTMLButtonElement>,
    regionModel: (typeof photoRegions)[number]
  ) => {
    const photoId = regionModel.photoId;
    if (project.activePhotoId !== photoId) {
      onSelectSource(photoId);
    }

    const crop = clampPhotoCrop(
      project.photoCrops[photoId] ?? { x: 0, y: 0, scale: 1 },
      regionModel.source.width,
      regionModel.source.height,
      regionModel.region.rect.width,
      regionModel.region.rect.height
    );
    const state = gestureRef.current;
    if (state.photoId !== photoId) {
      state.pointers = new Map();
    }
    state.photoId = photoId;
    state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (state.pointers.size === 1) {
      state.dragOrigin = { x: event.clientX, y: event.clientY };
      state.dragCrop = crop;
      state.pinchOrigin = null;
    }

    if (state.pointers.size === 2) {
      const points = Array.from(state.pointers.values());
      const bounds = event.currentTarget.getBoundingClientRect();
      state.dragOrigin = null;
      state.dragCrop = null;
      state.pinchOrigin = {
        distance: getDistance(points[0], points[1]),
        centerX: (points[0].x + points[1].x) / 2,
        centerY: (points[0].y + points[1].y) / 2,
        anchorX: clamp((((points[0].x + points[1].x) / 2) - bounds.left) / bounds.width, 0, 1),
        anchorY: clamp((((points[0].y + points[1].y) / 2) - bounds.top) / bounds.height, 0, 1),
        crop
      };
    }

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveGesture = (
    event: ReactPointerEvent<HTMLButtonElement>,
    regionModel: (typeof photoRegions)[number]
  ) => {
    const photoId = regionModel.photoId;
    const state = gestureRef.current;
    if (state.photoId !== photoId || !state.pointers.has(event.pointerId)) {
      return;
    }

    state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const currentCrop = clampPhotoCrop(
      project.photoCrops[photoId] ?? { x: 0, y: 0, scale: 1 },
      regionModel.source.width,
      regionModel.source.height,
      regionModel.region.rect.width,
      regionModel.region.rect.height
    );
    const width = event.currentTarget.clientWidth || 1;
    const height = event.currentTarget.clientHeight || 1;

    if (state.pointers.size >= 2 && state.pinchOrigin) {
      const points = Array.from(state.pointers.values());
      const nextDistance = getDistance(points[0], points[1]);
      const nextCenterX = (points[0].x + points[1].x) / 2;
      const nextCenterY = (points[0].y + points[1].y) / 2;
      const nextScale = clamp(
        state.pinchOrigin.crop.scale *
          Math.pow(nextDistance / Math.max(1, state.pinchOrigin.distance), 0.92),
        0.2,
        2.6
      );
      const scaledCrop = scalePhotoCropFromAnchor(
        state.pinchOrigin.crop,
        nextScale,
        state.pinchOrigin.anchorX,
        state.pinchOrigin.anchorY,
        regionModel.source.width,
        regionModel.source.height,
        regionModel.region.rect.width,
        regionModel.region.rect.height
      );
      const dx = nextCenterX - state.pinchOrigin.centerX;
      const dy = nextCenterY - state.pinchOrigin.centerY;
      onSetPhotoCrop(
        photoId,
        translatePhotoCrop(
          scaledCrop,
          dx,
          dy,
          regionModel.source.width,
          regionModel.source.height,
          regionModel.region.rect.width,
          regionModel.region.rect.height
        )
      );
      return;
    }

    if (state.pointers.size === 1 && state.dragOrigin && state.dragCrop) {
      const dx = event.clientX - state.dragOrigin.x;
      const dy = event.clientY - state.dragOrigin.y;
      onSetPhotoCrop(
        photoId,
        translatePhotoCrop(
          state.dragCrop,
          dx,
          dy,
          regionModel.source.width,
          regionModel.source.height,
          regionModel.region.rect.width,
          regionModel.region.rect.height
        )
      );
    }
  };

  const endGesture = (
    event: ReactPointerEvent<HTMLButtonElement>,
    regionModel: (typeof photoRegions)[number]
  ) => {
    const photoId = regionModel.photoId;
    const state = gestureRef.current;
    if (state.photoId !== photoId) {
      return;
    }

    state.pointers.delete(event.pointerId);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // ignore capture release failures
    }

    const crop = clampPhotoCrop(
      project.photoCrops[photoId] ?? { x: 0, y: 0, scale: 1 },
      regionModel.source.width,
      regionModel.source.height,
      regionModel.region.rect.width,
      regionModel.region.rect.height
    );
    if (state.pointers.size === 1) {
      const remaining = Array.from(state.pointers.values())[0];
      state.dragOrigin = remaining;
      state.dragCrop = crop;
      state.pinchOrigin = null;
      return;
    }

    if (state.pointers.size === 0) {
      state.photoId = null;
      state.dragOrigin = null;
      state.dragCrop = null;
      state.pinchOrigin = null;
    }
  };

  const handleWheel = (
    event: ReactWheelEvent<HTMLButtonElement>,
    regionModel: (typeof photoRegions)[number]
  ) => {
    const photoId = regionModel.photoId;
    event.preventDefault();
    if (project.activePhotoId !== photoId) {
      onSelectSource(photoId);
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    const anchorX = clamp((event.clientX - bounds.left) / bounds.width, 0, 1);
    const anchorY = clamp((event.clientY - bounds.top) / bounds.height, 0, 1);
    const crop = project.photoCrops[photoId] ?? { x: 0, y: 0, scale: 1 };
    const delta = event.deltaY < 0 ? 0.06 : -0.06;
    onSetPhotoCrop(
      photoId,
      scalePhotoCropFromAnchor(
        crop,
        clamp(crop.scale + delta, 0.2, 2.6),
        anchorX,
        anchorY,
        regionModel.source.width,
        regionModel.source.height,
        regionModel.region.rect.width,
        regionModel.region.rect.height
      )
    );
  };

  return (
    <main className="screen editor-screen editor-reference-screen">
      <header className="editor-header editor-reference-toolbar">
        <div className="editor-header-left">
          <button className="icon-chip reference-back-chip" onClick={onBack}>
            <ArrowLeft size={14} />
            <span>返回</span>
          </button>
          <div className="reference-title-group">
            <p className="eyebrow">POIS EDITOR</p>
            <h1>图片编辑框</h1>
          </div>
        </div>
        <p className="reference-toolbar-copy">只保留真实画板、真实裁切和可选填充块。</p>

        <div className="editor-header-actions">
          <div className="toolbar-group">
            <button className="secondary-button compact reference-action" onClick={onRandomize}>
              <Shuffle size={14} />
              <span>随机一下</span>
            </button>
            <button className="secondary-button compact reference-action" onClick={onResetTheme}>
              <RotateCcw size={14} />
              <span>重置风格</span>
            </button>
          </div>
          <div className="toolbar-group">
            <label className="inline-select reference-export-select">
              <span>导出 PNG</span>
              <select
                value={project.exportFormat}
                onChange={(event) => onUpdateExportFormat(event.target.value as ExportFormat)}
                aria-label="导出格式"
              >
                <option value="png">PNG</option>
                <option value="jpeg">JPEG</option>
              </select>
              <ChevronDown size={14} />
            </label>
            <button
              className="primary-button compact reference-primary-action"
              onClick={onExport}
              disabled={exportPending}
            >
              <Download size={14} />
              <span>{exportPending ? "导出中..." : "导出海报"}</span>
            </button>
          </div>
        </div>
      </header>

      <section className="image-strip-card editor-reference-strip">
        <div className="section-head reference-strip-head">
          <h2>图片栏</h2>
          <p>{`当前最多 2 张，删除直接点右上角。已加载 ${sources.length}/2`}</p>
        </div>
        <div className="image-chip-row reference-image-row">
          {sources.map((source, index) => (
            <div
              key={source.id}
              className={`image-chip reference-image-chip ${source.id === project.activePhotoId ? "active" : ""}`}
            >
              <button className="image-chip-select" onClick={() => onSelectSource(source.id)}>
                <img src={source.objectUrl} alt={source.name} />
                <span>{`图片 ${index + 1}`}</span>
              </button>
              <button
                className="image-chip-close"
                onClick={() => onDeleteSource(source.id)}
                aria-label={`删除图片 ${index + 1}`}
              >
                <X size={12} />
              </button>
            </div>
          ))}
          {sources.length < 2 ? (
            <button className="image-chip add-chip reference-add-chip" onClick={onOpenMoreFiles}>
              <span className="add-chip-plus">
                <Plus size={22} />
              </span>
              <span>添加图片</span>
              <span className="image-chip-meta">{`${sources.length}/2`}</span>
            </button>
          ) : null}
        </div>
      </section>

      <section className="editor-main editor-reference-main">
        <div className="canvas-column reference-canvas-pane">
          <div className="reference-preview-status-row">
            <span className="reference-preview-status">{previewStatus}</span>
            <span className="reference-preview-time">
              {renderTime ? `${renderTime.toFixed(0)}ms` : "等待首帧"}
            </span>
          </div>

          <div className="reference-stage-area">
            <div className="reference-stage-center">
              {sources.length === 0 ? (
                <button
                  type="button"
                  className="reference-empty-poster"
                  onClick={onOpenMoreFiles}
                >
                  <div className="reference-empty-photo">
                    <Upload size={44} />
                    <span>上传图片开始编辑</span>
                  </div>
                  <div className="reference-empty-fill">
                    {Array.from({ length: 16 }).map((_, index) => (
                      <span
                        key={index}
                        className="reference-empty-dot"
                        style={{
                          left: `${10 + ((index * 13) % 60)}%`,
                          top: `${5 + ((index * 17) % 88)}%`,
                          width: `${10 + (index % 4) * 4}px`,
                          height: `${10 + (index % 4) * 4}px`
                        }}
                      />
                    ))}
                  </div>
                </button>
              ) : (
                <div className="preview-frame reference-preview-card">
                  <div className="preview-shell reference-preview-shell" style={previewShellStyle}>
                    <canvas ref={previewRef} className="preview-canvas" />

                    {photoRegions.map((region) => (
                      <button
                        key={region.photoId}
                        type="button"
                        className={`preview-hit-region ${
                          region.photoId === project.activePhotoId ? "active" : ""
                        }`}
                        style={region.style}
                        onClick={() => onSelectSource(region.photoId)}
                        onPointerDown={(event) => startGesture(event, region)}
                        onPointerMove={(event) => moveGesture(event, region)}
                        onPointerUp={(event) => endGesture(event, region)}
                        onPointerCancel={(event) => endGesture(event, region)}
                        onWheel={(event) => handleWheel(event, region)}
                        aria-label={`编辑 ${region.source.name}`}
                      />
                    ))}

                    {activeRegion && activeCrop ? (
                      <div className="zoom-chip" style={getZoomChipStyle(activeRegion.style)}>
                        <button
                          type="button"
                          onClick={() =>
                            onSetPhotoCrop(
                              project.activePhotoId,
                              scalePhotoCropFromAnchor(
                                activeCrop,
                                clamp(activeCrop.scale - 0.06, 0.2, 2.6),
                                0.5,
                                0.5,
                                activeRegion.source.width,
                                activeRegion.source.height,
                                activeRegion.region.rect.width,
                                activeRegion.region.rect.height
                              )
                            )
                          }
                          aria-label="缩小"
                        >
                          -
                        </button>
                        <span>{`${Math.round(activeCrop.scale * 100)}%`}</span>
                        <button
                          type="button"
                          onClick={() =>
                            onSetPhotoCrop(
                              project.activePhotoId,
                              scalePhotoCropFromAnchor(
                                activeCrop,
                                clamp(activeCrop.scale + 0.06, 0.2, 2.6),
                                0.5,
                                0.5,
                                activeRegion.source.width,
                                activeRegion.source.height,
                                activeRegion.region.rect.width,
                                activeRegion.region.rect.height
                              )
                            )
                          }
                          aria-label="放大"
                        >
                          +
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="reference-stage-foot">
            <span>{project.fillBlockEnabled ? "填充块已开启" : "填充块已关闭"}</span>
            <span>桌面端可滚轮缩放、拖动平移</span>
          </div>
        </div>

        <aside className="editor-sidebar reference-sidebar">
          <div className="sidebar-panel-tabs">
            {([["layout", "布局"], ["fill", "填充块"], ["dots", "波点"]] as [PanelKey, string][]).map(
              ([key, label]) => (
                <button
                  key={key}
                  className={`sidebar-tab ${activePanel === key ? "active" : ""}`}
                  onClick={() => onActivePanelChange(key)}
                >
                  {label}
                </button>
              )
            )}
          </div>

          <div className={`panel-card sidebar-panel reference-panel ${activePanel === "layout" ? "active-mobile-panel" : ""}`}>
            <LayoutPanel
              photoCount={sources.length}
              layoutDirection={project.layoutDirection}
              fillBlockEnabled={project.fillBlockEnabled}
              value={project.layout}
              onLayoutModeChange={onSetLayoutMode}
              onDirectionChange={onSetLayoutDirection}
              onFillToggle={onSetFillBlockEnabled}
              onChange={onUpdateLayout}
            />
          </div>

          <div className={`panel-card sidebar-panel reference-panel ${activePanel === "fill" ? "active-mobile-panel" : ""}`}>
            <FillPanel
              photoCount={sources.length}
              theme={theme}
              themes={themes}
              value={project.base}
              fillBlockEnabled={project.fillBlockEnabled}
              fillBlockDotsEnabled={project.fillBlockDotsEnabled}
              onFillToggle={onSetFillBlockEnabled}
              onFillDotsToggle={onSetFillBlockDotsEnabled}
              onThemeChange={onThemeChange}
              onChange={onUpdateBase}
            />
          </div>

          <div className={`panel-card sidebar-panel reference-panel ${activePanel === "dots" ? "active-mobile-panel" : ""}`}>
            <DotsPanel
              value={project.dots}
              fillBlockEnabled={project.fillBlockEnabled}
              onChange={onUpdateDots}
            />
          </div>
        </aside>
      </section>
    </main>
  );
}

function LayoutPanel({
  photoCount,
  layoutDirection,
  fillBlockEnabled,
  value,
  onLayoutModeChange,
  onDirectionChange,
  onFillToggle,
  onChange
}: {
  photoCount: number;
  layoutDirection: LayoutDirection;
  fillBlockEnabled: boolean;
  value: LayoutSettings;
  onLayoutModeChange: (layoutMode: LayoutMode) => void;
  onDirectionChange: (layoutDirection: LayoutDirection) => void;
  onFillToggle: (enabled: boolean) => void;
  onChange: (patch: Partial<LayoutSettings>) => void;
}) {
  const isSingle = photoCount <= 1;
  const options = [
    {
      key: "horizontal",
      label: "左右分块",
      description: isSingle ? "单图时搭配右侧填充块，双图时左右并排。" : "两张照片左右展示。"
    },
    {
      key: "vertical",
      label: "上下分块",
      description: isSingle ? "单图时搭配下方填充块，双图时上下并排。" : "两张照片上下展示。"
    }
  ];

  const applyDirection = (direction: LayoutDirection) => {
    onLayoutModeChange(isSingle ? "single" : "double");
    onDirectionChange(direction);
    if (isSingle && !fillBlockEnabled) {
      onFillToggle(true);
    }
  };

  return (
    <div className="panel-grid">
      <div className="panel-section-head">
        <span className="panel-kicker">Layout</span>
        <h2>布局</h2>
        <p>这里只保留左右和上下两种分块，单图或双图由当前图片数量自动决定。</p>
      </div>

      <div className="choice-grid compact-two">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            className={`choice-card ${layoutDirection === option.key ? "active" : ""}`}
            onClick={() => applyDirection(option.key as LayoutDirection)}
          >
            <span>{option.label}</span>
            <small>{option.description}</small>
          </button>
        ))}
      </div>

      <ControlSelect
        label="画幅"
        value={value.canvasPreset}
        options={[
          { label: "海报 5:6.4", value: "poster" },
          { label: "正方形", value: "square" },
          { label: "Story", value: "story" },
          { label: "横版", value: "landscape" }
        ]}
        onChange={(next) => onChange({ canvasPreset: next as CanvasPreset })}
      />
      <ControlRange
        label="留白"
        min={0}
        max={40}
        step={1}
        value={value.padding}
        onChange={(next) => onChange({ padding: next })}
      />
      <ControlRange
        label="块间距"
        min={0}
        max={24}
        step={1}
        value={value.gap}
        onChange={(next) => onChange({ gap: next })}
      />
      <ControlRange
        label="填充块占比"
        min={14}
        max={28}
        step={1}
        value={Math.round(value.fillRatio * 100)}
        onChange={(next) => onChange({ fillRatio: next / 100 })}
      />
    </div>
  );
}

function FillPanel({
  photoCount,
  theme,
  themes,
  value,
  fillBlockEnabled,
  fillBlockDotsEnabled,
  onFillToggle,
  onFillDotsToggle,
  onThemeChange,
  onChange
}: {
  photoCount: number;
  theme: ThemePreset;
  themes: ThemePreset[];
  value: ProjectState["base"];
  fillBlockEnabled: boolean;
  fillBlockDotsEnabled: boolean;
  onFillToggle: (enabled: boolean) => void;
  onFillDotsToggle: (enabled: boolean) => void;
  onThemeChange: (themeId: string) => void;
  onChange: (patch: Partial<ProjectState["base"]>) => void;
}) {
  const baseSwatches = [
    {
      key: "solid",
      label: "纯色底",
      tone: value.primaryColor
    },
    {
      key: "stripes",
      label: "横条纹",
      tone: `repeating-linear-gradient(180deg, ${value.primaryColor} 0 12px, ${value.secondaryColor} 12px 22px)`
    },
    {
      key: "duotone",
      label: "双色底",
      tone: `linear-gradient(145deg, ${value.primaryColor}, ${value.secondaryColor})`
    },
    {
      key: "pixel",
      label: "像素底",
      tone: `linear-gradient(45deg, ${value.primaryColor} 25%, ${value.secondaryColor} 25%, ${value.secondaryColor} 50%, ${value.primaryColor} 50%, ${value.primaryColor} 75%, ${value.secondaryColor} 75%)`
    }
  ];

  return (
    <div className="panel-grid">
      <div className="panel-section-head">
        <span className="panel-kicker">Fill Block</span>
        <h2>填充块</h2>
        <p>{photoCount <= 1 ? "单图默认开启。" : "双图时可以手动打开填充块。"}</p>
      </div>

      <div className="toggle-row">
        <button
          type="button"
          className={`toggle-pill ${fillBlockEnabled ? "active" : ""}`}
          onClick={() => onFillToggle(!fillBlockEnabled)}
        >
          {fillBlockEnabled ? "已启用填充块" : "启用填充块"}
        </button>
        <button
          type="button"
          className={`toggle-pill ${fillBlockDotsEnabled ? "active" : ""}`}
          onClick={() => onFillDotsToggle(!fillBlockDotsEnabled)}
          disabled={!fillBlockEnabled}
        >
          {fillBlockDotsEnabled ? "填充块显示波点" : "填充块隐藏波点"}
        </button>
      </div>

      <SwatchSection
        title="主题风格"
        subtitle="切换填充块的主配色和默认形状。"
        swatches={themes.map((item) => ({
          key: item.id,
          label: item.name,
          active: item.id === theme.id,
          tone: `linear-gradient(145deg, ${item.palette.primary}, ${item.palette.secondary})`,
          onClick: () => onThemeChange(item.id)
        }))}
      />

      <SwatchSection
        title="底板样式"
        subtitle="填充块只画在它自己的区域里。"
        swatches={baseSwatches.map((item) => ({
          key: item.key,
          label: item.label,
          active: item.key === value.style,
          tone: item.tone,
          onClick: () => onChange({ style: item.key as BaseStyle })
        }))}
      />

      <ControlColor
        label="主色"
        value={value.primaryColor}
        onChange={(next) => onChange({ primaryColor: next })}
      />
      <ControlColor
        label="辅色"
        value={value.secondaryColor}
        onChange={(next) => onChange({ secondaryColor: next })}
      />
      <ControlRange
        label="条纹粗细"
        min={24}
        max={64}
        step={1}
        value={value.stripeThickness}
        onChange={(next) => onChange({ stripeThickness: next })}
      />
    </div>
  );
}

function DotsPanel({
  value,
  fillBlockEnabled,
  onChange
}: {
  value: DotSettings;
  fillBlockEnabled: boolean;
  onChange: (patch: Partial<DotSettings>) => void;
}) {
  const shapeSwatches = [
    { key: "star", label: "五角星", symbol: "★" },
    { key: "drop", label: "水滴", symbol: "◉" },
    { key: "snowflake", label: "雪花", symbol: "✳" },
    { key: "circle", label: "圆点", symbol: "●" },
    { key: "square", label: "方块", symbol: "■" },
    { key: "text", label: "文本", symbol: "T" }
  ];

  return (
    <div className="panel-grid">
      <div className="panel-section-head">
        <span className="panel-kicker">Dots</span>
        <h2>波点</h2>
        <p>默认已经调得更大、更密，进来就能直接看到效果。</p>
      </div>

      <SwatchSection
        title="形状"
        subtitle="圆形缩略选择，不再整页平铺。"
        swatches={shapeSwatches.map((item) => ({
          key: item.key,
          label: item.label,
          active: item.key === value.shape,
          tone: "linear-gradient(145deg, #ffffff, #e9edf2)",
          icon: item.symbol,
          onClick: () => onChange({ shape: item.key as ShapeKind })
        }))}
      />

      {value.shape === "text" && (
        <>
          <div className="control-group">
            <label className="control-label">文本内容</label>
            <input
              type="text"
              value={value.textContent}
              onChange={(e) => onChange({ textContent: e.target.value })}
              className="control-input"
              placeholder="输入文本"
            />
          </div>
          <ControlRange
            label="字体大小"
            min={8}
            max={40}
            step={1}
            value={value.fontSize}
            onChange={(next) => onChange({ fontSize: next })}
          />
        </>
      )}

      <ControlSelect
        label="采样方式"
        value={value.fillMode}
        options={[
          { label: "图片切片", value: "image-cutout" },
          { label: "颜色采样", value: "color-sample" },
          { label: "纯色填充", value: "solid" }
        ]}
        onChange={(next) => onChange({ fillMode: next as FillMode })}
      />
      <ControlSelect
        label="照片块分布"
        value={value.photoBlockDistribution}
        options={[
          { label: "随机散布", value: "random" },
          { label: "均匀散布", value: "grid" },
          { label: "轻微下沉", value: "bottom-heavy" }
        ]}
        onChange={(next) =>
          onChange({
            distribution: next as DotSettings["distribution"],
            photoBlockDistribution: next as DotSettings["photoBlockDistribution"]
          })
        }
      />
      <ControlSelect
        label="填充块分布"
        value={value.fillBlockDistribution}
        options={[
          { label: "随机散布", value: "random" },
          { label: "均匀散布", value: "grid" },
          { label: "轻微下沉", value: "bottom-heavy" }
        ]}
        onChange={(next) =>
          onChange({
            fillBlockDistribution: next as DotSettings["fillBlockDistribution"]
          })
        }
      />
      <ControlRange
        label="主照片占比"
        min={42}
        max={70}
        step={1}
        value={Math.round(value.primaryBlockShare * 100)}
        onChange={(next) => onChange({ primaryBlockShare: next / 100 })}
      />
      <ControlRange
        label="点大小"
        min={18}
        max={58}
        step={1}
        value={value.dotSize}
        onChange={(next) => onChange({ dotSize: next })}
      />
      <ControlRange
        label="大小差异"
        min={12}
        max={100}
        step={1}
        value={value.sizeVariance}
        onChange={(next) => onChange({ sizeVariance: next })}
      />
      <ControlRange
        label="总点数"
        min={12}
        max={48}
        step={1}
        value={value.dotCount}
        onChange={(next) => onChange({ dotCount: next })}
      />
      <ControlRange
        label="装饰点"
        min={0}
        max={32}
        step={1}
        value={value.decorativeCount}
        onChange={(next) => onChange({ decorativeCount: next })}
      />
      <ControlRange
        label="透明度"
        min={24}
        max={100}
        step={1}
        value={Math.round(value.opacity * 100)}
        onChange={(next) => onChange({ opacity: next / 100 })}
      />
      <div className="control-group">
        <label className="control-label">大小变化</label>
        <div className="control-checkbox">
          <input
            type="checkbox"
            checked={value.useSizeVariance}
            onChange={(e) => onChange({ useSizeVariance: e.target.checked })}
          />
          <span>启用波点大小变化</span>
        </div>
      </div>
      {!fillBlockEnabled ? <p className="panel-note">当前未启用填充块，相关波点只会出现在照片块里。</p> : null}
    </div>
  );
}

function SwatchSection({
  title,
  subtitle,
  swatches
}: {
  title: string;
  subtitle: string;
  swatches: Array<{
    key: string;
    label: string;
    active: boolean;
    tone: string;
    icon?: string;
    onClick: () => void;
  }>;
}) {
  return (
    <div className="swatch-section">
      <div className="section-head">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      <div className="swatch-row">
        {swatches.map((swatch) => (
          <button
            key={swatch.key}
            type="button"
            className={`swatch-card ${swatch.active ? "active" : ""}`}
            onClick={swatch.onClick}
            title={swatch.label}
          >
            <span className="swatch-circle" style={{ background: swatch.tone }}>
              {swatch.icon ? <span className="swatch-icon">{swatch.icon}</span> : null}
            </span>
            <span className="swatch-label">{swatch.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ControlRange({
  label,
  min,
  max,
  step,
  value,
  onChange
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="control-card">
      <span className="control-top">
        <span>{label}</span>
        <strong>{value}</strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function ControlSelect({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="control-card">
      <span className="control-top">
        <span>{label}</span>
      </span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ControlColor({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="control-card">
      <span className="control-top">
        <span>{label}</span>
        <strong>{value}</strong>
      </span>
      <input type="color" value={normalizeColor(value)} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function normalizeColor(color: string) {
  const trimmed = color.trim().toLowerCase();
  const isValidCssColor =
    trimmed.startsWith("#") ||
    trimmed.startsWith("rgb(") ||
    trimmed.startsWith("rgba(") ||
    trimmed.startsWith("hsl(") ||
    trimmed.startsWith("hwb(");
  return isValidCssColor ? color : "#2b6f89";
}

function getZoomChipStyle(style: Record<string, string>) {
  return {
    left: `calc(${style.left} + ${style.width} - 112px)`,
    top: `calc(${style.top} + 10px)`
  };
}

function getDistance(pointA: { x: number; y: number }, pointB: { x: number; y: number }) {
  const dx = pointA.x - pointB.x;
  const dy = pointA.y - pointB.y;
  return Math.sqrt(dx * dx + dy * dy);
}
