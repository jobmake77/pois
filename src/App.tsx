import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { HomeScreen } from "./components/HomeScreen";
import { EditorScreen } from "./components/EditorScreen";
import { ExportSheet } from "./components/ExportSheet";
import {
  defaultBase,
  defaultDots,
  defaultLayout,
  getThemeById,
  themePresets
} from "./presets";
import { renderToBlobOnMain, renderToCanvas } from "./render/engine";
import { clamp } from "./render/random";
import { canUseWorkerExport, exportWithWorker } from "./render/workerClient";
import type {
  CandidatePreview,
  CanvasPreset,
  ExportPreview,
  LayoutSettings,
  PanelKey,
  ProjectState,
  Screen,
  SourceAsset,
  ThemePreset
} from "./types";

const DEMO_IMAGE_URL =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MDAiIGhlaWdodD0iMTA0MCIgdmlld0JveD0iMCAwIDgwMCAxMDQwIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIHN0b3AtY29sb3I9IiM2NUE4RUYiLz48c3RvcCBvZmZzZXQ9IjAuNTUiIHN0b3AtY29sb3I9IiMzNjdFOTUiLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiNFM0Y3RkIiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjEwNDAiIGZpbGw9InVybCgjZykiLz48cmVjdCB5PSI2NjAiIHdpZHRoPSI4MDAiIGhlaWdodD0iMzcwIiBmaWxsPSIjMkI2Rjg5Ii8+PHJlY3QgeT0iNjkwIiB3aWR0aD0iODAwIiBoZWlnaHQ9IjI4IiBmaWxsPSIjRjNGMEUzIi8+PHJlY3QgeT0iNzU4IiB3aWR0aD0iODAwIiBoZWlnaHQ9IjI4IiBmaWxsPSIjRjNGMEUzIi8+PHJlY3QgeT0iODI2IiB3aWR0aD0iODAwIiBoZWlnaHQ9IjI4IiBmaWxsPSIjRjNGMEUzIi8+PHJlY3QgeT0iODk0IiB3aWR0aD0iODAwIiBoZWlnaHQ9IjI4IiBmaWxsPSIjRjNGMEUzIi8+PHBhdGggZD0iTTIxMiAxOTVsMjQgNDggNTIgNy0zOCAzNCAxMCA1Mi00OC0yNi00OCAyNiAxMC01Mi0zOC0zNCA1Mi03eiIgZmlsbD0iI0YzRjBFMyIvPjxjaXJjbGUgY3g9IjYxNiIgY3k9IjIwOCIgcj0iMzUiIGZpbGw9IiNGM0YwRTMiLz48L3N2Zz4=";

const DRAFT_KEY = "pois-art:last-project";

interface SavedDraft {
  themeId: string;
  layout: LayoutSettings;
  base: ProjectState["base"];
  dots: ProjectState["dots"];
  canvasWidth: number;
  canvasHeight: number;
  exportFormat: ProjectState["exportFormat"];
}

function createInitialProject(theme: ThemePreset, draft?: SavedDraft): ProjectState {
  const canvasPreset = draft?.layout.canvasPreset ?? theme.layout.canvasPreset ?? defaultLayout.canvasPreset;
  const canvas = getCanvasDimensions(canvasPreset);

  return {
    id: `project-${Date.now()}`,
    themeId: draft?.themeId ?? theme.id,
    sourceIds: [],
    activeSourceId: "",
    layout: {
      ...defaultLayout,
      ...theme.layout,
      ...draft?.layout,
      canvasPreset
    },
    base: {
      ...defaultBase,
      primaryColor: theme.palette.primary,
      secondaryColor: theme.palette.secondary,
      backgroundTone: theme.palette.surface,
      ...theme.base,
      ...draft?.base
    },
    dots: {
      ...defaultDots,
      ...theme.dots,
      ...draft?.dots
    },
    canvasWidth: draft?.canvasWidth ?? canvas.width,
    canvasHeight: draft?.canvasHeight ?? canvas.height,
    exportFormat: draft?.exportFormat ?? "png"
  };
}

