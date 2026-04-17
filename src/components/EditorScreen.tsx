import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  RefObject,
  WheelEvent as ReactWheelEvent
} from "react";
import {
  Download,
  Shuffle,
  Upload
} from "lucide-react";
import type { CanvasPanel } from "../render/blockLayout";
import {
  clampPhotoCrop,
  scalePhotoCropFromAnchor,
  translatePhotoCrop
} from "../render/crop";
import { clamp } from "../render/random";
import type {
  BaseStyle,
  BrushMode,
  DotSettings,
  PanelDirection,
  PanelKey,
  PhotoCrop,
  ProjectState,
  ShapeKind,
  SourceAsset
} from "../types";

interface EditorScreenProps {
  project: ProjectState;
  sources: SourceAsset[];
  previewStatus: string;
  renderTime: number | null;
  exportPending: boolean;
  activePanel: PanelKey;
  previewShellRef: RefObject<HTMLDivElement>;
  primaryPreviewRef: RefObject<HTMLCanvasElement>;
  secondaryPreviewRef: RefObject<HTMLCanvasElement>;
  previewPanels: CanvasPanel[];
  onActivePanelChange: (panel: PanelKey) => void;
  onOpenFillPhoto: () => void;
  onSetPhotoCrop: (photoId: string, crop: PhotoCrop) => void;
  onCommitDotStroke: (
    panelRole: "primary" | "secondary",
    points: Array<{ xRatio: number; yRatio: number }>
  ) => void;
  onUndoDotStroke: () => void;
  onClearDotStroke: () => void;
  manualDotCount: number;
  canUndoDotStroke: boolean;
  onSetPanelDirection: (panelDirection: PanelDirection) => void;
  onResetTheme: () => void;
  onUpdateBase: (patch: Partial<ProjectState["base"]>) => void;
  onUpdateDots: (patch: Partial<DotSettings>) => void;
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
  moved: boolean;
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

interface ViewTransform {
  x: number;
  y: number;
  scale: number;
}

interface BrushStrokeState {
  active: boolean;
  pointerId: number | null;
  panelRole: "primary" | "secondary" | null;
  bounds: DOMRect | null;
  points: Array<{ xRatio: number; yRatio: number }>;
  lastClientX: number;
  lastClientY: number;
}

type PhotoPanelModel = {
  panel: CanvasPanel;
  photoId: string;
  source: SourceAsset;
  style: Record<string, string>;
};

export function EditorScreen({
  project,
  sources,
  previewStatus,
  renderTime,
  exportPending,
  activePanel,
  previewShellRef,
  primaryPreviewRef,
  secondaryPreviewRef,
  previewPanels,
  onActivePanelChange,
  onOpenFillPhoto,
  onSetPhotoCrop,
  onCommitDotStroke,
  onUndoDotStroke,
  onClearDotStroke,
  manualDotCount,
  canUndoDotStroke,
  onSetPanelDirection,
  onResetTheme,
  onUpdateBase,
  onUpdateDots,
  onRandomize,
  onExport,
  onBack
}: EditorScreenProps) {
  const gestureRef = useRef<GestureState>({
    photoId: null,
    pointers: new Map(),
    dragOrigin: null,
    dragCrop: null,
    moved: false,
    pinchOrigin: null
  });
  const panRef = useRef<{ dragging: boolean; startX: number; startY: number; originX: number; originY: number }>({
    dragging: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0
  });
  const touchRef = useRef<{
    mode: "none" | "pan" | "pinch";
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    startDistance: number;
    startScale: number;
    centerX: number;
    centerY: number;
  }>({
    mode: "none",
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    startDistance: 0,
    startScale: 1,
    centerX: 0,
    centerY: 0
  });
  const [viewTransform, setViewTransform] = useState<ViewTransform>({
    x: 0,
    y: 0,
    scale: 1
  });
  const viewportRef = useRef<HTMLDivElement>(null);
  const brushStrokeRef = useRef<BrushStrokeState>({
    active: false,
    pointerId: null,
    panelRole: null,
    bounds: null,
    points: [],
    lastClientX: 0,
    lastClientY: 0
  });

  const photoPanels = useMemo(
    () => {
      return {
        items:
      previewPanels
        .filter((panel) => panel.kind === "photo" && panel.photoId && panel.role === "primary")
        .map((panel) => {
          const source = sources.find((candidate) => candidate.id === panel.photoId);
          if (!source) {
            return null;
          }
          return {
            panel,
            photoId: source.id,
            source,
            style: {
              left: `${panel.rect.x}px`,
              top: `${panel.rect.y}px`,
              width: `${panel.rect.width}px`,
              height: `${panel.rect.height}px`
            }
          };
        })
        .filter(Boolean) as PhotoPanelModel[]
      };
    },
    [previewPanels, sources]
  );
  const interactiveDotMode = project.dots.distribution !== "random";
  const brushPanels = useMemo(
    () => previewPanels.filter((panel) => panel.role === "primary" || panel.role === "secondary"),
    [previewPanels]
  );
  const distributionLabel = interactiveDotMode
    ? project.dots.distribution === "double-side"
      ? "双侧同步"
      : "单侧绘制"
    : "随机波点";
  const layoutLabel = project.panelDirection === "horizontal" ? "左右画板" : "上下画板";
  const interactionHint = interactiveDotMode
    ? "按住并拖拽画板添加波点"
    : "拖动照片调整取景";
  const viewportHint = "拖动画布平移 / 滚轮缩放 / 双击重置";

  const previewShellStyle = {
    aspectRatio: `${project.canvasWidth} / ${project.canvasHeight}`
  } as CSSProperties;
  const transformStyle = {
    transform: `translate(${viewTransform.x}px, ${viewTransform.y}px) scale(${viewTransform.scale})`
  };

  useEffect(() => {
    if (sources.length === 0) {
      setViewTransform({ x: 0, y: 0, scale: 1 });
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setViewTransform(getDefaultViewportTransform(viewportRef.current, previewShellRef.current));
    });

    return () => window.cancelAnimationFrame(frame);
  }, [
    previewShellRef,
    sources,
    project.canvasWidth,
    project.canvasHeight,
    project.panelDirection,
    project.primaryShare
  ]);

