import { useMemo, useRef, useState } from "react";
import type { PointerEvent, RefObject } from "react";
import type {
  BaseStyle,
  CandidatePreview,
  CanvasPreset,
  DotSettings,
  ExportFormat,
  FillMode,
  LayoutSettings,
  PanelKey,
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
  candidates: CandidatePreview[];
  previewStatus: string;
  renderTime: number | null;
  exportPending: boolean;
  activePanel: PanelKey;
  previewRef: RefObject<HTMLCanvasElement>;
  onActivePanelChange: (panel: PanelKey) => void;
  onThemeChange: (themeId: string) => void;
  onSelectSource: (sourceId: string) => void;
  onDeleteSource: (sourceId: string) => void;
  onCandidateSelect: (candidate: CandidatePreview) => void;
  onUpdateLayout: (patch: Partial<LayoutSettings>) => void;
  onAdjustCrop: (dx: number, dy: number) => void;
  onResetTheme: () => void;
  onOpenMoreFiles: () => void;
  onUpdateBase: (patch: Partial<ProjectState["base"]>) => void;
  onUpdateDots: (patch: Partial<DotSettings>) => void;
  onUpdateExportFormat: (format: ExportFormat) => void;
  onRandomize: () => void;
  onExport: () => void;
  onBack: () => void;
}

