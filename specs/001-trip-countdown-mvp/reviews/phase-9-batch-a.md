# Phase 9 Batch A — Development Build Evidence

日期：2026-10-12。范围为 T105–T108；T105–T108 已完成。基准 commit 为 `09f7a23`，本批变更未提交。

## T105–T107 Configuration

- 按 Expo SDK 57 文档使用 `npx expo install expo-dev-client`，安装 `expo-dev-client@57.0.19` 并同步 npm lockfile。
- `eas.json` 的 development profile 设置 `developmentClient=true`、`distribution=internal`。
- preview profile 使用 internal distribution 和 Android APK，未设置 development client；production profile 独立。
- 配置不含 token、secret、自动 submit 或 EAS Update 产品范围。
- `npm run verify:eas-config`、`npx expo install --check` 与 Expo Doctor 21/21 通过。
- EAS CLI 远程 `config` 命令因当前环境未登录 Expo 账号而停止；未将其写成 EAS 服务端验证通过。profile 的 JSON 解析与约束由本地、可重复脚本验证。

## T108 Android Development Build

| 项目 | 结果 | 证据 |
|---|---|---|
| Emulator | PASS | Pixel_10a AVD，Android 17，`sdk_gphone16k_arm64` |
| Native compile | PASS | JDK 17、Gradle 9.3.1，`app:assembleDebug` BUILD SUCCESSFUL |
| Install | PASS | `app-debug.apk` 安装到 emulator，package `com.anonymous.tripcountdown`（仅生成构建标识，正式 ID 待发布阶段） |
| Development client | PASS | `expo-dev-client@57.0.19` 编译并加载 Metro device-contract entry |
| Local Module autolinking | PASS | Gradle 发现并编译 `expo-trip-native@0.1.0` |
| Merged manifest / backup rules | PASS | 实际 debug merged manifest 共检查 31 项权限；backup_rules 与 data_extraction_rules 验证通过 |
| Private storage call | PASS（调用到达） | device harness 通过真实 `ExpoTripNative.preparePrivateStorage()` 后再加载 SQLite contract |
| Real SQLite contract | PASS | 事务连接 FK、非法外键拒绝、migration、WAL、读写、close/reopen、cascade、rollback、future version、Checklist persistence/isolation 全部通过 |

执行命令：

```sh
JAVA_HOME=/opt/homebrew/opt/openjdk@17 npx expo run:android --no-bundler
npm run verify:android-artifact -- <merged-manifest> <backup_rules.xml> <data_extraction_rules.xml>
npx expo start --dev-client --localhost --clear
```

首次构建使用 Android Studio bundled JBR 25 时在 native CMake 配置失败；切换本机已有 JDK 17 后 CMake 通过。一次 Google Maven TLS 中断后，确认 artifact endpoint 可达并重试，最终原生构建成功。以上环境问题均未通过修改生成工程或降低检查规避。

## Hermes Grapheme Runtime — RESOLVED

Development client 日志提供了直接设备证据：

```text
TRIP_COUNTDOWN_RUNTIME_CAPABILITIES {"intlSegmenter":"undefined"}
TRIP_COUNTDOWN_SQLITE_CONTRACT_FAIL undefined is not a function
```

经用户批准最小兼容修复后，Domain 改用 `unicode-segmenter@0.17.3` 的 `unicode-segmenter/grapheme` 子路径。该包为 MIT、零运行时依赖，npm 解包约 138 KB，并明确支持 React Native Hermes。实现不修改全局 `Intl`，不改变任何字段长度上限；缺失 `Intl.Segmenter` 的模块导入、中文、组合字符、ZWJ、肤色修饰符和国旗均有回归测试。

Android Hermes 再次报告 `intlSegmenter: undefined`，但 JS bundle 成功加载 Domain 与 Repository 并进入 SQLite contract，证明该阻塞已解除。本次只更新 JS bundle；原生依赖没有变化，因此复用此前已编译安装的 Development Client。

## Exclusive Transaction Foreign Keys — RESOLVED

真实契约随后在 FK cascade 失败。设备诊断证据：主连接和 reopen 后连接 `PRAGMA foreign_keys=1`，两张子表均存在 `ON DELETE CASCADE`；删除后父 Trip 数量为 0，但 Checklist 和 Reminder 各剩 1 行。SDK 57 `withExclusiveTransactionAsync` 为事务创建新的 SQLite connection，该事务连接没有继承主连接的 `PRAGMA foreign_keys=ON`，因此事务内的父表删除没有触发 cascade。

经用户批准后，adapter 改为通过 SDK 57 公开 `openDatabaseAsync` API 以 `useNewConnection: true` 打开独立事务连接。该连接先启用并读回验证 `foreign_keys=1`，然后才执行 `BEGIN IMMEDIATE`；成功提交，异常回滚，最后始终关闭连接。Repository public contract、WriteCoordinator 和独占事务语义保持不变。

Android 17 emulator 的真实 Hermes/expo-sqlite 结果：

```text
TRIP_COUNTDOWN_SQLITE_CONTRACT_PASS
foreignKeys=1
transactionForeignKeys=1
illegalForeignKeyRejected=true
reopenRead=true
cascade=true
rollback=true
futureVersionRejected=true
checklist.persistenceAfterReopen=true
checklist.completedAfterReopen=true
checklist.cascadeRemovedTripA=true
checklist.tripBUnaffected=true
checklist.isolationAfterReopen=true
checklist.rollbackPreservedData=true
```

Private Storage 的实际设备路径为 `/data/user/0/com.anonymous.tripcountdown/no_backup/trip-countdown`；其中可见真实 contract `.db`、`.db-wal` 与 `.db-shm` 文件，均位于应用 `no_backup` 目录。

## Automated Gates

- Node 22.23.3 / npm 10.9.9。
- Grapheme 修复后 lint、typecheck、49 suites / 296 tests、privacy scan、Expo dependency check、Expo Doctor 21/21 与 `git diff --check` 全部 PASS；此前双次 clean CNG prebuild 亦通过。
- CNG 发现 35 个依赖模块及本地 `expo-trip-native`；生成结果一致。

T108 已完成。未执行 T109 或后续 Phase 9 任务；Android emulator 证据不替代 iOS simulator 或 Android/iOS 真机验收。
