# Albummm 交接文档（HANDOFF）

> 项目滚动交接记录。长期协作规则见根目录 [`AGENTS.md`](../AGENTS.md)；版本入口地图见 [`docs/versions.md`](versions.md)。

## 当前状态

线上（[GitHub Pages](https://cfyofjackie.github.io/albummm/)）只保留正式功能：首页、`#/story` 多页故事、`#/collage` 单张拼贴、`#/works` 我的作品。五代历史原型（V1/V2/V3 对照/V4）已于 2026-10-01 归档——文件仅在本地（.gitignore），旧 `?prototype=` 链接回落首页。HEAD `c33ede1`（2026-10-01）已推送并部署成功。

待办（详见「遗留问题」）：① `check/` 256MB 验证杂物可删；② 本地 `.git` 两个 `refs/codex/turn-diffs/checkpoints/*` 引用约 150MB 大图可清；③ 根目录 9 份历史 md 归档；④ deploy.yml 加测试门禁；⑤ 触屏横滑与 Safari 放大清晰度待真机复验。

---

## 项目全景（2026-10-01 首次整理）

### 1. 项目用途

手机优先的照片作品生成器：把一组照片排成可分享的作品（多页故事 / 单张拼贴），照片只在浏览器本机处理并保存在 IndexedDB，不上传任何服务器。部署于 GitHub Pages 子路径 `/albummm/`（`vite.config.js` 构建时设 base）。

### 2. 当前功能与入口

| 入口 | 功能 |
| --- | --- |
| 首页（`#/`，与 `#/works` 组成双面板横滑 pager） | 两个创作入口卡片 + 底部导航 + 我的作品列表（缩略图 / 删除 / 编辑中·已完成状态 / 上限 10 份） |
| `#/story` 多页故事（V3 `carousel-smart`） | 上传 1–24 张照片 → 智能分页（每页 2–4 张）→ 三种纸面风格 × 背景 × 边框/边缘/胶带材质 → 种子随机排版 → 逐页预览 → 按 4:5 / 3:4 / 4:3 各导出 1080 宽 PNG → 完成封存 |
| `#/collage` 单张拼贴（V5） | 正好 10 张合规照片（比例约束见 `src/v5-collage/layout.js`）→ 3:4 竖版固定排布（正式页锁定竖版）→ 边框 / 手帐涂鸦 / 四套背景 → 点照片进高清查看层 → 整板或取景三档导出（1600 / 2400 JPG + 无损 PNG）→ 完成封存 |
| `#/works` 我的作品 | 本机作品库；草稿打开进编辑页，已封存打开进展示态（可继续编辑） |

保存机制：IndexedDB 库 `albummm-works`，每次事务开-关连接，`MAX_WORKS = 10`，WebKit 存不了 Blob 时自动转字节数组兜底；预览图随作品持久化（打开提速，`fb4eb7b`）。

调试入口（不进生产包）：`#/dev/focus` 放大倍率调试页（`import.meta.env.DEV` 门控）；`?webkit=1` 在 Chromium 强制启用 Safari 停稳补清；`?decor=tier2`、`?backgrounds=masters` 是 story 页的视觉实验开关。

### 3. 项目结构

| 位置 | 职责 |
| --- | --- |
| `src/App.jsx` | hash 路由（优先）+ 旧 `?prototype=` 兼容入口；懒加载注册表（现仅 `carousel-smart` 与 `v5-reference-layout` 两个） |
| `src/home/` | 首页、PrimaryNav 底部导航、WorksPage 作品库、SealedEnd 封存页 |
| `src/v3-carousel/` | 多页故事（正式）。`prototypes/CarouselSmartPrototype.jsx` 是入口，本体在同目录 `CarouselScatterPrototype.jsx`；`layout/` 为排版引擎（分页/摆放/背景/装饰）带单测 |
| `src/v5-collage/` | 单张拼贴（正式）。`V5CollagePrototype` 编辑页、`V5FocusViewer` 高清查看层、`focusExport`（快照/导出统一渲染器）、`focusGeometry`、`layout`；`assets/` 六张背景图（其中两张 2026-10-01 从 `reference/` 复制而来） |
| `src/shared/` | `photo.js` 照片读取管线（EXIF 方向、1600px 预览、blob URL 生命周期）、`works.js` IndexedDB 作品库、`demo.js` 演示图生成 |
| `src/dev/` | `#/dev/focus` 调试页，仅 dev 构建注册 |
| `src/v1-book/` `src/v2-collage/` `src/v4-gallery/` | **已归档**：文件仅本地保留（.gitignore），不进仓库与部署 |
| `docs/` | `versions.md` 版本地图、本文件、`v3-carousel/`（V3 期间 8 份记录）、两份整合交接文档 |
| `reference/` | 本地设计素材库，不入库（2026-10-01 起整目录 gitignore） |
| `check/` | 历次验证的截图/录屏/探测脚本工作区（gitignore，可清理） |
| `.github/workflows/deploy.yml` | push main → `npm ci && npm run build` → GitHub Pages（不跑测试） |
| `vite.config.js` | base `/albummm/`、dev 端口 5174（strictPort）、vitest 排除归档目录 |

### 4. 运行与检查方法

```bash
npm install        # 安装依赖
npm run dev        # dev server，固定 http://localhost:5174（strictPort）
npm test           # vitest run，当前 87 个用例
npm run build      # 生产构建到 dist/（base /albummm/）
npm run preview    # 本地预览构建产物
```

- 端口约定：albummm 固定 **5174**；5173 是用户另一个项目（film）的端口，别用错。
- 部署：push main 自动触发 Actions（约 1–2 分钟）；本地提交不等于部署。
- 提交前冒烟建议（全新加载）：首页双面板 → `#/story` 演示照片出 5 页 → `#/collage` 10 张上板（演示照片生成需数秒，别误判为卡死）→ `#/works` 正常读取。

### 5. 验证情况（截至 2026-10-01）

- `npm test`：**87/87 通过**（v3 排版与 v5 几何/导出用例；v1 的 44 个与 v4 的用例随归档退出——其中 v4 归档前已 28 个失败）。
- `npm run build`：通过；dist 约 17MB（大头：V5 背景图约 6.3MB + 背景实验两张图 9.3MB，后者为用户明确决定保留）。
- 部署：`c33ede1` 的 Actions run 36816430317 成功；线上新主包生效、V1 旧 chunk 已 404（当日实测）。
- 浏览器冒烟（本地 dev server）：四入口渲染正常、无报错浮层。
- **未验证**：触屏横滑手感、Safari 真机放大清晰度（方案已上线，待真机复验）。

### 6. 关键机制（代码事实，供接手定位）

- **路由**：hash 出现即优先；无 hash 才回退读 `?prototype=`（`App.jsx` 的 `currentRoute`）。未注册的 prototype 值回落首页。
- **照片管线**：`loadPhoto` = `createImageBitmap`（自动按 EXIF 方向解码）→ canvas 缩到最长边 1600px 的 JPEG 预览（dataURL）→ 原图 `blob:` URL 留给高清查看。`originalSrc` 的释放责任在调用方（`releasePhotoSource`，三个编辑器均已接上）。
- **作品库**：`works.js` 用 `mutationQueue` 串行化写操作；WebKit 无法持久化 Blob 时转 `{bytes}` 存储并由 `mediaBlob` 还原。
- **V5 放大查看**：整组统一倍率 `groupSafeScale`；整板 canvas 快照按「倍率 × DPR」预留分辨率（上限 16M 像素）；同步高清 DOM 层与镜头同轨迹；Safari 停稳后用 `renderFocusScene` 位图盖回取景框（Chromium 不需要，`?webkit=1` 可强制）；屏幕显示与导出共用同一渲染器，所见即所得。
- **story 导出**：离屏 1080 宽单页 DOM + html-to-image 逐页截图，截前等 `document.fonts.ready`。

### 7. 版本演进摘要（仅 git 与文档有证据的部分）

- **2026-09-11** 仓库起步：SLC 规格、Vite+React 骨架、V0.1 上传/读取/方向分类。
- **2026-09 中旬** V1 电子相册书（IndexedDB 书库）→ V2 拼贴实验（三个原型）→ V3 carousel 系列（09-20 前后完成背景母板、风格装饰；`docs/v3-carousel/` 存有期间 8 份记录，含一份 `handover-to-codex.md` 交接文件）。
- **2026-09-23** 统一首页 + 手机优先整合第一轮（`d4b6211`）；V5 入库基线（`51a3d3c`）。
- **2026-09-23 → 09-30** V5 放大查看层多轮迭代：快照、同步高清层、遮挡幽灵层、整组统一倍率、导出分档、`#/dev/focus` 调试页。
- **2026-10-01（本会话之前）** Safari 放大发糊两连修（`fa12db2`、`e5679d4`）、预览图持久化提速（`fb4eb7b`）、首页横滑对齐 film（`56305f8`）；tag `v5-focus-clarity-ok` 为该阶段认可的回退点。
- **2026-10-01（本会话）** 版本归档、blob URL 泄漏修复、V1 归档（见下方任务记录）。
- 提交作者均为 `cfyofjackie` 账号。09-11 至 10-01 上午的各提交由哪个 Agent / 工具完成，仓库内无记录：**未知，不作推测**。

### 8. 遗留问题与已知债务

**仓库卫生（均为本地，不影响线上）**
- `check/` 256MB 验证截图/录屏/脚本，可整体删除。
- 本地 `.git` 179MB：两个 `refs/codex/turn-diffs/checkpoints/*` 引用约 150MB 的 `reference/` 大图（未推远端），删 ref + `git gc` 可回收；另有 176 个不可达 blob。
- 根目录 9 份 9 月中旬历史 md（EMERGENT / LAYOUT / PRD / PROGRESS / SLC / idea / note / 电子摄影书 / 风格和样式），可归档进 `docs/`。

**部署与质量**
- `deploy.yml` 只构建不跑 `npm test`（曾导致 v4 的 28 个失败测试长期无人发现）。
- dist 约 17MB 偏大，主因背景实验保留的两张大图（用户决定）。

**代码级（非 bug，优化项）**
- story 页 `planStory` 每次渲染全量重算，未 memo。
- 自动保存每次设置变化都全量重写（照片文件 + 预览）进 IndexedDB，IO 偏重。
- 用户浏览器可能残留三个 IndexedDB 库（`albummm` / `albummm-pages` 为 V1/V2 旧库，无清理逻辑）。

**待真机验证**
- 触屏横滑手感（`56305f8` 的 pager 改动）、Safari 放大清晰度（`e5679d4` 停稳位图方案）。

---

## 任务记录

### 2026-10-01：建立首次交接文档，补全 AGENTS.md
- 执行工具：Z-Code（GLM-5.3）
- 状态：完成
- 改动及原因：新增本文件（项目全景 + 历史摘要 + 任务记录，均基于代码、git 历史与已有文档的证据，不可确认处标未知）；补全根目录 `AGENTS.md` 的项目用途 / 目录 / 运行检查方法等五个待补充项。未修改任何业务代码。
- 验证：`npm test` 87/87 通过；`npm run build` 通过（2026-10-01 本轮实跑）。
- 遗留或下一步：见「遗留问题」清单。

### 2026-10-01：V1 一并归档（c33ede1）
- 执行工具：Z-Code（GLM-5.3）
- 状态：完成
- 改动及原因：用户决定 V1 不再保留线上（每次进链接要把整座书库读进内存）。App.jsx 摘除 `v1-book` 注册；`src/v1-book/` gitignore；vitest 排除其 44 个测试；docs/versions.md 同步。
- 验证：旧 V1 链接实测回落首页；story/collage 冒烟正常；构建产物无 V1BookApp chunk；87 测试全绿；已推送并部署成功。
- 遗留或下一步：无（V1 恢复方法见 .gitignore 注释与 versions.md）。

### 2026-10-01：修复 blob URL 泄漏（1c21586）
- 执行工具：Z-Code（GLM-5.3）
- 状态：完成
- 改动及原因：两个创作页 `sealedPreview` 换新/卸载时补 `revokeObjectURL`；story 页 `sealWork` 用 `mediaBlob` 归一缩略图并修 null 保护；V1（当时仍在线）接上 `releasePhotoSource`。
- 验证：87 测试全绿；四入口冒烟通过。已推送。
- 遗留或下一步：V1 书库数量上限未加（用户未拍板；V1 现已整体归档，优先级降低）。

### 2026-10-01：版本归档与 reference/ 退出仓库（b9aed68）
- 执行工具：Z-Code（GLM-5.3）
- 状态：完成
- 改动及原因：用户决策——V2、V4、V3 对照原型归档（本地保留、不进仓库）；`reference/` 永不上传。背景实验两张图复制进 `src/v3-carousel/assets/`；vitest 排除归档目录（v4 的 28 个失败测试随之退出，基线回绿）；docs/versions.md 更新。
- 验证：本地构建 + 干净 worktree 模拟 GitHub 构建均通过；131 测试全绿（当时）。已推送。
- 遗留或下一步：见「遗留问题」仓库卫生部分。

### 2026-10-01 之前
- 无交接记录（本文件为首份）。各轮改动以 git 历史为准，见「版本演进摘要」；执行工具未知。
