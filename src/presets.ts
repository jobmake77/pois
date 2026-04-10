import type {
  BaseSettings,
  DotSettings,
  LayoutSettings,
  ThemePreset
} from "./types";

export const defaultLayout: LayoutSettings = {
  padding: 6,
  gap: 0,
  fillRatio: 0.2,
  canvasPreset: "poster"
};

export const defaultBase: BaseSettings = {
  style: "stripes",
  primaryColor: "#2b6f89",
  secondaryColor: "#f3efe3",
  stripeThickness: 38,
  backgroundTone: "#f8f1e5"
};

export const defaultDots: DotSettings = {
  shape: "star",
  dotSize: 34,
  sizeVariance: 64,
  dotCount: 28,
  decorativeCount: 20,
  distribution: "random",
  primaryBlockShare: 0.58,
  photoBlockDistribution: "random",
  fillBlockDistribution: "random",
  fillMode: "image-cutout",
  opacity: 0.94,
  seed: 7
};

export const themePresets: ThemePreset[] = [
  {
    id: "starry-tide",
    name: "星星海报",
    description: "海边蓝白条纹，轻盈漂浮的星点。",
    palette: {
      primary: "#2b6f89",
      secondary: "#f2efe5",
      accent: "#7ca5dd",
      surface: "#ede7dc"
    },
    layout: { fillRatio: 0.2 },
    base: {
      style: "stripes",
      primaryColor: "#2b6f89",
      secondaryColor: "#f7f3e7",
      stripeThickness: 38
    },
    dots: {
      shape: "star",
      dotSize: 34,
      dotCount: 28,
      decorativeCount: 22,
      fillMode: "image-cutout"
    }
  },
  {
    id: "pool-drip",
    name: "雨滴海报",
    description: "浅蓝底板搭配垂落水滴，画面更清透。",
    palette: {
      primary: "#d4edf4",
      secondary: "#f8f4e8",
      accent: "#74c8e4",
      surface: "#f4efe3"
    },
    layout: { fillRatio: 0.19 },
    base: {
      style: "stripes",
      primaryColor: "#d4edf4",
      secondaryColor: "#f8f4e8",
      stripeThickness: 40
    },
    dots: {
      shape: "drop",
      dotSize: 36,
      dotCount: 26,
      decorativeCount: 20,
      fillMode: "image-cutout",
      primaryBlockShare: 0.6
    }
  },
  {
    id: "soft-snow",
    name: "雪花海报",
    description: "柔和纯底配像素雪花，更适合夜色和室内光。",
    palette: {
      primary: "#d8c5f5",
      secondary: "#f8f1ff",
      accent: "#6d56a7",
      surface: "#f1e9ff"
    },
    layout: {},
    base: {
      style: "solid",
      primaryColor: "#d8c5f5",
      secondaryColor: "#f8f1ff",
      stripeThickness: 24
    },
    dots: {
      shape: "snowflake",
      dotSize: 32,
      dotCount: 24,
      decorativeCount: 18,
      fillMode: "solid"
    }
  },
  {
    id: "mono-dots",
    name: "圆点海报",
    description: "黑白条纹和圆点贴片，极简但有冲击力。",
    palette: {
      primary: "#0b0b0d",
      secondary: "#fff7dc",
      accent: "#d7ceb8",
      surface: "#f4ead1"
    },
    layout: {},
    base: {
      style: "stripes",
      primaryColor: "#040406",
      secondaryColor: "#fff7dc",
      stripeThickness: 36
    },
    dots: {
      shape: "circle",
      dotSize: 32,
      dotCount: 30,
      decorativeCount: 18,
      fillMode: "image-cutout"
    }
  },
  {
    id: "pixel-night",
    name: "像素夜景",
    description: "暖色深底与方块采样，适合昏暗场景和夜景。",
    palette: {
      primary: "#3a0222",
      secondary: "#ffdcb9",
      accent: "#7f345e",
      surface: "#f2dfd5"
    },
    layout: { fillRatio: 0.19 },
    base: {
      style: "duotone",
      primaryColor: "#3a0222",
      secondaryColor: "#ffdcb9",
      stripeThickness: 34
    },
    dots: {
      shape: "square",
      dotSize: 34,
      dotCount: 28,
      decorativeCount: 16,
      fillMode: "image-cutout"
    }
  }
];

export function getThemeById(themeId: string): ThemePreset {
  return themePresets.find((theme) => theme.id === themeId) ?? themePresets[0];
}
