# Yeverse · 私人藏品馆

一个手机优先的个人数字收藏空间。React 19 + TypeScript + Vite，纯静态前端，无业务服务器、账号系统或远程数据库。

## 运行

```sh
pnpm install
pnpm dev
pnpm build
pnpm preview
```

构建输出 `dist/`，可部署到 HTTPS 静态托管。PWA 安装与离线缓存需 HTTPS 或 localhost。开发模式不注册 Service Worker。

## V1

- 沉浸式滑动展厅（Embla Carousel），6 件带图片与故事的模拟藏品。
- 分类索引、搜索、按获得年份排列的时间线。
- 藏品详情、故事、重要意义、标签、相关照片。
- 图片特写：双指缩放、拖动、双击切换缩放、重置。
- Three.js 程序生成的分层手表演示：旋转、缩放、展开、零件点击说明。
- 新增、编辑、删除，手机相册上传；图片缩放至最长边 2000px 后存储。
- IndexedDB 本地持久化；JSON 完整备份导出、合并导入。
- PWA 清单、图标、Service Worker 缓存。图片与藏品不会上传服务器。

## 数据与备份

数据库 `yezi-collection-v1`，对象存储 `vault`，键 `items`。首次使用写入 6 件示例；删除所有藏品后不会自动恢复示例。不同浏览器、设备和站点域名的数据彼此独立。清除浏览器站点数据会丢失本地内容；请定期在设置中导出 JSON 备份。导入按藏品 UUID 合并，同 UUID 更新，其他保留。

## 结构

- `components/collection/CollectionApp.tsx`：页面、导航、编辑、特写。
- `components/collection/ObjectViewer.tsx`：3D 生命周期、旋转控制、程序模型与拆解。
- `lib/collection/data.ts`：类型、示例、图片处理、存储和备份校验。
- `styles/globals.css`：移动与桌面布局、字体、动效。
- `public/objects/`：原创示例图片，非真实产品精确外观。
- `public/sw.js`：离线资源缓存，版本更改时更新缓存键。
- `index.html` → `main.tsx` → `CollectionApp`：Vite + React 正式应用入口；`vite.app.config.ts` 是开发、生产构建和预览使用的唯一 Vite 配置。Capacitor 从 `dist/` 同步 Android 应用。

## 后续 3D 扩展

`Collectible.model` 支持 `{kind:'procedural'}` 或 `{kind:'gltf',url:'...'}`。`ObjectViewer` 已包含 GLTFLoader 加载分支；真实模型可放入 `public/models/` 并配置 URL。V1 未提供模型上传界面。导入 JSON 仅保留程序演示模型，避免备份中的未知远程地址加载。

当前拆解为结构示意，不代表任何真实手表的工程结构。未来可将零件描述、节点名称、展开向量抽成独立模型配置。

## 验证记录

已执行 TypeScript 检查、ESLint 和生产构建。浏览器预览服务曾启动，但浏览器控制连接持续无响应，无法完成手机尺寸截图与触摸交互验收；不得把代码检查视为实机验收。PWA 安装和离线首次加载仍需在目标手机浏览器验证。

## V2 交互更新

具备模型的藏品在详情直接旋转、缩放。程序手表支持在物体上双击/双点进入全屏拆解。拆解包含 7 个核心层与两段表带，零件热点或网格点击进入独立检视，再返回完整拆解。没有模型的藏品保留高清照片；单张图片无法提供真实三维背面。时间线分类支持多选并集，全部清除筛选，年份与计数跟随筛选。用户 IndexedDB 数据不改写。

## V3 通用资产导入

入口：添加或编辑藏品 → 选择资产包 ZIP → 校验与预览 → 保存。规范在 docs/Yeverse-Asset-Spec-v1.md，网站下载包在 public/downloads/。新资产不需要修改源码。原手表演示仅作为 LegacyObjectViewer 兼容旧数据，新资产全部由 AssetViewer 驱动。

lib/assets/ 分离了清单校验、ZIP 解包、GLB 校验、运行时装载及备份；IndexedDB 从 v1 无损升级到 v2，模型二进制单独存储并与藏品事务性提交。关闭或替换后释放纹理、几何和渲染器。

运行 pnpm test:assets 可验证格式拒绝、两份不同零件数资产加载、GLTFLoader 节点关联与复原、老库升级、原子回滚、备份恢复及失效模型清理。该测试使用真实 GLTFLoader 与模拟 IndexedDB，不等于手机 WebGL 和触摸实机验收。
