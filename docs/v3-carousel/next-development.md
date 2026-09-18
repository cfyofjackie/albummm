# V3 下一步开发交接

> 给接手 V3 的开发者：先读 `direction.md`，再读 `development-guardrails.md`。后者是不可破坏的底线；本文件是下一步的优先顺序。

## 1. 当前结论

V3 不是电子摄影书（V1），也不是单页拼贴（V2）。它要做的是：

> 用户上传一组照片，选择一种气质，即得到一组可横向浏览、可逐页发布的连续 Carousel 作品。

当前最被认可的视觉基础不是固定模板，而是：

> **智能分页 + 受控随机排版。**

“随机”带来了自然和意外感；“智能分页”只在后台控制每页照片数、页数和比例搭配，不能把画面重新做成死板的两图模板。

## 2. 已经可运行的基线

主入口：

```text
/?prototype=carousel-smart&variant=gallery
/?prototype=carousel-smart&variant=muse
/?prototype=carousel-smart&variant=weekend
```

可通过 `&demo=14` 等参数用 1–24 张演示图检查页数。用户也可以在页面中上传 jpg / png / webp；当前单次上限为 24 张。

保留以下对照原型，不要覆盖或删除：

| 路径参数 | 意义 | 当前处理 |
| --- | --- | --- |
| `carousel-smart` | 智能分页随机，当前主候选 | 继续开发与验证 |
| `carousel-scatter` | 原始纯随机基线 | 必须保留，用于比较随机感是否被损失 |
| `carousel-scale` | 最小 / 最大尺寸标尺 | 已确认边界，保留为参考 |
| `carousel-rhythm` | 固定节奏母板尝试 | 已证明过于死板，保留历史，不作为主方向 |
| `carousel-masters` | 早期母板探索 | 保留历史 |

## 3. 下一步只做什么

### 阶段 A：用真实输入验证，不先加新装饰

先验证智能分页，而不是新增胶卷动效、撕纸、胶带、曲别针或导出器。

每一项至少在 Gallery / Muse / Weekend 中各检查一次：

| 维度 | 必测样本 | 要观察什么 |
| --- | --- | --- |
| 数量 | 5、8、10、11、12、13、14、15、18、24 张 | 页数是否自然；2 / 3 / 4 张页是否符合规则 |
| 比例 | 全横、全竖、方图偏多、横竖混合、极宽 / 极长图 | 是否完整显示、无强裁切、无小到不可读的照片 |
| 重生成 | 每种样本至少连续点 5 次“换一组排法” | 每次有变化，但不出现内容碰撞、图片丢失或单图意外页 |
| 风格 | Gallery / Muse / Weekend | 分页规则相同，只是表面气质不同 |

把每次发现的异常、使用的照片数量与比例、种子、截图链接 / 文件位置记录到 `docs/v3-carousel/validation-log.md`。不要只凭一套漂亮演示图就改规则。

### 阶段 B：补强纯分页模块

在确认异常后，优先修改：

```text
src/v3-carousel/layout/carouselSmartPagination.js
```

它是 V3 的核心模块，外部 interface 只有：

```js
pageCountPlan(photoCount, random) // => number[]，例如 [2, 2, 2, 3, 2, 3]
paginatePhotos(photos, random)    // => Photo[][]
```

新的排版策略、比例配对与分页权重都应尽量隐藏在这个模块内，而不是散落到 JSX、CSS 或风格按钮里。任何修改都要先检查：照片数量守恒、每页数量限制、固定 seed 的确定性。

若需要新增算法测试，放在同一目录，例如 `carouselSmartPagination.test.js`；不要为了测试把 V3 的逻辑搬回 `src/shared/`。

### 阶段 C：只做一个小型“材质层”实验

仅当阶段 A 的测试没有发现分页底层问题后，再另开一个 V3 原型路由实验材质层。优先顺序：

1. Weekend 的撕纸边缘；
2. Weekend 的一处胶带或曲别针；
3. 再评估是否值得扩展到 Muse。

材质层只能附着在已经生成的照片卡片之上，不能参与分页或迫使照片缩小。每组作品最多出现 1–2 个材质元素；不得遮住脸、主体或文字。

## 4. 现在不要做

- 不回到固定的 Hero 页或“五页固定节奏模板”。
- 不把 Gallery / Muse / Weekend 变成三套不同的分页算法。
- 不做 Canva 式自由拖拽、自由缩放、贴纸库或大量文字编辑。
- 不把“胶卷”做成真实 35mm 齿孔模板；它最多是以后独立的预览 / 动效实验。
- 不在没有用户确认的情况下加入账号、云存储、AI 选图、图片裁切或导出流程。
- 不为了让 24 张照片也限制在 8 页而把图缩小或塞满。当前规则允许照片多时自然增加页数。

## 5. 代码地图

```text
src/v3-carousel/
  layout/
    carouselSmartPagination.js     # 纯分页与横竖照片配对：V3 核心
    carouselSmartPagination.test.js # 1–24 张的分页规则、守恒与确定性
    carouselPlacement.js           # 纯几何层：尺寸边界、放置、碰撞、轻叠、smart 整组规划
    carouselPlacement.test.js      # 几何硬边界与整组规划（含已复现的单图页偏差）
  prototypes/
    CarouselSmartPrototype.jsx     # 主入口包装
    CarouselScatterPrototype.jsx   # 随机几何、放置、碰撞保护；smart/scatter/rhythm 共用
    CarouselScatterPrototype.css   # 三种表层气质与照片卡片
    CarouselScalePrototype.*       # 尺寸标尺参考
    CarouselMastersPrototype.*     # 早期母板参考
```

`CarouselScatterPrototype.jsx` 当前只承载 scatter / rhythm 两条历史模式与 UI；几何逻辑已抽到
`layout/carouselPlacement.js`，smart 的整组规划是 `planSmartStory()`。修改 `carouselPlacement.js`
会影响三个入口（scatter / rhythm / smart），必须回归检查三个入口；如果新功能只属于 smart，
优先新增 smart 专用函数，避免污染 scatter 基线。

已完成的验证结果见 `validation-log.md`：单图页只出现在超宽 / 超长照片上（需要产品确认是否豁免），
以及 20% 最小短边与 80%/78% 上限在超出 1:4–4:1 时互斥。

## 6. 接手后的第一个可交付成果

不要直接做“大功能”。第一个提交应当是以下二选一：

1. `validation-log.md`：记录完整的真实照片验证结果，并只修复已复现的分页问题；或
2. 为 `carouselSmartPagination.js` 补齐 1–24 张照片的确定性测试，证明其数量分配遵守既定规则。

提交说明应写清：测试样本、种子、改动前后差异，以及有没有影响 `carousel-scatter`。

## 7. 可直接交给 Harness 的启动提示

```text
你只负责 Albummm 的 V3 Carousel。先阅读 docs/v3-carousel/next-development.md 和 development-guardrails.md。

当前主入口是 ?prototype=carousel-smart；保留 ?prototype=carousel-scatter 作为纯随机对照。先做真实输入验证或智能分页单元测试，不添加新装饰、不修改 V1/V2/V4。

任何修改必须保持：三种风格共享分页规则、照片不拉伸不强裁切、最小短边 20%、2 张页多于 3 张页、4 张页最多一次、固定 seed 可复现。每次提交前运行 npm run build 和 npm test，并检查所有 V3 原型链接仍可打开。
```