export default function App() {
  const initialDraft = readDraft();
  const initialTheme = getThemeById(initialDraft?.themeId ?? themePresets[0].id);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [sources, setSources] = useState<SourceAsset[]>([]);
  const [project, setProject] = useState<ProjectState>(() =>
    createInitialProject(initialTheme, initialDraft)
  );
  const [activePanel, setActivePanel] = useState<PanelKey>("layout");
  const [previewStatus, setPreviewStatus] = useState("等待图片上传");
  const [renderTime, setRenderTime] = useState<number | null>(null);
  const [exportPending, setExportPending] = useState(false);
  const [exportPreview, setExportPreview] = useState<ExportPreview | null>(null);
  const [renderTick, setRenderTick] = useState(0);
  const sourcesRef = useRef<SourceAsset[]>([]);
  const exportRef = useRef<ExportPreview | null>(null);

  const deferredProject = useDeferredValue(project);
  const theme = useMemo(() => getThemeById(project.themeId), [project.themeId]);
  const deferredTheme = useMemo(
    () => getThemeById(deferredProject.themeId),
    [deferredProject.themeId]
  );
  const activeSources = useMemo(
    () =>
      project.sourceIds
        .map((id) => sources.find((source) => source.id === id))
        .filter(Boolean) as SourceAsset[],
    [project.sourceIds, sources]
  );
  const candidates = useMemo(
    () => buildCandidates(project.activeSourceId, themePresets),
    [project.activeSourceId]
  );
  const previewRatio = project.canvasWidth / project.canvasHeight;

  useEffect(() => {
    sourcesRef.current = sources;
  }, [sources]);

  useEffect(() => {
    exportRef.current = exportPreview;
  }, [exportPreview]);

  useEffect(() => {
    persistDraft(project);
  }, [project]);

  useEffect(() => {
    return () => {
      sourcesRef.current.forEach((source) => URL.revokeObjectURL(source.objectUrl));
      if (exportRef.current) {
        URL.revokeObjectURL(exportRef.current.url);
      }
    };
  }, []);

  useEffect(() => {
    if (screen !== "editor" || activeSources.length === 0 || !previewCanvasRef.current) {
      return;
    }

    setPreviewStatus("生成预览中...");
    const canvas = previewCanvasRef.current;
    const frameWidth = Math.min(window.innerWidth - 32, 520);
    const frameHeight = Math.round(frameWidth / previewRatio);
    const handle = window.setTimeout(async () => {
      const startedAt = performance.now();
      try {
        await renderToCanvas(canvas, {
          project: deferredProject,
          theme: deferredTheme,
          sources: selectSourcesForComposition(
            activeSources,
            deferredProject.layout.compositionMode,
            deferredProject.activeSourceId
          ),
          width: frameWidth,
          height: frameHeight,
          pixelRatio: Math.min(window.devicePixelRatio || 1, 2)
        });
        setPreviewStatus("预览已更新");
        setRenderTime(performance.now() - startedAt);
      } catch (error) {
        console.error(error);
        setPreviewStatus("预览失败，请换一张图试试");
      }
    }, 80);

    return () => window.clearTimeout(handle);
  }, [screen, deferredProject, activeSources, deferredTheme, renderTick, previewRatio]);

  const handleFiles = async (files: FileList | File[]) => {
    const assets = await Promise.all(Array.from(files).map(loadSourceAsset));
    if (assets.length === 0) {
      return;
    }

    setSources((current) => [...current, ...assets]);
    setProject((current) => {
      const nextIds = [...current.sourceIds, ...assets.map((asset) => asset.id)];
      return {
        ...current,
        sourceIds: nextIds,
        activeSourceId: current.activeSourceId || assets[0].id
      };
    });
    setScreen("editor");
    setPreviewStatus("已接收素材，准备生成...");
    setRenderTick((current) => current + 1);
  };

  const handleThemeChange = (themeId: string) => {
    const nextTheme = getThemeById(themeId);
    setProject((current) => ({
      ...current,
      themeId,
      layout: {
        ...current.layout,
        ...nextTheme.layout,
        cropX: current.layout.cropX,
        cropY: current.layout.cropY,
        canvasPreset: current.layout.canvasPreset
      },
      base: {
        ...current.base,
        primaryColor: nextTheme.palette.primary,
        secondaryColor: nextTheme.palette.secondary,
        backgroundTone: nextTheme.palette.surface,
        ...nextTheme.base
      },
      dots: {
        ...current.dots,
        ...nextTheme.dots
      }
    }));
  };

  const handleCanvasPresetChange = (preset: CanvasPreset) => {
    const canvas = getCanvasDimensions(preset);
    setProject((current) => ({
      ...current,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      layout: {
        ...current.layout,
        canvasPreset: preset
      }
    }));
  };

  const handleRandomize = () => {
    setProject((current) => ({
      ...current,
      dots: {
        ...current.dots,
        seed: current.dots.seed + 17
      }
    }));
  };

  const handleExport = async () => {
    if (activeSources.length === 0) {
      return;
    }
    setExportPending(true);
    setPreviewStatus("正在生成高清图...");
    if (exportPreview) {
      URL.revokeObjectURL(exportPreview.url);
      setExportPreview(null);
    }
    try {
      const renderInput = {
        project,
        theme,
        sources: selectSourcesForComposition(
          activeSources,
          project.layout.compositionMode,
          project.activeSourceId
        ),
        width: project.canvasWidth,
        height: project.canvasHeight,
        pixelRatio: 1,
        exportQuality: 0.96
      };
      const mimeType = project.exportFormat === "jpeg" ? "image/jpeg" : "image/png";
      const result = canUseWorkerExport()
        ? await exportWithWorker(renderInput)
        : await renderToBlobOnMain(renderInput, mimeType);
      const url = URL.createObjectURL(result.blob);
      setExportPreview({
        blob: result.blob,
        url,
        durationMs: result.durationMs
      });
      setPreviewStatus("高清图已生成");
    } catch (error) {
      console.error(error);
      setPreviewStatus("高清图生成失败");
    } finally {
      setExportPending(false);
    }
  };

  const handleDownload = () => {
    if (!exportPreview) {
      return;
    }
    const link = document.createElement("a");
    link.href = exportPreview.url;
    link.download = `pois-art-${Date.now()}.${project.exportFormat}`;
    link.click();
  };

  const handleShare = async () => {
    if (!exportPreview) {
      return;
    }
    const extension = project.exportFormat === "jpeg" ? "jpg" : "png";
    const mimeType = project.exportFormat === "jpeg" ? "image/jpeg" : "image/png";
    const shareText = "用 Pois Art 做了一张波点海报。";
    const file = new File([exportPreview.blob], `pois-art.${extension}`, {
      type: mimeType
    });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: "Pois Art 海报",
        text: shareText,
        files: [file]
      });
      return;
    }
    handleDownload();
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(
      "用 Pois Art 做了一张双区波点海报，主图保留，底板和形状都可以自己调。"
    );
    setPreviewStatus("分享文案已复制");
  };

  const handleUseDemo = async () => {
    const response = await fetch(DEMO_IMAGE_URL);
    const blob = await response.blob();
    const file = new File([blob], "demo-poster.jpg", { type: "image/jpeg" });
    await handleFiles([file]);
  };

  return (
    <div className="app-shell">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          const files = event.target.files;
          if (files && files.length > 0) {
            void handleFiles(files);
          }
          event.currentTarget.value = "";
        }}
      />

      <div className="background-wash" />

      {screen === "home" ? (
        <HomeScreen
          onOpenFiles={() => fileInputRef.current?.click()}
          onUseDemo={() => void handleUseDemo()}
        />
      ) : (
        <EditorScreen
          project={project}
          theme={theme}
          themes={themePresets}
          sources={activeSources}
          candidates={candidates}
          previewStatus={previewStatus}
          renderTime={renderTime}
          exportPending={exportPending}
          activePanel={activePanel}
          previewRef={previewCanvasRef}
          onActivePanelChange={setActivePanel}
          onThemeChange={handleThemeChange}
          onSelectSource={(sourceId) =>
            setProject((current) => ({
              ...current,
              activeSourceId: sourceId
            }))
          }
          onDeleteSource={(sourceId) => {
            const target = sources.find((source) => source.id === sourceId);
            if (target) {
              URL.revokeObjectURL(target.objectUrl);
            }
            const nextSources = sources.filter((source) => source.id !== sourceId);
            setSources(nextSources);
            setProject((current) => {
              const nextIds = current.sourceIds.filter((id) => id !== sourceId);
              if (nextIds.length === 0) {
                setScreen("home");
                setPreviewStatus("等待图片上传");
                return {
                  ...current,
                  sourceIds: [],
                  activeSourceId: ""
                };
              }
              const activeStillExists = nextIds.includes(current.activeSourceId);
              return {
                ...current,
                sourceIds: nextIds,
                activeSourceId: activeStillExists ? current.activeSourceId : nextIds[0]
              };
            });
          }}
          onCandidateSelect={(candidate) => {
            setProject((current) => ({
              ...current,
              activeSourceId: candidate.sourceId,
              dots: {
                ...current.dots,
                seed: defaultDots.seed + candidate.seedOffset
              }
            }));
            handleThemeChange(candidate.themeId);
          }}
          onUpdateLayout={(patch) => {
            if (patch.canvasPreset) {
              handleCanvasPresetChange(patch.canvasPreset);
            }
            setProject((current) => ({
              ...current,
              layout: {
                ...current.layout,
                ...patch
              }
            }));
          }}
          onAdjustCrop={(dx, dy) =>
            setProject((current) => ({
              ...current,
              layout: {
                ...current.layout,
                cropX: clamp(current.layout.cropX + dx, -1, 1),
                cropY: clamp(current.layout.cropY + dy, -1, 1)
              }
            }))
          }
          onResetTheme={() => {
            const resetTheme = getThemeById(project.themeId);
            setProject((current) => ({
              ...current,
              layout: {
                ...defaultLayout,
                ...resetTheme.layout,
                cropX: 0,
                cropY: 0,
                canvasPreset: current.layout.canvasPreset
              },
              base: {
                ...defaultBase,
                primaryColor: resetTheme.palette.primary,
                secondaryColor: resetTheme.palette.secondary,
                backgroundTone: resetTheme.palette.surface,
                ...resetTheme.base
              },
              dots: {
                ...defaultDots,
                ...resetTheme.dots
              }
            }));
          }}
          onOpenMoreFiles={() => fileInputRef.current?.click()}
          onUpdateBase={(patch) =>
            setProject((current) => ({
              ...current,
              base: {
                ...current.base,
                ...patch
              }
            }))
          }
          onUpdateDots={(patch) =>
            setProject((current) => ({
              ...current,
              dots: {
                ...current.dots,
                ...patch
              }
            }))
          }
          onUpdateExportFormat={(format) =>
            setProject((current) => ({
              ...current,
              exportFormat: format
            }))
          }
          onRandomize={handleRandomize}
          onExport={() => void handleExport()}
          onBack={() => setScreen("home")}
        />
      )}

      <ExportSheet
        preview={exportPreview}
        format={project.exportFormat}
        onClose={() => setExportPreview(null)}
        onDownload={handleDownload}
        onShare={() => void handleShare()}
        onCopy={() => void handleCopy()}
      />
    </div>
  );
}

