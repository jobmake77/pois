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
  const effectiveDirection = getEffectiveDirection(project, width, photoIds.length);
  const effectivePadding = width < 520 ? Math.min(project.layout.padding, 4) : project.layout.padding;
  const effectiveGap = width < 520 ? Math.min(project.layout.gap, 3) : project.layout.gap;
  const effectiveFillRatio = getEffectiveFillRatio(
    project.layout.fillRatio,
    effectiveDirection,
    width,
    photoIds.length,
    project.fillBlockEnabled
  );
  const contentRect: Rect = {
    x: effectivePadding,
    y: effectivePadding,
    width: Math.max(1, width - effectivePadding * 2),
    height: Math.max(1, height - effectivePadding * 2)
  };

  if (photoIds.length === 0) {
    return [];
  }

  const layoutMode = photoIds.length >= 2 ? "double" : "single";
  if (layoutMode === "single") {
    return resolveSingleRegions(
      photoIds[0],
      contentRect,
      effectiveDirection,
      project.fillBlockEnabled,
      effectiveFillRatio,
      effectiveGap
    );
  }

  return resolveDoubleRegions(
    photoIds,
    contentRect,
    effectiveDirection,
    project.fillBlockEnabled,
    effectiveFillRatio,
    effectiveGap
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
    padding: 6,
    gap: 0,
    fillRatio: 0.2
  };
}

function getEffectiveDirection(project: ProjectState, width: number, photoCount: number) {
  if (!project.fillBlockEnabled) {
    return project.layoutDirection;
  }
  if (width >= 680) {
    return project.layoutDirection;
  }
  if (photoCount === 1) {
    return "vertical" as const;
  }
  if (photoCount >= 2 && project.layoutDirection === "horizontal") {
    return "vertical" as const;
  }
  return project.layoutDirection;
}

function getEffectiveFillRatio(
  fillRatio: number,
  direction: LayoutDirection,
  width: number,
  photoCount: number,
  fillEnabled: boolean
) {
  if (!fillEnabled) {
    return fillRatio;
  }
  if (width >= 680) {
    return fillRatio;
  }
  if (photoCount === 1 && direction === "vertical") {
    return Math.max(fillRatio, 0.26);
  }
  if (photoCount >= 2 && direction === "vertical") {
    return Math.max(fillRatio, 0.22);
  }
  return fillRatio;
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
