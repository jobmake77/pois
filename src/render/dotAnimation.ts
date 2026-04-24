import type { ProjectState } from "../types";

export function getAnimationDotCount(project: ProjectState) {
  if (project.dots.distribution === "random") {
    return Math.max(0, project.dots.dotCount);
  }

  return project.dotPlacements.strokes.reduce((sum, stroke) => sum + stroke.dotIds.length, 0);
}

export function createAnimationProject(project: ProjectState, visibleDotCount: number): ProjectState {
  const clampedCount = Math.max(0, Math.floor(visibleDotCount));

  if (project.dots.distribution === "random") {
    return {
      ...project,
      dots: {
        ...project.dots,
        dotCount: Math.min(project.dots.dotCount, clampedCount),
        decorativeCount: Math.min(project.dots.decorativeCount, clampedCount)
      }
    };
  }

  const visibleIds = new Set<string>();
  let remaining = clampedCount;
  const strokes = project.dotPlacements.strokes
    .map((stroke) => {
      if (remaining <= 0) {
        return null;
      }

      const dotIds = stroke.dotIds.slice(0, remaining);
      if (dotIds.length === 0) {
        return null;
      }

      dotIds.forEach((dotId) => visibleIds.add(dotId));
      remaining -= dotIds.length;
      return {
        ...stroke,
        dotIds
      };
    })
    .filter((stroke): stroke is ProjectState["dotPlacements"]["strokes"][number] => Boolean(stroke));

  return {
    ...project,
    dotPlacements: {
      ...project.dotPlacements,
      primary: project.dotPlacements.primary.filter((dot) => visibleIds.has(dot.id)),
      secondary: project.dotPlacements.secondary.filter((dot) => visibleIds.has(dot.id)),
      shared: project.dotPlacements.shared.filter((dot) => visibleIds.has(dot.id)),
      strokes
    }
  };
}