async function loadSourceAsset(file: File): Promise<SourceAsset> {
  const objectUrl = URL.createObjectURL(file);
  const image = await loadImage(objectUrl);
  const dominantColor = await extractDominantColor(image);
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: file.name,
    file,
    objectUrl,
    width: image.naturalWidth,
    height: image.naturalHeight,
    aspectRatio: image.naturalWidth / image.naturalHeight,
    image,
    dominantColor
  };
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image failed to load."));
    image.src = src;
  });
}

async function extractDominantColor(image: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext("2d");
  if (!context) {
    return "#999999";
  }
  context.drawImage(image, 0, 0, 32, 32);
  const { data } = context.getImageData(0, 0, 32, 32);
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;
  for (let index = 0; index < data.length; index += 4) {
    red += data[index];
    green += data[index + 1];
    blue += data[index + 2];
    count += 1;
  }
  return `rgb(${Math.round(red / count)}, ${Math.round(green / count)}, ${Math.round(blue / count)})`;
}

function selectSourcesForComposition(
  sources: SourceAsset[],
  mode: ProjectState["layout"]["compositionMode"],
  activeSourceId?: string
) {
  if (sources.length === 0) {
    return [];
  }
  const activeIndex =
    activeSourceId != null ? Math.max(0, sources.findIndex((source) => source.id === activeSourceId)) : 0;
  const rotated = [...sources.slice(activeIndex), ...sources.slice(0, activeIndex)];
  const count = mode === "single" ? 1 : mode === "duo" ? 2 : 3;
  return Array.from({ length: count }, (_, index) => rotated[index % rotated.length]).filter(Boolean);
}

