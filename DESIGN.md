# POIS Art — Design System

> 波点照片海报生成器的完整设计规范。此文件是 AI 代理构建一致 UI 的参考标准。

---

## 1. 视觉主题与氛围

**品牌定位**：创意工具，温暖、精致、直觉友好。让普通用户也能做出有品质的波点海报。

**设计语言**：
- 暖米色底板搭配深蓝强调色，柔和而专业
- 卡片式布局，圆角大、阴影轻、留白足
- 减法哲学：不过度装饰，每个元素都有意图
- 波点艺术感渗透进界面细节（圆形按钮、pill 标签）

---

## 2. 色彩板

### 基础色彩

| Token | Hex | 用途 |
|-------|-----|------|
| `--bg` | `#f3eee7` | 页面背景（暖米色） |
| `--surface` | `#fcf8f2` | 卡片/面板背景 |
| `--surface-strong` | `#ffffff` | 强调表面（纯白） |
| `--ink` | `#343b43` | 主文本 |
| `--muted` | `#6a6866` | 辅助文字（对比度 ≥5.1:1） |

### 边框与阴影

| Token | 值 | 用途 |
|-------|-----|------|
| `--line` | `rgba(115, 108, 99, 0.22)` | 标准边框线 |
| `--line-strong` | `rgba(82, 77, 71, 0.28)` | 加强边框 |
| `--shadow` | `0 2px 12px -2px rgba(36,44,52,0.08), 0 1px 4px -1px rgba(36,44,52,0.05)` | 默认阴影 |
| `--shadow-hover` | `0 8px 24px -4px rgba(36,44,52,0.1), 0 2px 8px -2px rgba(36,44,52,0.06)` | 悬停阴影 |

### 品牌色

| Token | 值 | 用途 |
|-------|-----|------|
| `--accent` | `#2b6f89` | 主品牌色（深海蓝） |
| `--accent-soft` | `rgba(43, 111, 137, 0.12)` | 选中背景、强调背景 |

### 圆角系统

| Token | 值 | 用途 |
|-------|-----|------|
| `--radius-lg` | `1rem (16px)` | 小组件（chip, tag） |
| `--radius-xl` | `1.25rem (20px)` | 中型卡片 |
| `--radius-2xl` | `1.5rem (24px)` | 主要卡片（hero, panel, header） |

---

## 3. 排版规则

### 字体族

```
主中文：Noto Sans SC（权重 300/400/500/600/700）
主英文：Inter（权重 300/400/500/600/700）
降级：Helvetica Neue, sans-serif
```

### 字体层级

| 层级 | 大小 | 权重 | 行高 | 用途 |
|------|------|------|------|------|
| 英雄标题 | `clamp(2rem, 4vw, 3.2rem)` | 700 | 1.05 | Hero h1 |
| 大标题 | `2.15rem` | 700 | 1 | 工具栏标题 |
| 主标题 | `1.25rem` | 600 | 1.3 | 侧边栏 h2 |
| 副标题 | `1.2rem` | 600 | 1.3 | 画布 h2 |
| 正文 | `1rem` | 400 | 1.5 | 普通文本 |
| 辅助文字 | `0.9rem` | 400 | 1.45 | 提示文字 |
| 小标签 | `0.82rem` | 600 | 1.2 | 状态标签 |
| 分类标签 | `0.75rem` | 600 | 1 | panel-kicker（全大写） |
| 最小文字 | `0.76rem` | 400 | 1.3 | 辅助信息 |

**规则**：
- 最小字号不低于 0.75rem（12px）
- 辅助文字使用 `--muted` 颜色
- 分类标签（kicker）全大写 + 字间距 0.12em

---

## 4. 组件样式

### 按钮

**Primary Button**
```css
padding: 14px 20px;
min-height: 44px;  /* 移动端触摸规范 */
background: hsl(195 40% 35%);  /* 深蓝 */
color: #fff;
font-weight: 600;
border-radius: 999px;
```

**Secondary Button / Icon Chip**
```css
padding: 11px 16px;
background: rgba(255, 255, 255, 0.84);
border: 1px solid var(--line);
border-radius: 999px;
```

**状态**：
- Hover：`translateY(-1px)` + `--shadow-hover`
- Disabled：`opacity 0.58` + `cursor: not-allowed`
- Focus：`outline: 2px solid var(--accent); outline-offset: 2px`

### 卡片