export function EditorScreen({
  project,
  theme,
  themes,
  sources,
  candidates,
  previewStatus,
  renderTime,
  exportPending,
  activePanel,
  previewRef,
  onActivePanelChange,
  onThemeChange,
  onSelectSource,
  onDeleteSource,
  onCandidateSelect,
  onUpdateLayout,
  onAdjustCrop,
  onResetTheme,
  onOpenMoreFiles,
  onUpdateBase,
  onUpdateDots,
  onUpdateExportFormat,
  onRandomize,
  onExport,
  onBack
}: EditorScreenProps) {
  const cropRef = useRef({
    pointerId: -1,
    x: 0,
    y: 0
  });
  const [showSources, setShowSources] = useState(false);

  const cropStyle = useMemo(() => {
    const inset = `${project.layout.padding}px`;
    return {
      left: inset,
      right: inset,
      top: inset,
      height: `calc((100% - (${project.layout.padding * 2}px)) * ${project.layout.splitRatio})`
    };
  }, [project.layout.padding, project.layout.splitRatio]);

  const visibleSources = useMemo(
    () => rotateSourcesForComposition(sources, project.activeSourceId, project.layout.compositionMode),
    [sources, project.activeSourceId, project.layout.compositionMode]
  );

  const hitRegions = useMemo(
    () => getHitRegions(visibleSources, project.layout.compositionMode),
    [visibleSources, project.layout.compositionMode]
  );

  const beginCrop = (event: PointerEvent<HTMLElement>, sourceId: string) => {
    if (sourceId !== project.activeSourceId) {
      onSelectSource(sourceId);
    }
    cropRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveCrop = (event: PointerEvent<HTMLElement>, sourceId: string) => {
    if (cropRef.current.pointerId !== event.pointerId) {
      return;
    }
    if (sourceId !== project.activeSourceId) {
      return;
    }
    const dx = event.clientX - cropRef.current.x;
    const dy = event.clientY - cropRef.current.y;
    cropRef.current.x = event.clientX;
    cropRef.current.y = event.clientY;
    onAdjustCrop(dx / 240, dy / 240);
  };

  const endCrop = (event: PointerEvent<HTMLElement>) => {
    if (cropRef.current.pointerId === event.pointerId) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      cropRef.current.pointerId = -1;
    }
  };

  return (
    <main className="screen editor-screen">
      <header className="editor-header">
        <button className="icon-chip" onClick={onBack}>
          返回
        </button>
        <div>
          <p className="eyebrow">实时预览</p>
          <h1>{theme.name}</h1>
        </div>
        <button className="primary-button compact" onClick={onExport} disabled={exportPending}>
          {exportPending ? "导出中..." : "生成高清"}
        </button>
      </header>

      <section className="quick-tools">
        <button className="secondary-button compact" onClick={onOpenMoreFiles}>
          添加图片
        </button>
        <button className="secondary-button compact" onClick={() => setShowSources((value) => !value)}>
          {showSources ? "收起图片" : `图片 ${sources.length}`}
        </button>
        <button className="secondary-button compact" onClick={onResetTheme}>
          重置风格
        </button>
        <div className="inline-select">
          <span>导出</span>
          <select
            value={project.exportFormat}
            onChange={(event) => onUpdateExportFormat(event.target.value as ExportFormat)}
          >
            <option value="png">PNG</option>
            <option value="jpeg">JPEG</option>
          </select>
        </div>
      </section>

      <section className="preview-stage">
        <div className="preview-frame">
          <div className="preview-shell" style={{ aspectRatio: `${project.canvasWidth} / ${project.canvasHeight}` }}>
            <canvas ref={previewRef} className="preview-canvas" />

            {hitRegions.map((region) => (
              <button
                key={region.source.id + region.key}
                className={`preview-hit-region ${region.source.id === project.activeSourceId ? "active" : ""}`}
                style={region.style}
                onClick={() => onSelectSource(region.source.id)}
                onPointerDown={(event) => beginCrop(event, region.source.id)}
                onPointerMove={(event) => moveCrop(event, region.source.id)}
                onPointerUp={endCrop}
                onPointerCancel={endCrop}
                aria-label={`选择 ${region.source.name}`}
              />
            ))}

            {project.activeSourceId ? (
              <button
                className="canvas-delete-button"
                onClick={() => onDeleteSource(project.activeSourceId)}
              >
                删除当前图片
              </button>
            ) : null}
            <div className="crop-overlay" style={cropStyle}>
              <span>直接拖动画布裁切主图</span>
            </div>
          </div>
        </div>

        <aside className="preview-meta">
          <div className="status-badge">{previewStatus}</div>
          <p>{renderTime ? `最近一次预览 ${renderTime.toFixed(0)}ms` : "等待首帧生成..."}</p>

          <SwatchSection
            title="主题"
            subtitle="点一下就切换，不再整屏平铺。"
            swatches={themes.map((item) => ({
              key: item.id,
              label: item.name,
              active: item.id === project.themeId,
              tone: `linear-gradient(145deg, ${item.palette.primary}, ${item.palette.secondary})`,
              onClick: () => onThemeChange(item.id)
            }))}
          />
        </aside>
      </section>

      {showSources ? (
        <section className="source-drawer">
          <div className="section-head">
            <h2>当前项目图片</h2>
            <p>点击切换当前编辑图，删除请直接在画布右上角操作。</p>
          </div>
          <div className="thumb-row">
            {sources.map((source) => (
              <button
                key={source.id}
                className={`thumb-card ${source.id === project.activeSourceId ? "active" : ""}`}
                onClick={() => onSelectSource(source.id)}
              >
                <img src={source.objectUrl} alt={source.name} />
                <span>{source.name}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="candidate-rail compact-rail">
        <div className="section-head">
          <h2>灵感候选</h2>
          <p>围绕当前图片快速试几种气质。</p>
        </div>
        <div className="candidate-row">
          {candidates.map((candidate) => (
            <button
              key={candidate.id}
              className="candidate-pill"
              onClick={() => onCandidateSelect(candidate)}
            >
              {candidate.label}
            </button>
          ))}
        </div>
      </section>

      <section className="panel-switch">
        {(["layout", "base", "dots"] as PanelKey[]).map((panel) => (
          <button
            key={panel}
            className={panel === activePanel ? "active" : ""}
            onClick={() => onActivePanelChange(panel)}
          >
            {panel === "layout" ? "布局" : panel === "base" ? "底板" : "波点"}
          </button>
        ))}
      </section>

      <section className="control-surface">
        {activePanel === "layout" ? (
          <LayoutPanel value={project.layout} onChange={onUpdateLayout} />
        ) : null}
        {activePanel === "base" ? (
          <BasePanel value={project.base} theme={theme} onChange={onUpdateBase} />
        ) : null}
        {activePanel === "dots" ? (
          <DotsPanel value={project.dots} onChange={onUpdateDots} />
        ) : null}
      </section>

      <footer className="sticky-footer">
        <button className="secondary-button" onClick={onRandomize}>
          随机一下
        </button>
        <button className="primary-button" onClick={onExport} disabled={exportPending}>
          {exportPending ? "正在生成..." : "保存 / 分享"}
        </button>
      </footer>
    </main>
  );
}

function LayoutPanel({
  value,
  onChange
}: {
  value: LayoutSettings;
  onChange: (patch: Partial<LayoutSettings>) => void;
}) {
  return (
    <div className="panel-grid">
      <ControlSelect
        label="画幅预设"
        value={value.canvasPreset}
        options={[
          { label: "海报 5:6.4", value: "poster" },
          { label: "正方形 1:1", value: "square" },
          { label: "竖版 Story", value: "story" },
          { label: "横版 16:10", value: "landscape" }
        ]}
        onChange={(next) => onChange({ canvasPreset: next as CanvasPreset })}
      />
      <ControlRange
        label="上下比例"
        min={38}
        max={72}
        step={1}
        value={Math.round(value.splitRatio * 100)}
        onChange={(next) => onChange({ splitRatio: next / 100 })}
      />
      <ControlRange
        label="留白边距"
        min={0}
        max={40}
        step={1}
        value={value.padding}
        onChange={(next) => onChange({ padding: next })}
      />
      <ControlRange
        label="主图横向位置"
        min={-100}
        max={100}
        step={1}
        value={Math.round(value.cropX * 100)}
        onChange={(next) => onChange({ cropX: next / 100 })}
      />
      <ControlRange
        label="主图纵向位置"
        min={-100}
        max={100}
        step={1}
        value={Math.round(value.cropY * 100)}
        onChange={(next) => onChange({ cropY: next / 100 })}
      />
      <ControlSelect
        label="顶部排版"
        value={value.compositionMode}
        options={[
          { label: "单张主图", value: "single" },
          { label: "双列主图", value: "duo" },
          { label: "三联主图", value: "triptych" }
        ]}
        onChange={(next) =>
          onChange({ compositionMode: next as LayoutSettings["compositionMode"] })
        }
      />
      <ControlToggle
        label="全画布装饰点"
        value={value.decorativeEverywhere}
        onChange={(next) => onChange({ decorativeEverywhere: next })}
      />
    </div>
  );
}

function BasePanel({
  value,
  theme,
  onChange
}: {
  value: ProjectState["base"];
  theme: ThemePreset;
  onChange: (patch: Partial<ProjectState["base"]>) => void;
}) {
  const baseSwatches = [
    { key: "solid", label: "纯色底", tone: value.primaryColor },
    {
      key: "stripes",
      label: "横条纹",
      tone: `repeating-linear-gradient(135deg, ${value.primaryColor} 0 10px, ${value.secondaryColor} 10px 18px)`
    },
    {
      key: "duotone",
      label: "深浅双色",
      tone: `linear-gradient(135deg, ${value.primaryColor}, ${value.secondaryColor})`
    },
    {
      key: "pixel",
      label: "像素底",
      tone: `linear-gradient(45deg, ${value.primaryColor} 25%, ${value.secondaryColor} 25%, ${value.secondaryColor} 50%, ${value.primaryColor} 50%, ${value.primaryColor} 75%, ${value.secondaryColor} 75%)`
    }
  ];

  return (
    <div className="panel-grid">
      <SwatchSection
        title="底板风格"
        subtitle="圆形预览点着切，不再一条条平铺。"
        swatches={baseSwatches.map((item) => ({
          key: item.key,
          label: item.label,
          active: item.key === value.style,
          tone: item.tone,
          onClick: () => onChange({ style: item.key as BaseStyle })
        }))}
      />
      <div className="theme-note-card">
        <span className="theme-note-chip">当前主题</span>
        <strong>{theme.name}</strong>
        <p>底板颜色会跟着主题走，也可以在下面再手动微调。</p>
      </div>
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
        min={8}
        max={42}
        step={1}
        value={value.stripeThickness}
        onChange={(next) => onChange({ stripeThickness: next })}
      />
    </div>
  );
}

function DotsPanel({
  value,
  onChange
}: {
  value: DotSettings;
  onChange: (patch: Partial<DotSettings>) => void;
}) {
  const shapeSwatches = [
    { key: "star", label: "五角星", symbol: "★" },
    { key: "drop", label: "水滴", symbol: "◉" },
    { key: "snowflake", label: "雪花", symbol: "✳" },
    { key: "circle", label: "圆点", symbol: "●" },
    { key: "square", label: "方块", symbol: "■" }
  ];

  const balanceValue =
    value.topShare >= 0.54 ? "top-heavy" : value.topShare <= 0.46 ? "bottom-heavy" : "balanced";

  return (
    <div className="panel-grid">
      <SwatchSection
        title="波点形状"
        subtitle="改成圆形缩略选择器。"
        swatches={shapeSwatches.map((item) => ({
          key: item.key,
          label: item.label,
          active: item.key === value.shape,
          tone: "linear-gradient(145deg, #ffffff, #eef2f7)",
          icon: item.symbol,
          onClick: () => onChange({ shape: item.key as ShapeKind })
        }))}
      />
      <ControlSelect
        label="上下分配"
        value={balanceValue}
        options={[
          { label: "上多下少", value: "top-heavy" },
          { label: "基本均衡", value: "balanced" },
          { label: "下多上少", value: "bottom-heavy" }
        ]}
        onChange={(next) =>
          onChange({
            topShare: next === "top-heavy" ? 0.55 : next === "bottom-heavy" ? 0.45 : 0.5
          })
        }
      />
      <ControlSelect
        label="下半区分布"
        value={value.bottomDistribution}
        options={[
          { label: "随机散布", value: "random" },
          { label: "均匀散布", value: "grid" },
          { label: "偏下聚集", value: "bottom-heavy" }
        ]}
        onChange={(next) =>
          onChange({
            distribution: next as DotSettings["distribution"],
            bottomDistribution: next as DotSettings["bottomDistribution"]
          })
        }
      />
      <ControlRange
        label="点大小"
        min={8}
        max={42}
        step={1}
        value={value.dotSize}
        onChange={(next) => onChange({ dotSize: next })}
      />
      <ControlRange
        label="大小差异"
        min={0}
        max={90}
        step={1}
        value={value.sizeVariance}
        onChange={(next) => onChange({ sizeVariance: next })}
      />
      <ControlRange
        label="总点数量"
        min={4}
        max={36}
        step={1}
        value={value.dotCount}
        onChange={(next) => onChange({ dotCount: next })}
      />
      <ControlRange
        label="装饰点数量"
        min={0}
        max={24}
        step={1}
        value={value.decorativeCount}
        onChange={(next) => onChange({ decorativeCount: next })}
      />
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
      <ControlRange
        label="透明度"
        min={20}
        max={100}
        step={1}
        value={Math.round(value.opacity * 100)}
        onChange={(next) => onChange({ opacity: next / 100 })}
      />
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
      <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function ControlToggle({
  label,
  value,
  onChange
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="control-card toggle-card">
      <span>{label}</span>
      <button type="button" className={value ? "toggle active" : "toggle"} onClick={() => onChange(!value)}>
        <span />
      </button>
    </label>
  );
}

function rotateSourcesForComposition(
  sources: SourceAsset[],
  activeSourceId: string,
  mode: LayoutSettings["compositionMode"]
) {
  if (sources.length === 0) {
    return [];
  }
  const activeIndex = Math.max(
    0,
    sources.findIndex((source) => source.id === activeSourceId)
  );
  const rotated = [...sources.slice(activeIndex), ...sources.slice(0, activeIndex)];
  const count = mode === "single" ? 1 : mode === "duo" ? 2 : 3;
  return Array.from({ length: count }, (_, index) => rotated[index % rotated.length]);
}

function getHitRegions(
  sources: SourceAsset[],
  mode: LayoutSettings["compositionMode"]
) {
  if (sources.length === 0) {
    return [];
  }
  if (mode === "single") {
    return [
      {
        key: "single",
        source: sources[0],
        style: { left: "0", top: "0", width: "100%", height: "56%" }
      }
    ];
  }
  if (mode === "duo") {
    return [
      {
        key: "duo-left",
        source: sources[0],
        style: { left: "0", top: "0", width: "62%", height: "56%" }
      },
      {
        key: "duo-right-top",
        source: sources[1] ?? sources[0],
        style: { left: "63.5%", top: "0", width: "36.5%", height: "32%" }
      },
      {
        key: "duo-right-bottom",
        source: sources[0],
        style: { left: "63.5%", top: "33%", width: "36.5%", height: "23%" }
      }
    ];
  }
  return [
    {
      key: "tri-1",
      source: sources[0],
      style: { left: "0", top: "0", width: "32.6%", height: "56%" }
    },
    {
      key: "tri-2",
      source: sources[1] ?? sources[0],
      style: { left: "33.7%", top: "0", width: "32.6%", height: "56%" }
    },
    {
      key: "tri-3",
      source: sources[2] ?? sources[0],
      style: { left: "67.4%", top: "0", width: "32.6%", height: "56%" }
    }
  ];
}
