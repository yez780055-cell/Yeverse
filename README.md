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

## 当前能力

- Universe / Galaxy 展示、Planet Generator V1 稳定生成，以及分类索引、搜索和时间线。
- 藏品详情、故事、标签、相关照片、图片特写及 3D 资产查看 / Exploded。
- 藏品新增、编辑、删除和本地图片/资产包导入；数据保存在 IndexedDB，不会上传服务器。
- Backup v4 完整备份；PWA 离线能力与 Capacitor Android 外壳。

## 数据与备份

数据库 `yezi-collection-v1`，对象存储 `vault`，键 `items`。首次使用写入 6 件示例；删除所有藏品后不会自动恢复示例。不同浏览器、设备和站点域名的数据彼此独立。清除浏览器站点数据会丢失本地内容，请定期导出 JSON 备份。v4 包含藏品、关联模型资源、Galaxy Profile 与 Intro 模式；导入按 UUID 合并，同 UUID 更新、其他本地藏品保留。无版本旧备份及 v1–v3 仍可导入，并按兼容规则补齐 Planet 身份。

## 结构

- `components/collection/CollectionApp.tsx`：页面组合、跨模块导航、统一关闭仲裁、Universe 连接和应用级反馈。
- `hooks/useCollectionRepository.ts`：藏品加载、图片 palette 准备、保存、删除与 IndexedDB 状态。
- `hooks/useCollectionViews.ts` / `lib/collection/views.ts`：索引和时间线筛选及派生数据。
- `hooks/useCollectionSession.ts` / `lib/collection/sessionState.ts`：按藏品 ID 管理详情会话及 Universe 进入/退出阶段。
- `hooks/useBackupController.ts` / `lib/collection/backupWorkflow.ts`：完整备份导入导出与恢复协调。
- `hooks/useGalaxyProfiles.ts`、`hooks/useIntroPreference.ts`：复用现有 Galaxy Profile 与 Intro 偏好数据层。
- `components/collection/Editor.tsx`、`ImageInspect.tsx`、`CollectionSettings.tsx`：独立的编辑、图片特写和设置界面。
- `components/collection/ObjectViewer.tsx`：3D 资产展示；`components/assets/AssetViewer.tsx` 管理资产渲染生命周期和拆解。
- `lib/universe/planetGenerator.ts`：版本路由；`planetGeneratorV1.ts`：当前正式 Planet 生成算法 V1。
- `lib/assets/backup.ts`：备份格式定义、版本兼容和 v4 Planet 身份校验。
- `styles/globals.css`：移动与桌面布局、字体、动效。
- `public/objects/`：原创示例图片，非真实产品精确外观。
- `public/sw.js`：离线资源缓存，版本更改时更新缓存键。
- `index.html` → `main.tsx` → `CollectionApp`：Vite + React 正式应用入口；`vite.app.config.ts` 是开发、生产构建和预览使用的唯一 Vite 配置。Capacitor 从 `dist/` 同步 Android 应用。

3D 资产包通过清单、ZIP 和 GLB 校验后保存到 IndexedDB，并随 v4 备份；程序化模型和已有拆解资产继续兼容。`docs/Yeverse-Asset-Spec-v1.md` 描述导入规范，`public/downloads/` 提供示例包。自动测试覆盖资产校验、Planet 生成、状态逻辑与备份恢复；WebGL、触摸和 PWA 实机体验仍需在目标设备上验收。
