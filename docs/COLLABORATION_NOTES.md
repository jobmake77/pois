# Pois Art 协作开发说明

这份文档不是产品介绍，而是给后续协作者和 AI 代理的工程接手说明。目标是减少重复判断，明确当前哪些行为是故意收敛后的结果，哪些地方仍然只是过渡实现。

## 1. 当前交互约束

### 1.1 产品路径约束

当前主路径固定为：

- 首页只上传一张 `主照片`
- 进入编辑页后，画板固定为 `双 panel`
- 第二块默认是 `填充块`
- 用户可以在编辑页里额外上传一张 `填充块照片`
- 导出仍然基于整个成品画板，而不是单独导出某个 panel

这意味着当前不应该随手恢复下面这些旧能力：

- 首页一次上传多张图
- 顶部图片列表/素材带
- 多模板拼图入口
- 主副 panel 比例、留白、块间距等面向用户暴露的布局参数
- 填充块独立裁切 UI

如果要重新开放这些能力，应该先回到方案设计，而不是直接从组件层面把旧控件加回来。

### 1.2 当前 UI 约束

编辑页目前只保留三个面板：

- `布局`
- `填充块`
- `波点`

其中：

- `布局` 只允许切换 `horizontal / vertical`
- `填充块` 只负责底板样式与可选填充照片替换
- `波点` 只负责形状、分布、数量、透明度和随机种子相关参数

当前裁切交互只绑定在 `primary photo panel` 上。即使存在 `fillPhotoId`，secondary panel 里的照片也还没有独立手势编辑入口。这不是漏实现，而是当前版本的明确边界。

### 1.3 当前兼容性约束

`App.tsx` 里仍然保留了一些历史字段兼容逻辑，主要用于读取旧 draft：

- `layoutDirection` 会被兼容映射到 `panelDirection`
- `base.style === "duotone"` 会被收敛到 `stripes`
- 不再允许的 `dots.distribution` 会被回退到合法值
- 不再允许的 `dots.shape` (`square` / `text`) 会被回退到 `circle`

因此，看到这些分支不代表产品仍支持这些模式。后续改动时要区分：

- `仍在主路径上的能力`
- `仅为旧本地草稿兜底的兼容层`

## 2. 当前状态流

### 2.1 顶层状态归属

当前单一真源主要集中在 [`src/App.tsx`](/Users/a77/Desktop/pois/src/App.tsx)：

- `project`
  - 产品与渲染参数真源，包含布局、底板、波点、导出格式
- `sources`
  - 当前会话中真实加载过的图片资源
- `screen`
  - `home` / `editor`
- `activePanel`
  - 当前右侧正在编辑的面板
- `exportPreview`
  - 导出弹层的临时结果

当前没有引入额外状态库，`EditorScreen` 基本是受控视图，尽量不要把核心状态偷偷下沉到子组件。

### 2.2 图片输入状态流

文件选择通过 `filePickerModeRef` 区分两种入口：

- `replace-main`
- `replace-fill`

对应行为：

1. `replace-main`
   - 替换主照片
   - 保留现有填充块照片（如果存在）
   - 重建 `photoIds`
   - 只初始化主照片 crop
   - 切换到 `editor`

2. `replace-fill`
   - 要求当前已经存在主照片
   - 只更新 `fillPhotoId`
   - 不改变主照片状态
   - 当前不会为填充块生成单独编辑态

这里一个关键约束是：

- `project.photoIds` 当前只承载主照片
- `project.fillPhotoId` 单独承载填充块照片
- `activeSources` 再按顺序把两者合并成真正用于渲染的图片列表

不要把 `fillPhotoId` 直接塞回 `photoIds`，否则会重新打开一批旧的双照片逻辑，文档和交互都会失真。

### 2.3 画板求解状态流

布局求解集中在 [`src/render/blockLayout.ts`](/Users/a77/Desktop/pois/src/render/blockLayout.ts)。

核心规则：

- 当 `photoIds.length === 0` 时，不返回 panel
- 当 `photoIds.length === 1` 时，按主照片原始宽高比生成两个同尺寸 panel
- secondary panel 的 `kind` 由 `fillPhotoId` 决定
  - 有 `fillPhotoId` 时按 `photo`
  - 无 `fillPhotoId` 时按 `fill`

这也是当前“双 panel 看起来严格拼接”的根来源。后续如果修改 panel 生成逻辑，优先检查：

- 是否破坏了同尺寸拼接
- 是否破坏了 `horizontal / vertical` 之间的行为一致性
- 是否让 secondary panel 意外退回等比分栏逻辑

### 2.4 裁切与交互状态流

裁切几何在 [`src/render/crop.ts`](/Users/a77/Desktop/pois/src/render/crop.ts)，交互入口在 [`src/components/EditorScreen.tsx`](/Users/a77/Desktop/pois/src/components/EditorScreen.tsx)。

当前规则：

