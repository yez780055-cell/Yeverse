# Android App 构建

同一套 React / Vite 页面同时用于网页、PWA 和 Capacitor Android；App 内置 dist，不依赖网站在线。

## 一次准备

- Node.js 22.13+，pnpm 11（package.json 已固定版本）。
- JDK 21；JAVA_HOME 指向 JDK。
- Android Studio 或命令行 SDK：安装 Android SDK Platform 36、Build Tools 36.0.0、Platform Tools，接受 SDK 许可。
- ANDROID_HOME 指向 SDK 目录（Windows 通常 `%LOCALAPPDATA%\Android\Sdk`）。
- `pnpm install --frozen-lockfile`

## 一条命令生成可安装 APK

```sh
pnpm android:apk
```

输出 `outputs/yeverse-1.0.0.apk`。流程自动构建网页、同步 Android、编译并签名 APK。
首次运行生成个人签名，位于 `android/signing/`，不提交 Git。必须单独保存此文件夹（私钥及密码文件）；已有 APK 更新必须使用原签名与包名 `com.yeverse.app`，否则不能覆盖安装。交付的构建包包含本次使用的签名，应私人保存，不要公开发布构建包。
后续修改前端后重复命令即可，APK 需重新安装；网站发布不会自动更新已安装的 App。覆盖安装保留数据，卸载会删除数据。

版本号在 android/app/build.gradle；可用 YEZI_VERSION_CODE 环境变量递增版本代码。切勿改包名、https scheme 或 localhost hostname，否则可能出现新的数据存储空间。

可选：`pnpm android:open` 在 Android Studio 打开，`pnpm android:sync` 只构建网页并同步资源。
网页版继续使用 `pnpm dev` / `pnpm build`。

## 数据、文件和权限

- 现有 IndexedDB 表及事务不变，App 的 https://localhost origin 固定；图片和 GLB 均实际复制到本地数据库，不保留临时选择器 URI。
- `<input type=file>` 由 Capacitor Android 系统选择器实现，可选择相册、下载文件及文档提供商；ZIP/GLB 作为二进制 File 解析，不依赖 MIME 完全准确。
- 备份通过分块桥接写入私有缓存，再由 ACTION_CREATE_DOCUMENT 选择保存位置。取消不会显示保存成功，保存结束清理临时文件。
- 不申请 READ/WRITE_EXTERNAL_STORAGE、MANAGE_EXTERNAL_STORAGE 或相机权限。仅保留基础 INTERNET 权限；藏品不会自动上传。系统自动云备份关闭。
- 网页和 App 数据隔离，先在原设备/浏览器导出 JSON，再在 App 导入。备份含图片、模型和元数据。
- Service Worker 仅在网页启用，App 使用随 APK 更新的资源，避免旧缓存阻止更新。
- 返回手势优先关闭零件特写、预览、详情、编辑和设置；在展厅根页面返回进入后台。系统输入法/文件选择器先处理自己的返回事件。
- 3D 特写时隐藏系统栏，滑动可临时唤出。正常页面保留状态栏及安全区域；硬件加速、像素比上限和按需渲染沿用现有实现。

## 发布前设备验收

在 Android 实机或模拟器完成：首次离线启动；PNG/JPG 导入与重启保留；ZIP/GLB 导入、旋转缩放、拆解、零件返回；备份保存/取消及恢复；输入法与状态栏；覆盖安装后数据保留。生产构建通过不等于以上实机检查全部通过。