  const startGesture = (
    event: ReactPointerEvent<HTMLButtonElement>,
    panelModel: PhotoPanelModel
  ) => {
    event.stopPropagation();
    const photoId = panelModel.photoId;

    const crop = clampPhotoCrop(
      project.photoCrops[photoId] ?? { x: 0, y: 0, scale: 1, fitMode: "contain" },
      panelModel.source.width,
      panelModel.source.height,
      panelModel.panel.rect.width,
      panelModel.panel.rect.height
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
      state.moved = false;
      state.pinchOrigin = null;
    }

    if (state.pointers.size === 2) {
      const points = Array.from(state.pointers.values());
      const bounds = event.currentTarget.getBoundingClientRect();
      state.dragOrigin = null;
      state.dragCrop = null;
      state.moved = true;
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
    panelModel: PhotoPanelModel
  ) => {
    const photoId = panelModel.photoId;
    const state = gestureRef.current;
    if (state.photoId !== photoId || !state.pointers.has(event.pointerId)) {
      return;
    }

    event.stopPropagation();
    state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (state.pointers.size >= 2 && state.pinchOrigin) {
      state.moved = true;
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
        panelModel.source.width,
        panelModel.source.height,
        panelModel.panel.rect.width,
        panelModel.panel.rect.height
      );
      onSetPhotoCrop(
        photoId,
        translatePhotoCrop(
          scaledCrop,
          nextCenterX - state.pinchOrigin.centerX,
          nextCenterY - state.pinchOrigin.centerY,
          panelModel.source.width,
          panelModel.source.height,
          panelModel.panel.rect.width,
          panelModel.panel.rect.height
        )
      );
      return;
    }

    if (state.pointers.size === 1 && state.dragOrigin && state.dragCrop) {
      if (
        Math.abs(event.clientX - state.dragOrigin.x) > 3 ||
        Math.abs(event.clientY - state.dragOrigin.y) > 3
      ) {
        state.moved = true;
      }
      onSetPhotoCrop(
        photoId,
        translatePhotoCrop(
          state.dragCrop,
          event.clientX - state.dragOrigin.x,
          event.clientY - state.dragOrigin.y,
          panelModel.source.width,
          panelModel.source.height,
          panelModel.panel.rect.width,
          panelModel.panel.rect.height
        )
      );
    }
  };

