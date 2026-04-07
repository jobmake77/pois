import type {
  BaseSettings,
  DotSettings,
  LayoutSettings,
  ThemePreset
} from "./types";

export const defaultLayout: LayoutSettings = {
  splitRatio: 0.56,
  padding: 18,
  cropX: 0,
  cropY: 0,
  decorativeEverywhere: true,
  compositionMode: "single",
  canvasPreset: "poster"
};

export const defaultBase: BaseSettings = {
  style: "stripes",
  primaryColor: "#2b6f89",
  secondaryColor: "#f3efe3",
  stripeThickness: 22,
  backgroundTone: "#f8f1e5"
};

export const defaultDots: DotSettings = {
  shape: "star",
  dotSize: 18,
  sizeVariance: 46,
  dotCount: 15,
  decorativeCount: 13,
  distribution: "random",
  topShare: 0.55,
  topDistribution: "random",
  bottomDistribution: "random",
  fillMode: "image-cutout",
  opacity: 0.92,
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
    layout: {
      splitRatio: 0.56
    },
    base: {
      style: "stripes",
      primaryColor: "#2b6f89",
      secondaryColor: "#f7f3e7",
      stripeThickness: 22
    },
    dots: {
      shape: "star",
      dotCount: 16,
      decorativeCount: 14,
      fillMode: "image-cutout",
      distribution: "random"
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
    layout: {
      splitRatio: 0.58
    },
    base: {
      style: "stripes",
      primaryColor: "#d4edf4",
      secondaryColor: "#f8f4e8",
      stripeThickness: 24
    },
    dots: {
      shape: "drop",
      dotCount: 14,
      decorativeCount: 12,
      fillMode: "image-cutout",
      distribution: "random",
      topShare: 0.57
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
    layout: {
      splitRatio: 0.48
    },
    base: {
      style: "solid",
      primaryColor: "#d8c5f5",
      secondaryColor: "#f8f1ff",
      stripeThickness: 24
    },
    dots: {
      shape: "snowflake",
      dotCount: 12,
      decorativeCount: 11,
      fillMode: "solid",
      distribution: "random"
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
    layout: {
      splitRatio: 0.5
    },
    base: {
      style: "stripes",
      primaryColor: "#040406",
      secondaryColor: "#fff7dc",
      stripeThickness: 20
    },
    dots: {
      shape: "circle",
      dotCount: 18,
      decorativeCount: 10,
      fillMode: "image-cutout",
      distribution: "random",
      topShare: 0.52
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
    layout: {
      splitRatio: 0.52
    },
    base: {
      style: "duotone",
      primaryColor: "#3a0222",
      secondaryColor: "#ffdcb9",
      stripeThickness: 22
    },
    dots: {
      shape: "square",
      dotCount: 16,
      decorativeCount: 8,
      fillMode: "image-cutout",
      distribution: "random"
    }
  },
  {
    id: "sunset-grid",
    name: "落日拼贴",
    description: "暖橘与深莓的撞色，更适合街景和黄昏。",
    palette: {
      primary: "#55213f",
      secondary: "#ffd8b2",
      accent: "#ff9f68",
      surface: "#f8eadf"
    },
    layout: {
      splitRatio: 0.5,
      compositionMode: "duo"
    },
    base: {
      style: "duotone",
      primaryColor: "#55213f",
      secondaryColor: "#ffd8b2",
      stripeThickness: 18
    },
    dots: {
      shape: "square",
      dotCount: 20,
      decorativeCount: 7,
      fillMode: "image-cutout",
      distribution: "random",
      topShare: 0.5
    }
  },
  {
    id: "mint-calm",
    name: "薄荷静物",
    description: "轻盈的薄荷绿和奶油白，适合食物与日常静物。",
    palette: {
      primary: "#b6e2d4",
      secondary: "#fff8ec",
      accent: "#6f9f92",
      surface: "#f5efe5"
    },
    layout: {
      splitRatio: 0.54
    },
    base: {
      style: "stripes",
      primaryColor: "#b6e2d4",
      secondaryColor: "#fff8ec",
      stripeThickness: 20
    },
    dots: {
      shape: "circle",
      dotCount: 17,
      decorativeCount: 10,
      fillMode: "color-sample",
      distribution: "random"
    }
  },
  {
    id: "candy-cloud",
    name: "糖霜云朵",
    description: "浅粉与蓝紫的柔和组合，适合人像和室内。",
    palette: {
      primary: "#e3c7ef",
      secondary: "#fff6fb",
      accent: "#8f74be",
      surface: "#faf0f6"
    },
    layout: {
      splitRatio: 0.46
    },
    base: {
      style: "solid",
      primaryColor: "#e3c7ef",
      secondaryColor: "#fff6fb"
    },
    dots: {
      shape: "snowflake",
      dotCount: 14,
      decorativeCount: 14,
      fillMode: "solid",
      distribution: "random"
    }
  },
  {
    id: "ink-paper",
    name: "纸感墨点",
    description: "偏文艺的纸感背景，适合黑白照片和展览记录。",
    palette: {
      primary: "#17181d",
      secondary: "#efe7d8",
      accent: "#8c7f70",
      surface: "#f4ecdf"
    },
    layout: {
      splitRatio: 0.53,
      compositionMode: "single"
    },
    base: {
      style: "stripes",
      primaryColor: "#17181d",
      secondaryColor: "#efe7d8",
      stripeThickness: 18
    },
    dots: {
      shape: "circle",
      dotCount: 12,
      decorativeCount: 6,
      fillMode: "image-cutout",
      distribution: "bottom-heavy"
    }
  },
  {
    id: "aqua-film",
    name: "青柠胶片",
    description: "更适合旅行和户外，顶部可用三联布局形成胶片感。",
    palette: {
      primary: "#265f66",
      secondary: "#eef6ce",
      accent: "#90d4ce",
      surface: "#f0f2de"
    },
    layout: {
      splitRatio: 0.48,
      compositionMode: "triptych"
    },
    base: {
      style: "duotone",
      primaryColor: "#265f66",
      secondaryColor: "#eef6ce",
      stripeThickness: 16
    },
    dots: {
      shape: "drop",
      dotCount: 16,
      decorativeCount: 9,
      fillMode: "image-cutout",
      distribution: "random"
    }
  }
];

export function getThemeById(themeId: string): ThemePreset {
  return (
    themePresets.find((theme) => theme.id === themeId) ?? themePresets[0]
  );
}
