import type { PanelDirection, ProjectState, SourceAsset } from "../types";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasPanel {
  id: "primary" | "secondary";
  role: "primary" | "secondary";
  kind: "photo" | "fill";
  rect: Rect;
  photoId?: string;
}

export function resolvePanels(
  project: ProjectState,
  width: number,
  height: number,
  sources: SourceAsset[] = []
): CanvasPanel[] {
  const photoIds = project.photoIds.slice(0, 2);
  if (photoIds.length === 0) {
    return [];
  }

  const padding = width < 520 ? Math.min(project.layout.padding, 4) : project.layout.padding;
  const gap = width < 520 ? Math.min(project.layout.gap, 3) : project.layout.gap;
  const contentRect: Rect = {
    x: padding,
    y: padding,
    width: Math.max(1, width - padding * 2),
    height: Math.max(1, height - padding * 2)
  };

  if (photoIds.length === 1) {
    const source = sources.find((item) => item.id === photoIds[0]);
    if (source) {
      return resolveSinglePhotoPanels(
        contentRect,
        project.panelDirection,
        gap,
        source,
        photoIds[0],
        project.fillPhotoId
      );
    }
  }

  const secondaryKind = photoIds.length >= 2 ? "photo" : "fill";
  const secondaryPhotoId = photoIds.length >= 2 ? photoIds[1] : undefined;
  const primaryRect = getPrimaryRect(
    contentRect,
    project.panelDirection,
    project.primaryShare,
    gap
  );
  const secondaryRect = getSecondaryRect(contentRect, primaryRect, project.panelDirection, gap);

  return [
    {
      id: "primary" as const,
      role: "primary" as const,
      kind: "photo" as const,
      rect: primaryRect,
      photoId: photoIds[0]
    },
    {
      id: "secondary" as const,
      role: "secondary" as const,
      kind: secondaryKind as "photo" | "fill",
      rect: secondaryRect,
      photoId: secondaryPhotoId
    }
  ].filter((panel) => panel.rect.width > 0 && panel.rect.height > 0);
}

function resolveSinglePhotoPanels(
  contentRect: Rect,
  direction: PanelDirection,
  gap: number,
  source: Pick<SourceAsset, "width" | "height">,
  photoId: string,
  fillPhotoId?: string
): CanvasPanel[] {
  const aspectRatio = Math.max(0.05, source.width / Math.max(1, source.height));

  if (direction === "vertical") {
    const fullWidthHeight = contentRect.width / aspectRatio;
    const rawPanelHeight =
      fullWidthHeight * 2 + gap <= contentRect.height
        ? fullWidthHeight
        : Math.max(1, (contentRect.height - gap) / 2);
    const panelHeight = Math.max(
      1,
      Math.min(Math.round(rawPanelHeight), Math.floor((contentRect.height - gap) / 2))
    );
    const panelWidth = Math.max(
      1,
      Math.min(Math.round(rawPanelHeight * aspectRatio), contentRect.width)
    );
    const packedHeight = panelHeight * 2 + gap;
    const startX = contentRect.x + Math.round((contentRect.width - panelWidth) / 2);
    const startY = contentRect.y + Math.round((contentRect.height - packedHeight) / 2);

    return [
      {
        id: "primary",
        role: "primary",
        kind: "photo",
        rect: {
          x: startX,
          y: startY,
          width: panelWidth,
          height: panelHeight
        },
        photoId
      },
      {
        id: "secondary",
        role: "secondary",
        kind: fillPhotoId ? "photo" : "fill",
        rect: {
          x: startX,
          y: startY + panelHeight + gap,
          width: panelWidth,
          height: panelHeight
        },
        photoId: fillPhotoId
      }
    ];
  }

  const fullHeightWidth = contentRect.height * aspectRatio;
  const rawPanelWidth =
    fullHeightWidth * 2 + gap <= contentRect.width
      ? fullHeightWidth
      : Math.max(1, (contentRect.width - gap) / 2);
  const panelWidth = Math.max(
    1,
    Math.min(Math.round(rawPanelWidth), Math.floor((contentRect.width - gap) / 2))
  );
  const panelHeight = Math.max(
    1,
    Math.min(Math.round(rawPanelWidth / aspectRatio), contentRect.height)
  );
  const packedWidth = panelWidth * 2 + gap;
  const startX = contentRect.x + Math.round((contentRect.width - packedWidth) / 2);
  const startY = contentRect.y + Math.round((contentRect.height - panelHeight) / 2);

  return [
    {
      id: "primary",
      role: "primary",
      kind: "photo",
      rect: {
        x: startX,
        y: startY,
        width: panelWidth,
        height: panelHeight
      },
      photoId
    },
    {
      id: "secondary",
      role: "secondary",
      kind: fillPhotoId ? "photo" : "fill",
      rect: {
        x: startX + panelWidth + gap,
        y: startY,
        width: panelWidth,
        height: panelHeight
      },
      photoId: fillPhotoId
    }
  ];
}

export function getSuggestedEditorState(photoCount: number) {
  if (photoCount <= 1) {
    return {
      layoutMode: "single" as const,
      panelDirection: "horizontal" as const,
      primaryShare: 0.5,
      fillBlockEnabled: true
    };
  }

  return {
    layoutMode: "double" as const,
    panelDirection: "horizontal" as const,
    primaryShare: 0.5,
    fillBlockEnabled: false
  };
}

export function getDefaultLayoutMetrics() {
  return {
    padding: 0,
    gap: 0,
    primaryShare: 0.5
  };
}

function getPrimaryRect(
  contentRect: Rect,
  direction: PanelDirection,
  share: number,
  gap: number
) {
  const safeShare = Math.min(0.86, Math.max(0.14, share));
  if (direction === "vertical") {
    const height = Math.max(1, Math.round((contentRect.height - gap) * safeShare));
    return {
      x: contentRect.x,
      y: contentRect.y,
      width: contentRect.width,
      height
    };
  }

  const width = Math.max(1, Math.round((contentRect.width - gap) * safeShare));
  return {
    x: contentRect.x,
    y: contentRect.y,
    width,
    height: contentRect.height
  };
}

function getSecondaryRect(
  contentRect: Rect,
  primaryRect: Rect,
  direction: PanelDirection,
  gap: number
): Rect {
  if (direction === "vertical") {
    const y = primaryRect.y + primaryRect.height + gap;
    return {
      x: contentRect.x,
      y,
      width: contentRect.width,
      height: Math.max(0, contentRect.y + contentRect.height - y)
    };
  }

  const x = primaryRect.x + primaryRect.width + gap;
  return {
    x,
    y: contentRect.y,
    width: Math.max(0, contentRect.x + contentRect.width - x),
    height: contentRect.height
  };
}
