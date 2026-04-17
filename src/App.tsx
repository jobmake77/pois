import { useEffect, useMemo, useRef, useState } from "react";
import { EditorScreen } from "./components/EditorScreen";
import {
  defaultBase,
  defaultDots,
  defaultLayout,
  getThemeById,
  themePresets
} from "./presets";
import { resolvePanels, getSuggestedEditorState } from "./render/blockLayout";
import { clampPhotoCrop, createDefaultPhotoCrop } from "./render/crop";
import {
  addDotStroke,
  clearDotPlacements,
  getManualDotCount,
  normalizeDotPlacements,
  undoLastDotStroke
} from "./render/dotEditing";
import { renderPanelToCanvas, renderToBlobOnMain } from "./render/engine";
import { canUseWorkerExport, exportWithWorker } from "./render/workerClient";
import type {
  CanvasPreset,
  PanelKey,
  PhotoCrop,
  ProjectState,
  Screen,
  SourceAsset,
  ThemePreset
} from "./types";

const DRAFT_KEY = "pois-art:last-project";

type FilePickerMode = "replace-main" | "replace-fill";

function createInitialProject(theme: ThemePreset): ProjectState {
  const suggested = getSuggestedEditorState(0);
  const canvasPreset = theme.layout.canvasPreset ?? defaultLayout.canvasPreset;
  const canvas = getCanvasDimensions(canvasPreset);

  return {
    id: `project-${Date.now()}`,
    themeId: theme.id,
    photoIds: [],
    fillPhotoId: undefined,
    activePhotoId: "",
    photoCrops: {},
    dotPlacements: normalizeDotPlacements(undefined),
    layoutMode: suggested.layoutMode,
    panelDirection: suggested.panelDirection,
    primaryShare: suggested.primaryShare,
    pairedDotsMode: "auto",
    fillBlockEnabled: suggested.fillBlockEnabled,
    fillBlockDotsEnabled: true,
    layout: {
      ...defaultLayout,
      ...theme.layout,
      canvasPreset
    },
    base: {
      ...defaultBase,
      primaryColor: theme.palette.primary,
      secondaryColor: theme.palette.secondary,
      backgroundTone: theme.palette.surface,
      ...theme.base
    },
    dots: {
      ...defaultDots,
      ...theme.dots,
      shape:
        theme.dots.shape === "square" || theme.dots.shape === "text"
          ? "circle"
          : theme.dots.shape ?? defaultDots.shape,
      brushMode: defaultDots.brushMode
    },
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    exportFormat: "png"
  };
}

