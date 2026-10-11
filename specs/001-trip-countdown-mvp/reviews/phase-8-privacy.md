# Phase 8 Privacy Boundary Record

日期：2026-10-10。该记录对应 T100–T101，不代替 T102–T104 或设备/Release Review。

## Offline integration

- Jest/RNTL 在 `fetch` 被设置为离线失败时完成 Trip create/list/countdown/edit/delete 与 Checklist add/complete/read。
- 核心 Feature 仅通过 Repository/Coordinator contract 工作，没有网络前置或远程业务数据源。
- 该证据是 JS 集成测试，不证明 Development Build 的真实 SQLite、冷启动、杀进程恢复或系统网络行为；这些项目继续保持 PENDING。

## Privacy source and dependency review

- production source/config 未使用 `getExpoPushTokenAsync`、`getDevicePushTokenAsync`、Firebase product API、Analytics、Crashlytics、Firestore 或 Firebase Auth。
- 仓库未配置 Firebase project，未发现 `google-services.json`、`GoogleService-Info.plist` 或 `googleServicesFile`。
- `package.json` 没有产品级 Firebase/Analytics 依赖。
- Expo SDK 57 的 `expo-notifications` Android 实现包含 `com.google.firebase:firebase-messaging:25.0.1` 传递依赖和 Messaging service manifest；这是已批准的框架传递边界，不构成应用使用 remote push、push token 或用户跟踪的证据。
- Android 外部存储权限已通过 `blockedPermissions` 移除；exact alarm 与无关敏感权限仍需在真实 merged artifact 再次检查。

运行 `npm run verify:privacy` 可重复执行 production source、直接依赖、Firebase project 文件和已知 expo-notifications 传递边界检查。

## Pending evidence

- Development Build/production artifact 的完整 dependency graph、merged manifest 和自动初始化检查。
- iOS/Android 真机断网冷启动、SQLite close/reopen、杀进程恢复。
- 运行时网络抓包，确认无业务数据、Analytics 或其他跟踪流量。
- 真实通知权限、调度和系统队列行为。

上述项目未执行时保持 `PENDING`；Jest、源码扫描和 npm/Gradle 文件检查不得写成真实设备网络或离线持久化 PASS。