- 只有 primary photo panel 会生成可拖拽 hit target
- crop 存储在 `project.photoCrops`
- 实际写入前会经过 `clampPhotoCrop`
- 当方向切换或主图替换后，会重新 `normalizePhotoCrops`

因此如果后续发现“切换横竖后画面跳动”或“主图替换后 crop 异常”，优先检查：

- `resolvePanels(...)` 的目标 rect 是否变化
- `normalizePhotoCrops(...)` 是否保留了错误的旧 crop
- `createDefaultPhotoCrop(...)` 的默认 fit 是否仍然是当前想要的 `contain`

### 2.5 预览与导出状态流

预览和导出是两条相关但分开的链路：

1. 预览
   - `previewShellRef` + `ResizeObserver` 计算视口尺寸
   - `resolvePanels(...)` 生成 `previewPanels`
   - `renderPanelToCanvas(...)` 分别渲染 primary / secondary canvas

2. 导出
   - 读取 `project.canvasWidth / canvasHeight`
   - 优先走 Worker：[`src/render/workerClient.ts`](/Users/a77/Desktop/pois/src/render/workerClient.ts)
   - 回退主线程：[`src/render/engine.ts`](/Users/a77/Desktop/pois/src/render/engine.ts)
   - 结果写入 `exportPreview`

这里要注意两个现实约束：

- 预览尺寸和导出尺寸不是同一套分辨率
- “预览看着对，但导出有偏差”时，不要只盯着 CSS，应该直接核对 `resolvePanels(...)` 和渲染输入

### 2.6 Draft 持久化状态流

当前只有参数草稿会写入 `localStorage`，图片资源不会持久化。

持久化内容包括：

- theme/layout/base/dots/export format
- 若字段来自旧版本，会在 `readDraft()` 里进行兼容修正

这意味着：

- 刷新后 UI 参数可能保留
- 但图片需要重新上传
- 任何“恢复上次编辑”的需求，都还不是完整能力

## 3. 协作修改建议

### 3.1 适合直接改的区域

- 面板文案与控件组织：[`src/components/EditorScreen.tsx`](/Users/a77/Desktop/pois/src/components/EditorScreen.tsx)
- 首页文案与引导：[`src/components/HomeScreen.tsx`](/Users/a77/Desktop/pois/src/components/HomeScreen.tsx)
- 默认主题与参数：[`src/presets.ts`](/Users/a77/Desktop/pois/src/presets.ts)
- 布局与裁切算法：[`src/render/blockLayout.ts`](/Users/a77/Desktop/pois/src/render/blockLayout.ts)、[`src/render/crop.ts`](/Users/a77/Desktop/pois/src/render/crop.ts)
- 渲染表现：[`src/render/engine.ts`](/Users/a77/Desktop/pois/src/render/engine.ts)、[`src/render/dotModel.ts`](/Users/a77/Desktop/pois/src/render/dotModel.ts)

### 3.2 改动前应先确认的区域

- `ProjectState` 字段增删：[`src/types.ts`](/Users/a77/Desktop/pois/src/types.ts)
- 文件上传流转：[`src/App.tsx`](/Users/a77/Desktop/pois/src/App.tsx)
- 导出格式与导出入口：[`src/App.tsx`](/Users/a77/Desktop/pois/src/App.tsx)、[`src/components/ExportSheet.tsx`](/Users/a77/Desktop/pois/src/components/ExportSheet.tsx)

原因很直接：这些地方同时影响 UI、渲染、兼容性和草稿恢复，容易出现“看起来只动了一处，实际破坏三条链路”的问题。

## 4. 后续待办

下面的待办按“对当前主路径收益最大”排序，而不是按实现难度排序。

### P0

- 为 `single main photo + optional fill photo` 补最小自动化测试
- 补一套布局与 crop 的纯函数级测试，覆盖横竖切换和主图替换
- 校准预览与导出一致性，至少覆盖一张横图和一张竖图

### P1

- 给填充块照片补独立裁切能力，但不要先把交互直接做满，先定义它和主图裁切是否共享模型
- 梳理 `ProjectState` 中已经退场但仍残留影响的字段，判断哪些该保留兼容，哪些该正式移除
- 为首页到编辑页增加更明确的异常状态反馈，例如图片加载失败、超大图加载耗时等

### P2

- 评估是否需要撤销 / 重做
- 评估是否需要更细的导出预设，而不是只保留 `png/jpeg`
- 如果后续重新开放多图路径，先单独写状态模型方案，再动现有实现

## 5. 当前接手结论

目前这个项目最重要的不是“继续加选项”，而是保护已经收敛出的单主图双 panel 主路径。

如果后续协作目标是：

- 修精度
- 修交互手感
- 修导出一致性
- 补测试

那基本都能在当前架构内演进。

如果目标变成：

- 恢复多图拼贴
- 恢复更多模板
- 恢复副图独立编辑体系

那就不再是小修，而是产品模型重新打开，应该先回到方案阶段。
