# 雪迹 · iOS / Android 打包

## 方案与支持范围

保留现有 JS／WebGPU／WebGL2 游戏，使用 Capacitor 8 原生 WebView 封装，不重写游戏引擎。`build.js` 的网页输出和小红书构建不变；新增的 `tools/build-mobile.js` 单独生成 `dist-mobile/`，移除在线字体加载器，打包本地字体和许可证、原生插件桥接及完整 HTML 文档。移动包不依赖线上游戏地址、不含分析 SDK 或广告 SDK。

- iOS 15+（iPhone / iPad）；构建需要 macOS、Xcode 26+、Node.js 22+，使用 Swift Package Manager，无需 CocoaPods。
- Android 7.0+（API 24），需要支持 WebGL2 的 GPU 和 Android System WebView 100+；编译 / target SDK 为 36。
- 仅横屏，支持左右两个横屏方向。iPad 为全屏应用；Android 16+ 大屏设备可能忽略方向锁，游戏保留竖屏旋转布局作为后备。
- 本地设置、滑行统计、画质选择沿用游戏的 localStorage；没有跨设备云存档。切后台保留本次运行，但操作系统杀进程后会重新加载游戏，并非完整的断点存档。
- WebGPU 优先，初始化失败回退 WebGL2；自动画质仍按手机 GPU 和帧率调整。没有把所有设备强制降为最低画质。
- 原生生命周期事件暂停画面、音频及游戏，清除按住的按键、跳跃和加速；回前台停在暂停菜单，手动继续。
- 安卓返回：退出拍照 → 关闭菜单 → 暂停滑行；标题页返回则最小化应用。
- 拍照的「保存」打开系统分享面板，可选择存储图像／文件或其他 App。临时文件位于应用缓存，取消或失败后清理；成功分享的文件保留给 Android 接收方异步读取，下次启动清理超过 24 小时的文件，也可由系统回收。Android 不申请广泛存储权限；iOS 声明仅添加照片的用途说明，选择系统的「存储图像」时可请求添加到相册，不申请读取相册权限。
- 图标与启动图由 `npm run mobile:assets` 从代码生成。游戏仍没有贴图、录音等外部素材。

## 安装与同步

```bash
npm install
npm test
npm run sync:mobile
```

每次修改 `src/`、`template.html` 或原生桥 `mobile/native.js` 后，重新同步。**不要只运行网页的 `npm run build` 就去编译旧的原生资源。** 两个平台工程已经包含在源码中，不需要再次 `cap add`。

```bash
npm run build          # 原网页：dist/index.html、dist/dev.html
npm run build:mobile   # 离线原生资源：dist-mobile/
npm run sync:mobile    # 重新构建并复制到 iOS 和 Android
```

## Android APK（可直接安装的调试包）

安装 JDK 21、Android SDK 命令行工具及以下 SDK 包，设置 `JAVA_HOME`、`ANDROID_HOME`：

```bash
sdkmanager 'platform-tools' 'platforms;android-36' 'build-tools;35.0.0' 'build-tools;36.0.0'
sdkmanager --licenses
npm run android:apk
```