**主卡片**（hero, header, panel, preview）
```css
background: var(--surface);
border: 1px solid var(--line);
border-radius: var(--radius-2xl);
box-shadow: var(--shadow);
```

**选择卡片**（choice-card）
```css
padding: 14px;
border: 1px solid var(--line);
border-radius: 14px;
background: rgba(255, 255, 255, 0.82);
/* Active 状态 */
border-color: var(--accent);
border-width: 2px;
background: var(--accent-soft);
```

**控制卡片**（control-card）
```css
padding: 14px;
border-radius: 14px;
background: rgba(255, 255, 255, 0.86);
border: 1px solid var(--line);
```

### 图片芯片（image-chip）

```css
flex: 0 0 148px;
min-height: 100px;
border-radius: 999px;  /* pill 形状 */
border: 1px solid var(--line);
/* Active */
border-color: rgba(43, 111, 137, 0.55);
box-shadow: 0 0 0 3px rgba(43, 111, 137, 0.08);
```

关闭按钮：28×28px（符合触摸规范）

### 状态标签（status-pill）

```css
padding: 8px 12px;
border-radius: 999px;
font-size: 0.82rem;
font-weight: 600;
```

### 分段控制（segmented-control）

```css
padding: 4px;
border-radius: 999px;
background: rgba(232, 226, 217, 0.72);
/* Active 分段 */
background: rgba(255, 255, 255, 0.94);
font-weight: 600;
```

---

## 5. 布局原则

### 间距标度

| 用途 | 值 |
|------|-----|
| 组件内间距 | 8px |
| 卡片内 gap | 10-14px |
| 面板内 gap | 14px |
| 主区域 gap | 10-18px |
| 卡片 padding | 16px |
| 侧边栏 padding | 14px |

### 编辑器主布局

```
画布区 : 侧边栏 = ~70% : ~30%
侧边栏宽度：clamp(280px, 30%, 380px)
```

**响应式**：
- `≥720px`：双列（画布 + 侧边栏）
- `<720px`：单列堆叠，侧边栏在下方

### 首页布局

```
英雄区：单列全宽
示例展示：3 列等宽（≥720px）→ 1 列（<720px）
```

---

## 6. 深度与层级

阴影层级从浅到深：

| 层级 | 用途 | 阴影值 |
|------|------|--------|
| L0 | 无阴影（内嵌元素） | none |
| L1 | 标准卡片 | `--shadow` |
| L2 | 悬停卡片 | `--shadow-hover` |
| L3 | 浮动弹层（export sheet）| `backdrop: rgba(52,59,67,0.28)` |

---

## 7. 设计护栏与禁忌

**✅ 应该做**：
- 画布区域永远比侧边栏宽（约 70:30 比例）
- 触摸目标最小 44×44px
- 辅助文字对比度 ≥ AA+（5:1）
- 圆角使用 CSS 变量
- 活跃状态用实色边框（不用半透明）

**❌ 禁止做**：
- 侧边栏不得超过视口的 35%
- 不使用纯黑色（用 `--ink: #343b43`）
- 不使用不透明度低于 0.3 的颜色作为边框
- 不在活跃状态只靠背景色区分（必须有边框变化）
- 按钮 focus 轮廓不得低于 2px solid
- 不在 1024px 以上触发单列堆叠

---

## 8. 响应式行为

| 断点 | 布局变化 |
|------|---------|
| `>1200px` | 编辑器 2 列，侧边栏 360-380px，3 面板同时可见 |
| `980px-1200px` | 编辑器 2 列，侧边栏 280-360px，显示面板切换 tab |
| `720px-980px` | 编辑器 2 列，侧边栏 280px，面板 tab 切换 |
| `<720px` | 编辑器单列，侧边栏在下，面板 tab 切换 |

**页面 padding**：
- `>720px`：16px
- `<720px`：8px

**字体**：使用 clamp() 实现流体字体，不硬设断点字号。

---

## 9. AI 提示指南

快速颜色参考：
- 页面背景：`#f3eee7`
- 卡片背景：`#fcf8f2`
- 主文本：`#343b43`
- 辅助文字：`#6a6866`
- 强调色：`#2b6f89`
- 边框：`rgba(115, 108, 99, 0.22)`

构建新组件时的提示词：
```
参照 DESIGN.md 的设计规范，使用 CSS 变量（--bg, --surface, --ink, --muted, --accent, --accent-soft, --line, --shadow），圆角使用 --radius-2xl (24px)，按钮符合 44px 最小高度，活跃状态使用实色 var(--accent) 边框 2px。
```
