import type {
  LayoutDirection,
  LayoutMode,
  ProjectState
} from "../types";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasRegion {
  id: string;
  kind: "photo" | "fill";
  rect: Rect;
  photoId?: string;
}

export function resolveCanvasRegions(
  project: ProjectState,
  width: number,
  height: number
): CanvasRegion[] {
  const photoIds = project.photoIds.slice(0, 2);
  const { padding, gap, fillRatio } = project.layout;
  const contentRect: Rect = {
    x: padding,
    y: padding,
    width: Math.max(1, width - padding * 2),
    height: Math.max(1, height - padding * 2)
  };

  if (photoIds.length === 0) {
    return [];
  }

  const layoutMode = photoIds.length >= 2 ? "double" : "single";
  if (layoutMode === "single") {
    return resolveSingleRegions(
      photoIds[0],
      contentRect,
      project.layoutDirection,
      project.fillBlockEnabled,
      fillRatio,
      gap
    );
  }

  return resolveDoubleRegions(
    photoIds,
    contentRect,
    project.layoutDirection,
    project.fillBlockEnabled,
    fillRatio,
    gap
  );
}

export function getSuggestedEditorState(photoCount: number) {
  if (photoCount <= 1) {
    return {
      layoutMode: "single" as LayoutMode,
      fillBlockEnabled: true,
      layoutDirection: "horizontal" as LayoutDirection
    };
  }

  return {
    layoutMode: "double" as LayoutMode,
    fillBlockEnabled: false,
    layoutDirection: "horizontal" as LayoutDirection
  };
}

export function getDefaultLayoutMetrics() {
  return {
    padding: 8,
    gap: 6,
    fillRatio: 0.24
  };
}

function resolveSingleRegions(
  photoId: string,
  rect: Rect,
  direction: LayoutDirection,
  fillEnabled: boolean,
  fillRatio: number,
  gap: number
) {
  if (!fillEnabled) {
    return [
      {
        id: `photo-${photoId}`,
        kind: "photo" as const,
        rect,
        photoId
      }
    ];
  }

  if (direction === "vertical") {
    const fillHeight = Math.round(rect.height * fillRatio);
    const photoHeight = Math.max(1, rect.height - fillHeight - gap);
    const fillY = rect.y + photoHeight + gap;
    return [
      {
        id: `photo-${photoId}`,
        kind: "photo" as const,
        rect: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: photoHeight
        },
        photoId
      },
      {
        id: "fill-block",
        kind: "fill" as const,
        rect: {
          x: rect.x,
          y: fillY,
          width: rect.width,
          height: Math.max(1, rect.y + rect.height - fillY)
        }
      }
    ];
  }

  const fillWidth = Math.round(rect.width * fillRatio);
  const photoWidth = Math.max(1, rect.width - fillWidth - gap);
  const fillX = rect.x + photoWidth + gap;
  return [
    {
      id: `photo-${photoId}`,
      kind: "photo" as const,
      rect: {
        x: rect.x,
        y: rect.y,
        width: photoWidth,
        height: rect.height
      },
      photoId
    },
    {
      id: "fill-block",
      kind: "fill" as const,
      rect: {
        x: fillX,
        y: rect.y,
        width: Math.max(1, rect.x + rect.width - fillX),
        height: rect.height
      }
    }
  ];
}

function resolveDoubleRegions(
  photoIds: string[],
  rect: Rect,
  direction: LayoutDirection,
  fillEnabled: boolean,
  fillRatio: number,
  gap: number
) {
  if (!fillEnabled) {
    if (direction === "vertical") {
      const topHeight = Math.max(1, Math.round((rect.height - gap) / 2));
      const bottomY = rect.y + topHeight + gap;
      return [
        {
          id: `photo-${photoIds[0]}`,
          kind: "photo" as const,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: topHeight },
          photoId: photoIds[0]
        },
        {
          id: `photo-${photoIds[1]}`,
          kind: "photo" as const,
          rect: {
            x: rect.x,
            y: bottomY,
            width: rect.width,
            height: Math.max(1, rect.y + rect.height - bottomY)
          },
          photoId: photoIds[1]
        }
      ];
    }

    const leftWidth = Math.max(1, Math.round((rect.width - gap) / 2));
    const rightX = rect.x + leftWidth + gap;
    return [
      {
        id: `photo-${photoIds[0]}`,
        kind: "photo" as const,
        rect: { x: rect.x, y: rect.y, width: leftWidth, height: rect.height },
        photoId: photoIds[0]
      },
      {
        id: `photo-${photoIds[1]}`,
        kind: "photo" as const,
        rect: {
          x: rightX,
          y: rect.y,
          width: Math.max(1, rect.x + rect.width - rightX),
          height: rect.height
        },
        photoId: photoIds[1]
      }
    ];
  }

  if (direction === "vertical") {
    const fillHeight = Math.round(rect.height * fillRatio);
    const photoBandHeight = Math.max(1, rect.height - fillHeight - gap);
    const fillY = rect.y + photoBandHeight + gap;
    const leftWidth = Math.max(1, Math.round((rect.width - gap) / 2));
    const rightX = rect.x + leftWidth + gap;
    return [
      {
        id: `photo-${photoIds[0]}`,
        kind: "photo" as const,
        rect: { x: rect.x, y: rect.y, width: leftWidth, height: photoBandHeight },
        photoId: photoIds[0]
      },
      {
        id: `photo-${photoIds[1]}`,
        kind: "photo" as const,
        rect: {
          x: rightX,
          y: rect.y,
          width: Math.max(1, rect.x + rect.width - rightX),
          height: photoBandHeight
        },
        photoId: photoIds[1]
      },
      {
        id: "fill-block",
        kind: "fill" as const,
        rect: {
          x: rect.x,
          y: fillY,
          width: rect.width,
          height: Math.max(1, rect.y + rect.height - fillY)
        }
      }
    ];
  }

  const fillWidth = Math.round(rect.width * fillRatio);
  const photoBandWidth = Math.max(1, rect.width - fillWidth - gap);
  const fillX = rect.x + photoBandWidth + gap;
  const topHeight = Math.max(1, Math.round((rect.height - gap) / 2));
  const bottomY = rect.y + topHeight + gap;
  return [
    {
      id: `photo-${photoIds[0]}`,
      kind: "photo" as const,
      rect: { x: rect.x, y: rect.y, width: photoBandWidth, height: topHeight },
      photoId: photoIds[0]
    },
    {
      id: `photo-${photoIds[1]}`,
      kind: "photo" as const,
      rect: {
        x: rect.x,
        y: bottomY,
        width: photoBandWidth,
        height: Math.max(1, rect.y + rect.height - bottomY)
      },
      photoId: photoIds[1]
    },
    {
      id: "fill-block",
      kind: "fill" as const,
      rect: {
        x: fillX,
        y: rect.y,
        width: Math.max(1, rect.x + rect.width - fillX),
        height: rect.height
      }
    }
  ];
}