export default function App() {
  const initialTheme = getThemeById(themePresets[0].id);
  const [project, setProject] = useState<ProjectState>(() =>
    createInitialProject(initialTheme)
  );
  const [screen] = useState<Screen>("editor");
  const [sources, setSources] = useState<SourceAsset[]>([]);
  const [activePanel, setActivePanel] = useState<PanelKey>("layout");
  const [previewStatus, setPreviewStatus] = useState("等待图片上传");
  const [renderTime, setRenderTime] = useState<number | null>(null);
  const [exportPending, setExportPending] = useState(false);
  const [renderTick, setRenderTick] = useState(0);
  const [previewShellSize, setPreviewShellSize] = useState({ width: 0, height: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewShellRef = useRef<HTMLDivElement>(null);
  const primaryPreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const secondaryPreviewCanvasRef = useRef<HTMLCanvasElement>(null);
  const filePickerModeRef = useRef<FilePickerMode>("replace-main");
  const sourcesRef = useRef<SourceAsset[]>([]);

  const theme = useMemo(() => getThemeById(project.themeId), [project.themeId]);
  const activeSources = useMemo(
    () => {
      const orderedIds = [...project.photoIds, project.fillPhotoId].filter(Boolean) as string[];
      const uniqueIds = Array.from(new Set(orderedIds));
      return uniqueIds
        .map((id) => sources.find((source) => source.id === id))
        .filter(Boolean) as SourceAsset[];
    },
    [project.photoIds, project.fillPhotoId, sources]
  );
  const previewLayoutWidth = previewShellSize.width > 0 ? previewShellSize.width : project.canvasWidth;
  const previewLayoutHeight = previewShellSize.height > 0 ? previewShellSize.height : project.canvasHeight;
  const previewPanels = useMemo(
    () => resolvePanels(project, previewLayoutWidth, previewLayoutHeight, activeSources),
    [project, previewLayoutWidth, previewLayoutHeight, activeSources]
  );

  useEffect(() => {
    sourcesRef.current = sources;
  }, [sources]);

  useEffect(() => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore local storage failures
    }
  }, []);

  useEffect(() => {
    return () => {
      sourcesRef.current.forEach((source) => URL.revokeObjectURL(source.objectUrl));
    };
  }, []);

  useEffect(() => {
    if (screen !== "editor") {
      return;
    }

    const shell = previewShellRef.current;
    if (!shell) {
      return;
    }

    const updateSize = () => {
      const width = Math.max(1, Math.round(shell.clientWidth));
      const height = Math.max(1, Math.round(shell.clientHeight));
      setPreviewShellSize((current) =>
        current.width === width && current.height === height ? current : { width, height }
      );
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(shell);
    window.addEventListener("resize", updateSize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, [screen, project.canvasWidth, project.canvasHeight, activeSources.length]);

  useEffect(() => {
    if (
      screen !== "editor" ||
      activeSources.length === 0
    ) {
      return;
    }

    const handle = window.setTimeout(async () => {
      const startedAt = performance.now();
      setPreviewStatus("生成预览中...");
      try {
        if (previewPanels.length === 0) {
          return;
        }
        const renderJobs = previewPanels.map((panel) => {
          const target =
            panel.role === "primary" ? primaryPreviewCanvasRef.current : secondaryPreviewCanvasRef.current;
          if (!target) {
            return Promise.resolve();
          }
          return renderPanelToCanvas(target, {
            project,
            theme,
            sources: activeSources,
            width: panel.rect.width,
            height: panel.rect.height,
            pixelRatio: Math.min(window.devicePixelRatio || 1, 2)
          }, panel.role, previewPanels);
        });
        await Promise.all(renderJobs);
        setPreviewStatus("预览已更新");
        setRenderTime(performance.now() - startedAt);
      } catch (error) {
        console.error(error);
        setPreviewStatus("预览失败，请换一张图试试");
      }
    }, 50);

    return () => window.clearTimeout(handle);
  }, [screen, activeSources, previewShellSize, project, renderTick, theme]);

  const openPicker = (mode: FilePickerMode) => {
    filePickerModeRef.current = mode;
    fileInputRef.current?.click();
  };

  const handleFiles = async (files: FileList | File[]) => {
    const [firstFile] = Array.from(files);
    if (!firstFile) {
      return;
    }

    let asset: SourceAsset;
    try {
      asset = await loadSourceAsset(firstFile);
    } catch (error) {
      console.error(error);
      setPreviewStatus("图片加载失败，请换一张图试试");
      return;
    }

    if (filePickerModeRef.current === "replace-fill") {
      const currentMainId = project.photoIds[0];
      const mainSource = currentMainId
        ? sourcesRef.current.find((source) => source.id === currentMainId)
        : undefined;
      if (!mainSource) {
        URL.revokeObjectURL(asset.objectUrl);
        setPreviewStatus("请先上传主照片");
        return;
      }

      const previousFillSource = project.fillPhotoId
        ? sourcesRef.current.find((source) => source.id === project.fillPhotoId)
        : undefined;
      if (previousFillSource) {
        URL.revokeObjectURL(previousFillSource.objectUrl);
      }

      const nextSources = [mainSource, asset];
      sourcesRef.current = nextSources;
      setSources(nextSources);
      setProject((current) => ({
        ...current,
        fillPhotoId: asset.id
      }));
      setActivePanel("fill");
      setPreviewStatus("填充块照片已更新");
      setRenderTick((current) => current + 1);
      return;
    }

    const previousMainId = project.photoIds[0];
    const previousFillId = project.fillPhotoId;
    const preservedFillSource = previousFillId
      ? sourcesRef.current.find((source) => source.id === previousFillId)
      : undefined;

    sourcesRef.current.forEach((source) => {
      if (source.id !== previousFillId) {
        URL.revokeObjectURL(source.objectUrl);
      }
    });

    const nextSources = [asset, preservedFillSource].filter(Boolean) as SourceAsset[];
    sourcesRef.current = nextSources;
    setSources(nextSources);
    setProject((current) => {
      const nextPhotoCrops: Record<string, PhotoCrop> = {};
      if (preservedFillSource && current.photoCrops[preservedFillSource.id]) {
        nextPhotoCrops[preservedFillSource.id] = current.photoCrops[preservedFillSource.id];
      }
      nextPhotoCrops[asset.id] = { x: 0, y: 0, scale: 1, fitMode: "contain" };

      const nextProject: ProjectState = {
        ...current,
        photoIds: [asset.id],
        fillPhotoId: preservedFillSource?.id,
        activePhotoId: asset.id,
        photoCrops: nextPhotoCrops,
        layoutMode: "single",
        panelDirection: current.panelDirection,
        primaryShare: current.primaryShare,
        fillBlockEnabled: true
      };

      return {
        ...nextProject,
        photoCrops: normalizePhotoCrops(nextProject, nextSources, nextPhotoCrops, new Set([asset.id]))
      };
    });
    setActivePanel("layout");
    setPreviewStatus(previousMainId ? "主照片已更新" : "已接收素材，准备生成...");
    setRenderTick((current) => current + 1);

    // Keep preview shell dimensions fresh after the file picker closes.
    setTimeout(() => {
      const shell = previewShellRef.current;
      if (shell) {
        const width = Math.max(1, Math.round(shell.clientWidth));
        const height = Math.max(1, Math.round(shell.clientHeight));
        setPreviewShellSize({ width, height });
      }
    }, 100);
  };

  const handleExport = async () => {
    if (activeSources.length === 0) {
      return;
    }

    setExportPending(true);
    setPreviewStatus("正在生成海报...");

    try {
      const renderInput = {
        project,
        theme,
        sources: activeSources,
        width: project.canvasWidth,
        height: project.canvasHeight,
        pixelRatio: 1
      };
      const mimeType = "image/png";
      const result = canUseWorkerExport()
        ? await exportWithWorker(renderInput)
        : await renderToBlobOnMain(renderInput, mimeType);
      downloadBlob(result.blob, `pois-art-${Date.now()}.png`);
      setPreviewStatus("PNG 已下载");
    } catch (error) {
      console.error(error);
      setPreviewStatus("海报生成失败");
    } finally {
      setExportPending(false);
    }
  };

  const updatePhotoCrop = (photoId: string, nextCrop: PhotoCrop) => {
    setProject((current) => {
      const source = sourcesRef.current.find((item) => item.id === photoId);
      if (!source) {
        return current;
      }
      const region = resolvePanels(current, current.canvasWidth, current.canvasHeight, sourcesRef.current).find(
        (item) => item.kind === "photo" && item.photoId === photoId
      );
      if (!region) {
        return current;
      }
      return {
        ...current,
        photoCrops: {
          ...current.photoCrops,
          [photoId]: clampPhotoCrop(
            nextCrop,
            source.width,
            source.height,
            region.rect.width,
            region.rect.height
          )
        }
      };
    });
  };

  const handleCommitDotStroke = (
    panelRole: "primary" | "secondary",
    points: Array<{ xRatio: number; yRatio: number }>
  ) => {
    const distribution = project.dots.distribution;
    setProject((current) => ({
      ...current,
      dotPlacements: addDotStroke(
        current.dotPlacements,
        current.dots.distribution,
        panelRole,
        points,
        current.dots.brushMode
      )
    }));
    setPreviewStatus(
      distribution === "double-side"
        ? "已新增同步波点笔划"
        : "已新增当前面板波点笔划"
    );
  };

  const handleUndoDotStroke = () => {
    setProject((current) => ({
      ...current,
      dotPlacements: undoLastDotStroke(current.dotPlacements)
    }));
    setPreviewStatus("已撤回上一笔波点");
  };

  const handleClearDotStroke = () => {
    setProject((current) => ({
      ...current,
      dotPlacements: clearDotPlacements(current.dotPlacements)
    }));
    setPreviewStatus("已清空手动画点");
  };

  return (
    <div className="app-shell">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const files = event.target.files;
          if (files && files.length > 0) {
            void handleFiles(files);
          }
          event.currentTarget.value = "";
        }}
      />

      <EditorScreen
        project={project}
        sources={activeSources}
        previewStatus={previewStatus}
        renderTime={renderTime}
        exportPending={exportPending}
        activePanel={activePanel}
        previewShellRef={previewShellRef}
        primaryPreviewRef={primaryPreviewCanvasRef}
        secondaryPreviewRef={secondaryPreviewCanvasRef}
        previewPanels={previewPanels}
        onActivePanelChange={setActivePanel}
        onOpenFillPhoto={() => openPicker("replace-fill")}
        onSetPhotoCrop={updatePhotoCrop}
        onCommitDotStroke={handleCommitDotStroke}
        onUndoDotStroke={handleUndoDotStroke}
        onClearDotStroke={handleClearDotStroke}
        manualDotCount={getManualDotCount(project.dotPlacements)}
        canUndoDotStroke={project.dotPlacements.strokes.length > 0}
        onSetPanelDirection={(panelDirection) =>
          setProject((current) => {
            const nextProject = {
              ...current,
              panelDirection
            };
            return {
              ...nextProject,
              photoCrops: normalizePhotoCrops(nextProject, sourcesRef.current, current.photoCrops)
            };
          })
        }
        onResetTheme={() => {
          const resetTheme = getThemeById(project.themeId);
          setProject((current) => ({
            ...current,
            base: {
              ...defaultBase,
              primaryColor: resetTheme.palette.primary,
              secondaryColor: resetTheme.palette.secondary,
              backgroundTone: resetTheme.palette.surface,
              ...resetTheme.base,
              style: resetTheme.base.style === "duotone" ? "stripes" : resetTheme.base.style ?? defaultBase.style
            },
            dots: {
              ...defaultDots,
              ...resetTheme.dots,
              shape:
                resetTheme.dots.shape === "square" || resetTheme.dots.shape === "text"
                  ? "circle"
                  : resetTheme.dots.shape ?? defaultDots.shape,
              fillMode: current.dots.fillMode,
              distribution: current.dots.distribution,
              brushMode: current.dots.brushMode
            }
          }));
        }}
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
        onExport={() => void handleExport()}
        onBack={() => openPicker("replace-main")}
      />
    </div>
  );
}

async function loadSourceAsset(file: File): Promise<SourceAsset> {
  const objectUrl = URL.createObjectURL(file);
  try {
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
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
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

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
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

function normalizePhotoCrops(
  project: ProjectState,
  sources: SourceAsset[],
  cropMap: Record<string, PhotoCrop>,
  initializeIds = new Set<string>()
) {
  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  const regionMap = new Map(
    resolvePanels(project, project.canvasWidth, project.canvasHeight, sources)
      .filter((region) => region.kind === "photo" && region.photoId)
      .map((region) => [region.photoId!, region])
  );

  const nextPhotoCrops: Record<string, PhotoCrop> = {};
  project.photoIds.forEach((photoId) => {
    const source = sourceMap.get(photoId);
    const region = regionMap.get(photoId);
    if (!source || !region) {
      return;
    }

    if (initializeIds.has(photoId) || !cropMap[photoId]) {
      nextPhotoCrops[photoId] = createDefaultPhotoCrop(
        source.width,
        source.height,
        region.rect.width,
        region.rect.height
      );
      return;
    }

    nextPhotoCrops[photoId] = clampPhotoCrop(
      cropMap[photoId],
      source.width,
      source.height,
      region.rect.width,
      region.rect.height
    );
  });

  return nextPhotoCrops;
}