输出：`android/app/build/outputs/apk/debug/app-debug.apk`。它使用本机构建工具的 debug 签名，可用于侧载测试，**不是正式商店发行包**。调试签名不跨构建机保证一致；更换签名后覆盖安装可能失败，需要卸载旧包（会丢失本地数据）。

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
npm run open:android
```

## Android 正式 AAB

先把占位应用标识 `com.coldsmoke.game` 改为自己拥有的标识：修改 `capacitor.config.json`、`android/app/build.gradle` 的 namespace/applicationId、Java 包名与目录，以及 iOS 的 PRODUCT_BUNDLE_IDENTIFIER。`cap sync` **不会自动重命名已经创建的原生工程**。商店显示名和版本分别在原生工程中维护；安卓递增 versionCode，iOS 递增 CURRENT_PROJECT_VERSION。

使用你自己的上传密钥，在本地或 CI 的秘密存储中配置（不要提交值或密钥文件）：

```text
COLD_SMOKE_KEYSTORE        上传 keystore 的绝对路径
COLD_SMOKE_STORE_PASSWORD  keystore 密码
COLD_SMOKE_KEY_ALIAS       密钥别名
COLD_SMOKE_KEY_PASSWORD    密钥密码
```

```bash
npm run android:bundle
```

输出：`android/app/build/outputs/bundle/release/app-release.aab`。命令在缺少签名环境变量时拒绝生成，以免把未签名包当成可发布包。AAB 交给 Google Play 内部测试；AAB 本身不能直接侧载安装。Google Play 上架资料、隐私政策、内容分级和真机性能验证仍需准备。

## iOS 构建／导出

在 Mac 上解压或克隆同一源码：

```bash
npm install
npm run sync:mobile
npm run open:ios
```

Xcode 打开的是 `ios/App/App.xcodeproj`（SPM 工程，没有 CocoaPods workspace）。在 App target 的 Signing & Capabilities 中选择自己的 Team，设置唯一 Bundle Identifier。先选 iPhone Simulator 编译和运行；装入 iPhone 或分发 IPA 必须配套合法证书与 provisioning profile。

命令行无签名模拟器构建：

```bash
xcodebuild -resolvePackageDependencies -project ios/App/App.xcodeproj -scheme App
xcodebuild -project ios/App/App.xcodeproj -scheme App \
  -configuration Debug -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath ios/DerivedData CODE_SIGNING_ALLOWED=NO build
```

分发时选择 Any iOS Device → Product → Archive → Distribute App，按 App Store Connect / Ad Hoc 方式签名导出。此仓库不包含 Apple 账号、证书或发行 profile，Linux 不能生成经过 Xcode 验证的 IPA。应用自带隐私 manifest，声明本地文件时间戳和 UserDefaults 使用理由；发布前仍应检查 Xcode 的隐私报告和实际填写的商店声明。

## 验证清单（发布前必须在设备执行）

`npm test` 覆盖原生桥、暂停/恢复、返回键、输入重置、照片缓存清理、离线构建和原网页构建契约；它不是设备实测，不能证明真实 GPU、倾斜传感器、触摸手感或系统分享面板已经通过。

1. 飞行模式冷启动，字体、加载页和雪山均正常；默认渲染及 `?backend=webgl2` 都能启动。
2. 中英文界面；刘海 iPhone、普通安卓、平板与小屏横屏（568×320 起）；左右旋转，按钮不被切口或手势区遮挡。
3. 按住拖动转弯／重心，同时按跳／加速，松开、移出、取消触点后不粘键。倾斜权限允许、拒绝均有可靠触屏后备。
4. 滑行中 Home / 锁屏 / 来电打断，声音停止，回前台不会自行继续滑行；加载中、开始权限弹窗中、拍照中重复验证。
5. 安卓返回手势依次退出拍照、关闭菜单、暂停；标题页最小化后能重新进入。
6. 拍照打开系统分享面板，取消、保存、重复拍摄正常；不要求广泛文件或相册权限。
7. 低中高档设备持续滑行 10 分钟，检查温度、内存、帧率、自动画质、GPU context 丢失后的恢复提示。
8. 正式签名包／TestFlight 包再做离线安装启动与升级保留数据验证，而不只验证 debug 包。

## 环境复用

建议将 Node.js、JDK 21 和 Android SDK 安装步骤加入 Devin 的仓库级环境蓝图，避免后续会话重复下载。不要将本机 `local.properties`、构建输出、开发者证书或签名密码提交到仓库。原项目没有 pre-commit / Husky hooks；当前没有额外 hooks 安装步骤。

如果 Maven Central 下载依赖返回 HTTP 429，可重试或临时使用 Google 托管的 Maven Central 镜像。在用户目录 `~/.gradle/init.d/cold-smoke-maven-mirror.gradle` 中放入以下内容后重新构建；不需要修改工程的依赖版本，也不要关闭 TLS 校验：

```groovy
allprojects {
    repositories.all { repository ->
        if (repository instanceof MavenArtifactRepository && repository.url.toString().contains('repo.maven.apache.org')) {
            repository.setUrl('https://maven-central.storage-download.googleapis.com/maven2/')
        }
    }
    buildscript.repositories.all { repository ->
        if (repository instanceof MavenArtifactRepository && repository.url.toString().contains('repo.maven.apache.org')) {
            repository.setUrl('https://maven-central.storage-download.googleapis.com/maven2/')
        }
    }
}
```
