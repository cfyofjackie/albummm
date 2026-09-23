# Albummm 版本地图

当前产品是一个手机优先的 Web 应用：统一首页提供两个并列的作品入口，各自进入独立的创作页。V3 与 V5 不分主次，靠用户反馈决定产品重心。

## 正式入口

| 首页选项 | 地址 | 对应版本 | 成品与体验 |
| --- | --- | --- | --- |
| 多页故事 | `#/story` | V3 `carousel-smart` | 照片自动分页排版，横滑逐页查看，按 4:5 / 3:4 / 4:3 逐页导出。 |
| 单张拼贴 | `#/collage` | V5 `v5-reference-layout` | 十张照片排成一张 4:3 拼贴，可点开单张看高清，整张导出。 |

- 首页组件在 `src/home/`；路由选择在 `src/App.jsx`。hash 一旦出现就优先于查询参数。
- 两个创作页各自拥有独立的交互状态、样式与排版引擎，不共享排版代码；`src/shared/` 只放共用的图片读取和演示照片。
- 两个创作页头部都有「← 首页」链接；正式界面使用「多页故事 / 单张拼贴」名称，版本号只用于开发与文档。

## 历史与实验入口

以下条目不在首页出现，也不进入正式构建的默认加载路径（全部按需懒加载），但旧链接保持可用：

| `?prototype=` 值 | 说明 |
| --- | --- |
| `v1-book` | V1 电子相册书（曾经的默认首页，现为历史实验） |
| `collage-masters` / `collage-interaction` / `collage-flow` | V2 拼贴实验 |
| `carousel-masters` / `carousel-scatter` / `carousel-rhythm` | V3 对照原型；`carousel-smart` 的 `?decor=tier2`、`?backgrounds=masters` 为其视觉实验开关 |
| `carousel-scale` | V3 尺度实验 |
| `v4-gallery` | V4 画廊实验（进行中，尚未并入产品） |
| `v5-reference-layout` | V5 正式功能的旧地址，与 `#/collage` 等价 |

## 目录

| 目录 | 内容 |
| --- | --- |
| `src/home/` | 统一首页 |
| `src/v3-carousel/` | V3 多页故事（活跃功能） |
| `src/v5-collage/` | V5 单张拼贴（活跃功能，原 `SLC/V5`） |
| `src/v1-book/`、`src/v2-collage/`、`src/v4-gallery/` | 历史实验，仅经旧链接懒加载 |
| `src/shared/` | 跨版本共用的图片读取能力 |
| `reference/` | 素材参考，不属于产品源码 |

手机端适配以 320–430 CSS 像素宽为验收基准；本轮约束见 `docs/mobile-first-integration-handoff.md`。