  const endGesture = (
    event: ReactPointerEvent<HTMLButtonElement>,
    panelModel: PhotoPanelModel
  ) => {
    const photoId = panelModel.photoId;
    const state = gestureRef.current;
    if (state.photoId !== photoId) {
      return;
    }

    event.stopPropagation();
    state.pointers.delete(event.pointerId);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }

    if (state.pointers.size === 1) {
      const remaining = Array.from(state.pointers.values())[0];
      state.dragOrigin = remaining;
      state.dragCrop = project.photoCrops[photoId] ?? { x: 0, y: 0, scale: 1, fitMode: "contain" };
      state.moved = true;
      state.pinchOrigin = null;
      return;
    }

    if (state.pointers.size === 0) {
      state.photoId = null;
      state.dragOrigin = null;
      state.dragCrop = null;
      state.moved = false;
      state.pinchOrigin = null;
    }
  };

  const handlePhotoWheel = (
    event: ReactWheelEvent<HTMLButtonElement>,
    panelModel: PhotoPanelModel
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const crop = project.photoCrops[panelModel.photoId] ?? {
      x: 0,
      y: 0,
      scale: 1,
      fitMode: "contain" as const
    };
    const bounds = event.currentTarget.getBoundingClientRect();
    const anchorX = clamp((event.clientX - bounds.left) / bounds.width, 0, 1);
    const anchorY = clamp((event.clientY - bounds.top) / bounds.height, 0, 1);
    const nextScale = clamp(crop.scale + (event.deltaY < 0 ? 0.08 : -0.08), 1, 2.6);
    onSetPhotoCrop(
      panelModel.photoId,
      scalePhotoCropFromAnchor(
        crop,
        nextScale,
        anchorX,
        anchorY,
        panelModel.source.width,
        panelModel.source.height,
        panelModel.panel.rect.width,
        panelModel.panel.rect.height
      )
    );
  };

  const handleViewportWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const focusX = event.clientX - bounds.left - bounds.width / 2;
    const focusY = event.clientY - bounds.top - bounds.height / 2;
    const factor = event.deltaY < 0 ? 1.08 : 1 / 1.08;
    setViewTransform((current) => {
      const nextScale = clamp(current.scale * factor, 0.5, 3.5);
      return {
        x: focusX + (current.x - focusX) * (nextScale / current.scale),
        y: focusY + (current.y - focusY) * (nextScale / current.scale),
        scale: nextScale
      };
    });
  };

  const handleViewportPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest(".preview-hit-region")) {
      return;
    }
    panRef.current = {
      dragging: true,
      startX: event.clientX,
      startY: event.clientY,
      originX: viewTransform.x,
      originY: viewTransform.y
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleViewportPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!panRef.current.dragging) {
      return;
    }
    setViewTransform((current) => ({
      ...current,
      x: panRef.current.originX + (event.clientX - panRef.current.startX),
      y: panRef.current.originY + (event.clientY - panRef.current.startY)
    }));
  };

  const handleViewportPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    panRef.current.dragging = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  };

  const handleViewportTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest(".preview-hit-region")) {
      return;
    }
    if (event.touches.length === 1) {
      touchRef.current = {
        mode: "pan",
        startX: event.touches[0].clientX,
        startY: event.touches[0].clientY,
        originX: viewTransform.x,
        originY: viewTransform.y,
        startDistance: 0,
        startScale: viewTransform.scale,
        centerX: 0,
        centerY: 0
      };
      return;
    }
    if (event.touches.length === 2) {
      const center = getTouchCenter(event.touches[0], event.touches[1]);
      touchRef.current = {
        mode: "pinch",
        startX: center.x,
        startY: center.y,
        originX: viewTransform.x,
        originY: viewTransform.y,
        startDistance: getPointDistance(event.touches[0], event.touches[1]),
        startScale: viewTransform.scale,
        centerX: center.x,
        centerY: center.y
      };
    }
  };

  const handleViewportTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchRef.current.mode === "none") {
      return;
    }
    event.preventDefault();
    if (touchRef.current.mode === "pan" && event.touches.length === 1) {
      setViewTransform((current) => ({
        ...current,
        x: touchRef.current.originX + (event.touches[0].clientX - touchRef.current.startX),
        y: touchRef.current.originY + (event.touches[0].clientY - touchRef.current.startY)
      }));
      return;
    }
    if (touchRef.current.mode === "pinch" && event.touches.length === 2) {
      const nextDistance = getPointDistance(event.touches[0], event.touches[1]);
      const center = getTouchCenter(event.touches[0], event.touches[1]);
      setViewTransform((current) => {
        const nextScale = clamp(
          touchRef.current.startScale * (nextDistance / Math.max(1, touchRef.current.startDistance)),
          0.5,
          3.5
        );
        return {
          x: center.x + (touchRef.current.originX - center.x) * (nextScale / touchRef.current.startScale),
          y: center.y + (touchRef.current.originY - center.y) * (nextScale / touchRef.current.startScale),
          scale: nextScale
        };
      });
    }
  };

  const resetViewport = () => {
    setViewTransform(getDefaultViewportTransform(viewportRef.current, previewShellRef.current));
  };

  const startBrushStroke = (
    panelRole: "primary" | "secondary",
    event: ReactPointerEvent<HTMLButtonElement>
  ) => {
    if (!interactiveDotMode) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const firstPoint = toNormalizedPoint(bounds, event.clientX, event.clientY);
    brushStrokeRef.current = {
      active: true,
      pointerId: event.pointerId,
      panelRole,
      bounds,
      points: [firstPoint],
      lastClientX: event.clientX,
      lastClientY: event.clientY
    };
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveBrushStroke = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = brushStrokeRef.current;
    if (!current.active || current.pointerId !== event.pointerId || !current.bounds) {
      return;
    }

    event.stopPropagation();
    const nextPoints = createStrokePoints(
      current.bounds,
      current.lastClientX,
      current.lastClientY,
      event.clientX,
      event.clientY
    );
    if (nextPoints.length > 0) {
      current.points.push(...nextPoints);
      current.lastClientX = event.clientX;
      current.lastClientY = event.clientY;
    }
  };

  const endBrushStroke = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = brushStrokeRef.current;
    if (!current.active || current.pointerId !== event.pointerId || !current.panelRole) {
      return;
    }

    event.stopPropagation();
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }

    onCommitDotStroke(current.panelRole, current.points);
    brushStrokeRef.current = {
      active: false,
      pointerId: null,
      panelRole: null,
      bounds: null,
      points: [],
      lastClientX: 0,
      lastClientY: 0
    };
  };

  return (
    <main className="screen editor-screen editor-reference-screen">
      <header className="editor-header editor-reference-toolbar">
        <div className="editor-header-left">
          <div className="reference-brand">POI</div>
        </div>

        <div className="editor-header-actions">
          <button className="secondary-button compact reference-action" onClick={onRandomize}>
            <Shuffle size={14} />
            <span>随机一下</span>
          </button>
          <button
            className="primary-button compact reference-primary-action"
            onClick={onExport}
            disabled={exportPending}
          >
            <Download size={14} />
            <span>{exportPending ? "导出 PNG 中..." : "导出 PNG"}</span>
          </button>
        </div>
      </header>

      <section className="editor-main editor-reference-main">
        <div className="canvas-column reference-canvas-pane">
          <div className="reference-preview-status-row">
            <div className="reference-status-cluster">
              <span className="reference-status-pill reference-status-pill-primary">{previewStatus}</span>
              <span className="reference-status-pill">
                {renderTime ? `${renderTime.toFixed(0)}ms` : "等待首帧"}
              </span>
            </div>

            <div className="reference-status-cluster reference-status-cluster-end">
              <span className="reference-status-pill">{layoutLabel}</span>
              <span className="reference-status-pill">{distributionLabel}</span>
            </div>
          </div>

          <div
            ref={viewportRef}
            className="reference-stage-area reference-results-viewport"
            onWheel={handleViewportWheel}
            onPointerDown={handleViewportPointerDown}
            onPointerMove={handleViewportPointerMove}
            onPointerUp={handleViewportPointerUp}
            onPointerCancel={handleViewportPointerUp}
            onDoubleClick={resetViewport}
            onTouchStart={handleViewportTouchStart}
            onTouchMove={handleViewportTouchMove}
            onTouchEnd={() => {
              touchRef.current.mode = "none";
            }}
          >
            <div className="reference-stage-center">
              {sources.length === 0 ? (
                <button
                  type="button"
                  className="reference-empty-poster"
                  onClick={onBack}
                >
                  <div className="reference-empty-photo">
                    <span className="reference-empty-icon">
                      <Upload size={42} />
                    </span>
                    <span>上传图片开始编辑</span>
                  </div>
                </button>
              ) : (
                <div className="preview-frame reference-preview-card">
                  <div className="reference-results-transform" style={transformStyle}>
                    <div
                      ref={previewShellRef}
                      className="preview-shell reference-preview-shell reference-results-shell"
                      style={previewShellStyle}
                    >
                      {previewPanels.map((panel) => (
                        <div
                          key={panel.id}
                          className={`preview-panel preview-panel-${panel.role} preview-panel-${panel.kind}`}
                          style={getPanelStyle(panel)}
                        >
                          <canvas
                            ref={panel.role === "primary" ? primaryPreviewRef : secondaryPreviewRef}
                            className="preview-canvas preview-panel-canvas"
                          />
                        </div>
                      ))}

                      {interactiveDotMode
                        ? brushPanels.map((panel) => (
                            <button
                              key={`brush-${panel.role}`}
                              type="button"
                              className="preview-hit-region preview-dot-hit dot-editable"
                              style={getPanelStyle(panel)}
                              onPointerDown={(event) => startBrushStroke(panel.role, event)}
                              onPointerMove={moveBrushStroke}
                              onPointerUp={endBrushStroke}
                              onPointerCancel={endBrushStroke}
                              aria-label={`在${panel.role === "primary" ? "主" : "副"}面板绘制波点`}
                            />
                          ))
                        : photoPanels.items.map((panelModel) => (
                            <button
                              key={panelModel.photoId}
                              type="button"
                              className="preview-hit-region preview-photo-hit active"
                              style={panelModel.style}
                              onPointerDown={(event) => startGesture(event, panelModel)}
                              onPointerMove={(event) => moveGesture(event, panelModel)}
                              onPointerUp={(event) => endGesture(event, panelModel)}
                              onPointerCancel={(event) => endGesture(event, panelModel)}
                              onWheel={(event) => handlePhotoWheel(event, panelModel)}
                              aria-label={`编辑 ${panelModel.source.name}`}
                            />
                          ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {sources.length === 0 ? null : (
            <div className="reference-stage-foot">
              <span>{interactionHint}</span>
              <span>{viewportHint}</span>
            </div>
          )}
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
              panelDirection={project.panelDirection}
              onDirectionChange={onSetPanelDirection}
            />
          </div>

          <div className={`panel-card sidebar-panel reference-panel ${activePanel === "fill" ? "active-mobile-panel" : ""}`}>
            <FillPanel
              value={project.base}
              onOpenFillPhoto={onOpenFillPhoto}
              onChange={onUpdateBase}
            />
          </div>

          <div className={`panel-card sidebar-panel reference-panel ${activePanel === "dots" ? "active-mobile-panel" : ""}`}>
            <DotsPanel
              value={project.dots}
              manualDotCount={manualDotCount}
              canUndo={canUndoDotStroke}
              onChange={onUpdateDots}
              onUndo={onUndoDotStroke}
              onClear={onClearDotStroke}
            />
          </div>
        </aside>
      </section>
    </main>
  );
}

function LayoutPanel({
  panelDirection,
  onDirectionChange
}: {
  panelDirection: PanelDirection;
  onDirectionChange: (panelDirection: PanelDirection) => void;
}) {
  const options = [
    { key: "horizontal", label: "左右分块" },
    { key: "vertical", label: "上下分块" }
  ];

  return (
    <div className="panel-grid">
      <div className="panel-section-head">
        <span className="panel-kicker">Layout</span>
        <h2>布局</h2>
      </div>

      <div className="choice-grid compact-two">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            className={`choice-card ${panelDirection === option.key ? "active" : ""}`}
            onClick={() => onDirectionChange(option.key as PanelDirection)}
          >
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function FillPanel({
  value,
  onOpenFillPhoto,
  onChange
}: {
  value: ProjectState["base"];
  onOpenFillPhoto: () => void;
  onChange: (patch: Partial<ProjectState["base"]>) => void;
}) {
  const baseSwatches = [
    { key: "solid", label: "纯色底", tone: value.primaryColor },
    {
      key: "stripes",
      label: "横条纹",
      tone: `repeating-linear-gradient(180deg, ${value.primaryColor} 0 12px, ${value.secondaryColor} 12px 22px)`
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
      </div>

      <div className="toggle-row">
        <button type="button" className="secondary-button compact" onClick={onOpenFillPhoto}>
          上传填充块照片
        </button>
      </div>

      <SwatchSection
        title="底板样式"
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
  manualDotCount,
  canUndo,
  onChange,
  onUndo,
  onClear
}: {
  value: DotSettings;
  manualDotCount: number;
  canUndo: boolean;
  onChange: (patch: Partial<DotSettings>) => void;
  onUndo: () => void;
  onClear: () => void;
}) {
  const shapeSwatches = [
    { key: "star", label: "五角星", symbol: "★" },
    { key: "drop", label: "水滴", symbol: "◉" },
    { key: "snowflake", label: "雪花", symbol: "✳" },
    { key: "circle", label: "圆形", symbol: "●" },
    { key: "heart", label: "爱心", symbol: "♥" },
    { key: "meteor", label: "流星", symbol: "☄" },
    { key: "butterfly", label: "蝴蝶", symbol: "🦋" },
    { key: "kitty", label: "Kitty", symbol: "🐱" },
    { key: "dog", label: "狗狗", symbol: "🐶" }
  ];

  return (
    <div className="panel-grid">
      <div className="panel-section-head">
        <span className="panel-kicker">Dots</span>
        <h2>波点</h2>
      </div>

      <SwatchSection
        title="形状"
        swatches={shapeSwatches.map((item) => ({
          key: item.key,
          label: item.label,
          active: item.key === value.shape,
          tone: "linear-gradient(145deg, #ffffff, #e9edf2)",
          icon: item.symbol,
          onClick: () => onChange({ shape: item.key as ShapeKind })
        }))}
      />

      <ControlSelect
        label="点位分布"
        value={value.distribution}
        options={[
          { label: "随机分布（自动生成）", value: "random" },
          { label: "单侧波点（拖拽当前面板绘制）", value: "single-side" },
          { label: "双侧波点（拖拽一侧，两侧同步）", value: "double-side" }
        ]}
        onChange={(next) => onChange({ distribution: next as DotSettings["distribution"] })}
      />
      {value.distribution === "random" ? null : (
        <>
          <ControlSelect
            label="画笔方式"
            value={value.brushMode}
            options={[
              { label: "相同形状", value: "same-size" },
              { label: "由大到小", value: "large-to-small" },
              { label: "由小到大", value: "small-to-large" }
            ]}
            onChange={(next) => onChange({ brushMode: next as BrushMode })}
          />
          <div className="control-group">
            <label className="control-label">手动画点</label>
            <div className="brush-tools-row">
              <span className="status-pill subtle">当前 {manualDotCount} 个</span>
              <button type="button" className="secondary-button compact" onClick={onUndo} disabled={!canUndo}>
                撤回
              </button>
              <button type="button" className="secondary-button compact" onClick={onClear} disabled={manualDotCount === 0}>
                清空
              </button>
            </div>
          </div>
          <p className="panel-note">
            当前是画笔模式。按住并拖拽画板新增波点，“总点数” 作为当前模式下的最大保留数量。
          </p>
        </>
      )}
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
            onChange={(event) => onChange({ useSizeVariance: event.target.checked })}
          />
          <span>启用波点大小变化</span>
        </div>
      </div>
    </div>
  );
}

function SwatchSection({
  title,
  subtitle,
  swatches
}: {
  title: string;
  subtitle?: string;
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
        {subtitle ? <p>{subtitle}</p> : null}
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
  return color.startsWith("#") ? color : "#2b6f89";
}

function getPanelStyle(panel: CanvasPanel) {
  return {
    left: `${panel.rect.x}px`,
    top: `${panel.rect.y}px`,
    width: `${panel.rect.width}px`,
    height: `${panel.rect.height}px`
  };
}

function getDefaultViewportTransform(
  viewport: HTMLDivElement | null,
  shell: HTMLDivElement | null
): ViewTransform {
  if (!viewport || !shell) {
    return { x: 0, y: 0, scale: 0.7071 };
  }

  const viewportWidth = viewport.clientWidth;
  const viewportHeight = viewport.clientHeight;
  const shellWidth = shell.clientWidth;
  const shellHeight = shell.clientHeight;
  if (viewportWidth <= 0 || viewportHeight <= 0 || shellWidth <= 0 || shellHeight <= 0) {
    return { x: 0, y: 0, scale: 0.7071 };
  }

  const currentAreaRatio = (shellWidth * shellHeight) / (viewportWidth * viewportHeight);
  const targetScale = clamp(
    Math.sqrt(0.5 / Math.max(currentAreaRatio, 0.0001)),
    0.42,
    1
  );

  return {
    x: 0,
    y: 0,
    scale: Number(targetScale.toFixed(4))
  };
}

function getDistance(
  pointA: { x: number; y: number },
  pointB: { x: number; y: number }
) {
  const dx = pointA.x - pointB.x;
  const dy = pointA.y - pointB.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function getPointDistance(
  pointA: { clientX: number; clientY: number },
  pointB: { clientX: number; clientY: number }
) {
  const dx = pointA.clientX - pointB.clientX;
  const dy = pointA.clientY - pointB.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function toNormalizedPoint(bounds: DOMRect, clientX: number, clientY: number) {
  return {
    xRatio: clamp((clientX - bounds.left) / Math.max(1, bounds.width), 0, 1),
    yRatio: clamp((clientY - bounds.top) / Math.max(1, bounds.height), 0, 1)
  };
}

function createStrokePoints(
  bounds: DOMRect,
  startX: number,
  startY: number,
  endX: number,
  endY: number
) {
  const distance = getPointDistance(
    { clientX: startX, clientY: startY },
    { clientX: endX, clientY: endY }
  );
  const stepDistance = 18;
  const steps = Math.max(1, Math.floor(distance / stepDistance));
  const points = [];

  for (let index = 1; index <= steps; index += 1) {
    const progress = index / steps;
    const clientX = startX + (endX - startX) * progress;
    const clientY = startY + (endY - startY) * progress;
    points.push(toNormalizedPoint(bounds, clientX, clientY));
  }

  return points;
}

function getTouchCenter(
  touchA: { clientX: number; clientY: number },
  touchB: { clientX: number; clientY: number }
) {
  return {
    x: (touchA.clientX + touchB.clientX) / 2,
    y: (touchA.clientY + touchB.clientY) / 2
  };
}
