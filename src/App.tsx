import { useEffect, useMemo, useRef, useState } from "react";
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
import { getSuggestedEditorState } from "./render/blockLayout";
import { canUseWorkerExport, exportWithWorker } from "./render/workerClient";
import { clamp } from "./render/random";
import type {
  CanvasPreset,
  ExportPreview,
  LayoutDirection,
  LayoutMode,
  PanelKey,
  PhotoCrop,
  ProjectState,
  Screen,
  SourceAsset,
  ThemePreset
} from "./types";

const DRAFT_KEY = "pois-art:last-project";
const MAX_PHOTOS = 2;

interface SavedDraft {
  themeId?: string;
  layoutMode?: LayoutMode;
  layoutDirection?: LayoutDirection;
  fillBlockEnabled?: boolean;
  fillBlockDotsEnabled?: boolean;
  layout?: ProjectState["layout"];
  base?: ProjectState["base"];
  dots?: ProjectState["dots"];
  exportFormat?: ProjectState["exportFormat"];
}

type FilePickerMode = "replace" | "append";

function createInitialProject(theme: ThemePreset, draft?: SavedDraft): ProjectState {
  const suggested = getSuggestedEditorState(0);
  const canvasPreset =
    draft?.layout?.canvasPreset ?? theme.layout.canvasPreset ?? defaultLayout.canvasPreset;
  const canvas = getCanvasDimensions(canvasPreset);

  return {
    id: `project-${Date.now()}`,
    themeId: draft?.themeId ?? theme.id,
    photoIds: [],
    activePhotoId: "",
    photoCrops: {},
    layoutMode: draft?.layoutMode ?? suggested.layoutMode,
    layoutDirection: draft?.layoutDirection ?? suggested.layoutDirection,
    fillBlockEnabled: draft?.fillBlockEnabled ?? suggested.fillBlockEnabled,
    fillBlockDotsEnabled: draft?.fillBlockDotsEnabled ?? true,
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
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    exportFormat: draft?.exportFormat ?? "png"
  };
}