function buildCandidates(sourceId: string, presets: ThemePreset[]): CandidatePreview[] {
  if (!sourceId) {
    return [];
  }
  return presets.slice(0, 8).map((theme, index) => ({
    id: `${sourceId}-${theme.id}-${index}`,
    sourceId,
    themeId: theme.id,
    label: `${theme.name} ${index % 2 === 0 ? "柔和版" : "跳色版"}`,
    seedOffset: 11 * (index + 1)
  }));
}

function getCanvasDimensions(preset: CanvasPreset) {
  if (preset === "square") {
    return { width: 1200, height: 1200 };
  }
  if (preset === "story") {
    return { width: 1080, height: 1920 };
  }
  if (preset === "landscape") {
    return { width: 1600, height: 1000 };
  }
  return { width: 1000, height: 1280 };
}

function readDraft(): SavedDraft | undefined {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as SavedDraft) : undefined;
  } catch {
    return undefined;
  }
}

function persistDraft(project: ProjectState) {
  try {
    const draft: SavedDraft = {
      themeId: project.themeId,
      layout: project.layout,
      base: project.base,
      dots: project.dots,
      canvasWidth: project.canvasWidth,
      canvasHeight: project.canvasHeight,
      exportFormat: project.exportFormat
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // ignore local storage failures
  }
}
