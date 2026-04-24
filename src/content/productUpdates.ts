import type { ProductUpdateItem } from "../types";

export const productUpdates: ProductUpdateItem[] = [
  {
    id: "mosaic-dots",
    title: "新增马赛克波点",
    description: "现在可以使用更接近像素叠压效果的马赛克波点，画面会更有薄码质感。",
    date: "2026.04.24",
    category: "新功能",
    area: "波点"
  },
  {
    id: "random-reroll",
    title: "随机波点支持一键刷新",
    description: "随机分布模式下新增“随机一下”，可以快速重排波点位置和随机变化效果。",
    date: "2026.04.24",
    category: "体验优化",
    area: "波点"
  },
  {
    id: "palette-extract",
    title: "主图自动提取 6 个主色",
    description: "上传主图后会在左侧生成 6 个圆形主色块，方便直接参考和复制配色。",
    date: "2026.04.24",
    category: "新功能",
    area: "颜色"
  },
  {
    id: "webm-export",
    title: "新增波点生成过程动画导出",
    description: "除了 PNG 之外，现在还可以导出展示波点逐步生成过程的 WebM 动画。",
    date: "2026.04.24",
    category: "新功能",
    area: "导出"
  }
];