export default function App() {
  const initialDraft = readDraft();
  const initialTheme = getThemeById(initialDraft?.themeId ?? themePresets[0].id);
  const [project, setProject] = useState<ProjectState>(() =>
    createInitialProject(initialTheme, initialDraft)
  );
  const [screen, setScreen] = useState<Screen>("home");
  const [sources, setSources] = useState<SourceAsset[]>([]);
  const [activePanel, setActivePanel] = useState<PanelKey>("layout");
  const [previewStatus, setPreviewStatus] = useState("等待图片上传");
  const [renderTime, setRenderTime] = useState<number | null>(null);
  const [exportPending, setExportPending] = useState(false);
  const [exportPreview, setExportPreview] = useState<ExportPreview | null>(null);
  const [renderTick, setRenderTick] = useState(0);
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const filePickerModeRef = useRef<FilePickerMode>("replace");
  const sourcesRef = useRef<SourceAsset[]>([]);
  const exportRef = useRef<ExportPreview | null>(null);

  const theme = useMemo(() => getThemeById(project.themeId), [project.themeId]);
  const activeSources = useMemo(
    () =>
      project.photoIds
        .map((id) => sources.find((source) => source.id === id))
        .filter(Boolean) as SourceAsset[],
    [project.photoIds, sources]
  );

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
    if (screen !== "editor") {
      return;
    }

    const canvas = previewCanvasRef.current;
    const shell = canvas?.parentElement;
    if (!canvas || !shell) {
      return;
    }

    const updateSize = () => {
      const width = Math.max(1, Math.round(shell.clientWidth));
      const height = Math.max(1, Math.round(shell.clientHeight));
      setPreviewSize((current) =>
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
  }, [screen, project.canvasWidth, project.canvasHeight]);

  useEffect(() => {
    if (
      screen !== "editor" ||
      activeSources.length === 0 ||
      !previewCanvasRef.current ||
      previewSize.width <= 0 ||
      previewSize.height <= 0
    ) {
      return;
    }

    const handle = window.setTimeout(async () => {
      const startedAt = performance.now();
      setPreviewStatus("生成预览中...");
      try {
        await renderToCanvas(previewCanvasRef.current!, {
          project,
          theme,
          sources: activeSources,
          width: previewSize.width,
          height: previewSize.height,
          pixelRatio: Math.min(window.devicePixelRatio || 1, 2)
        });
        setPreviewStatus("预览已更新");
        setRenderTime(performance.now() - startedAt);
      } catch (error) {
        console.error(error);
        setPreviewStatus("预览失败，请换一张图试试");
      }
    }, 50);

    return () => window.clearTimeout(handle);
  }, [screen, activeSources, previewSize, project, renderTick, theme]);

  const openPicker = (mode: FilePickerMode) => {
    filePickerModeRef.current = mode;
    fileInputRef.current?.click();
  };

  const syncProjectWithSources = (
    current: ProjectState,
    nextPhotoIds: string[],
    nextPhotoCrops: Record<string, PhotoCrop>,
    preferredActiveId?: string
  ): ProjectState => {
    if (nextPhotoIds.length === 0) {
      const suggested = getSuggestedEditorState(0);
      return {
        ...current,
        photoIds: [],
        activePhotoId: "",
        photoCrops: {},
        layoutMode: suggested.layoutMode,
        layoutDirection: suggested.layoutDirection,
        fillBlockEnabled: suggested.fillBlockEnabled
      };
    }

    const suggested = getSuggestedEditorState(nextPhotoIds.length);
    const activePhotoId =
      preferredActiveId && nextPhotoIds.includes(preferredActiveId)
        ? preferredActiveId
        : nextPhotoIds[0];

    return {
      ...current,
      photoIds: nextPhotoIds,
      activePhotoId,
      photoCrops: nextPhotoCrops,
      layoutMode: suggested.layoutMode,
      layoutDirection: suggested.layoutDirection,
      fillBlockEnabled: suggested.fillBlockEnabled
    };
  };

  const handleFiles = async (files: FileList | File[]) => {
    const loadedAssets = await Promise.all(Array.from(files).map(loadSourceAsset));
    if (loadedAssets.length === 0) {
      return;
    }

    const replaceExisting = filePickerModeRef.current === "replace";
    const existingSources = replaceExisting ? [] : sourcesRef.current;
    const allowedCount = Math.max(0, MAX_PHOTOS - existingSources.length);
    const acceptedAssets = loadedAssets.slice(0, allowedCount);

    if (replaceExisting) {
      sourcesRef.current.forEach((source) => URL.revokeObjectURL(source.objectUrl));
      if (exportPreview) {
        URL.revokeObjectURL(exportPreview.url);
        setExportPreview(null);
      }
    }

    if (acceptedAssets.length === 0) {
      setPreviewStatus(`最多添加 ${MAX_PHOTOS} 张图片`);
      return;
    }

    const nextSources = [...existingSources, ...acceptedAssets];
    sourcesRef.current = nextSources;
    setSources(nextSources);
    setProject((current) => {
      const baseIds = replaceExisting ? [] : current.photoIds;
      const nextPhotoIds = [...baseIds, ...acceptedAssets.map((asset) => asset.id)];
      const nextPhotoCrops: Record<string, PhotoCrop> = replaceExisting ? {} : { ...current.photoCrops };
      acceptedAssets.forEach((asset) => {
        nextPhotoCrops[asset.id] = { x: 0, y: 0, scale: 1 };
      });
      return syncProjectWithSources(current, nextPhotoIds, nextPhotoCrops, nextPhotoIds[0]);
    });
    setActivePanel("layout");
    setScreen("editor");
    setPreviewStatus(
      acceptedAssets.length < loadedAssets.length
        ? `已添加 ${acceptedAssets.length} 张，当前最多 ${MAX_PHOTOS} 张`
        : "已接收素材，准备生成..."
    );
    setRenderTick((current) => current + 1);
  };

  const handleThemeChange = (themeId: string) => {
    const nextTheme = getThemeById(themeId);
    setProject((current) => ({
      ...current,
      themeId,
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
    setRenderTick((current) => current + 1);
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
        sources: activeSources,
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

  const updatePhotoCrop = (photoId: string, nextCrop: PhotoCrop) => {
    setProject((current) => ({
      ...current,
      photoCrops: {
        ...current.photoCrops,
        [photoId]: {
          x: clamp(Number(nextCrop.x.toFixed(3)), -1, 1),
          y: clamp(Number(nextCrop.y.toFixed(3)), -1, 1),
          scale: clamp(Number(nextCrop.scale.toFixed(3)), 1, 2.6)
        }
      }
    }));
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
    const file = new File([exportPreview.blob], `pois-art.${extension}`, {
      type: mimeType
    });

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: "Pois Art 海报",
        text: "用 Pois Art 做了一张分块波点海报。",
        files: [file]
      });
      return;
    }

    handleDownload();
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText("用 Pois Art 做了一张分块波点海报。");
    setPreviewStatus("分享文案已复制");
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

      {screen === "home" ? (
        <HomeScreen onOpenFiles={() => openPicker("replace")} />
      ) : (
        <EditorScreen
          project={project}
          theme={theme}
          themes={themePresets}
          sources={activeSources}
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
              activePhotoId: sourceId
            }))
          }
          onDeleteSource={(sourceId) => {
            const target = sourcesRef.current.find((source) => source.id === sourceId);
            if (target) {
              URL.revokeObjectURL(target.objectUrl);
            }
            const nextSources = sourcesRef.current.filter((source) => source.id !== sourceId);
            sourcesRef.current = nextSources;
            setSources(nextSources);
            setProject((current) => {
              const nextPhotoIds = current.photoIds.filter((id) => id !== sourceId);
              const nextPhotoCrops = { ...current.photoCrops };
              delete nextPhotoCrops[sourceId];
              return syncProjectWithSources(current, nextPhotoIds, nextPhotoCrops, current.activePhotoId);
            });
            if (nextSources.length === 0) {
              setScreen("home");
              setPreviewStatus("等待图片上传");
            }
          }}
          onOpenMoreFiles={() => openPicker("append")}
          onSetPhotoCrop={updatePhotoCrop}
          onUpdateLayout={(patch) =>
            setProject((current) => {
              const nextLayout = {
                ...current.layout,
                ...patch
              };
              const canvas = patch.canvasPreset
                ? getCanvasDimensions(patch.canvasPreset)
                : { width: current.canvasWidth, height: current.canvasHeight };
              return {
                ...current,
                layout: nextLayout,
                canvasWidth: canvas.width,
                canvasHeight: canvas.height
              };
            })
          }
          onSetLayoutMode={(layoutMode) =>
            setProject((current) => ({
              ...current,
              layoutMode
            }))
          }
          onSetLayoutDirection={(layoutDirection) =>
            setProject((current) => ({
              ...current,
              layoutDirection
            }))
          }
          onSetFillBlockEnabled={(fillBlockEnabled) =>
            setProject((current) => ({
              ...current,
              fillBlockEnabled
            }))
          }
          onSetFillBlockDotsEnabled={(fillBlockDotsEnabled) =>
            setProject((current) => ({
              ...current,
              fillBlockDotsEnabled
            }))
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
                ...resetTheme.base
              },
              dots: {
                ...defaultDots,
                ...resetTheme.dots
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
          onUpdateExportFormat={(format) =>
            setProject((current) => ({
              ...current,
              exportFormat: format
            }))
          }
          onRandomize={handleRandomize}
          onExport={() => void handleExport()}
          onBack={() => {
            setScreen("home");
            setPreviewStatus("等待图片上传");
          }}
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
      layoutMode: project.layoutMode,
      layoutDirection: project.layoutDirection,
      fillBlockEnabled: project.fillBlockEnabled,
      fillBlockDotsEnabled: project.fillBlockDotsEnabled,
      layout: project.layout,
      base: project.base,
      dots: project.dots,
      exportFormat: project.exportFormat
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // ignore local storage failures
  }
}
