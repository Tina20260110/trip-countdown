# Phase 9 Batch B — iOS Development / Preview Evidence

日期：2026-10-14。范围为 T109–T111；T109–T111 已完成。基准 commit 为 `76ce5d2429d7c38e4931dd61b1de66c3bbc3adfa`，本批变更未提交。

## T109 iOS Development Build

| 项目 | 结果 | 证据 |
|---|---|---|
| Simulator | PASS | iPhone 17 Pro，iOS 26.5，UDID `E2CDBCF6-FEB5-4D95-8FF1-DC11248E4296` |
| Native compile/install | PASS | Xcode 26.6，Release/Debug simulator build 均成功；CocoaPods autolink `ExpoTripNative (1.0.0)` |
| Real SQLite contract | PASS | `user_version=1`、WAL、主/事务连接 FK、非法外键拒绝、close/reopen、cascade、rollback、future-version rejection、Checklist persistence/isolation 均通过 |
| Private path | PASS | 实际文件位于 `Library/Application Support/TripCountdown`；未使用 expo-sqlite 默认数据库目录 |
| Backup exclusion | PASS（Simulator 属性读回） | 冷重启后目录、`trip-countdown.db`、`-wal`、`-shm` 均读到 `com.apple.MobileBackup` |

首次运行发现 Swift 将 `directory.path` 交给 SDK 57 `openDatabaseAsync`。SDK 57 iOS 端以 `URL(string:)` 解析 directory，含空格的 `Application Support` 因而被写成字面量 `Application%20Support`。修复为返回 `directory.absoluteString` file URL 后重建，真实契约写入正确目录。该问题有源码回归测试。

真实 Hermes 日志仍显示 `Intl.Segmenter` 为 `undefined`，但纯 JS grapheme fallback 正常，SQLite 契约完整 PASS。以上是 iOS Simulator 原生运行证据，不代表 iPhone 真机通知或备份恢复通过。

## T110 Rebuild / Refresh Boundary

- 原生边界从普通 path 改为 file URL 后，已安装 binary 仍表现为旧路径；重新执行 iOS native build/install 后才写入正确目录，证明 Local Module 变更需要 rebuild。
- 同一重建后的 Development Client 在不重建 native binary 的情况下，经 Metro 分别加载 SQLite device entry 与正常 Expo Router entry，二者均成功运行，证明纯 JS/TS 入口变更可通过 Metro refresh。
- 本批没有修改生成的 `ios/` 或 `android/` 工程，仍使用 CNG/autolinking。

## T111 Preview — PASS

| 平台 | Build | Metro 关闭冷启动 | 断网 | 持久化读/改/重启 | 结论 |
|---|---|---|---|---|---|
| Android 17 emulator | Release APK PASS | PASS | 飞行模式启用后 ping 失败 | 读取既有 Trip；UI 将 Checklist 从 completed 改为 pending；断网 force-stop/cold launch 后仍显示 `已完成 0 / 1` | PASS |
| iOS 26.5 simulator | Release simulator app PASS | PASS；Metro 端口无监听后直接 launch | PASS；Simulator ping 返回 100% packet loss 与 `No route to host` | 用户人工确认读取已有 Trip、修改 Checklist、杀进程并重新启动后修改仍存在 | PASS（人工验收） |

iOS Release 人工验收时，`lsof -nP -iTCP:8081 -sTCP:LISTEN` 无输出且退出码为 1，作为 Metro 未监听的命令记录；`xcrun simctl spawn booted /sbin/ping -c 2 -W 1000 1.1.1.1` 返回退出码 2、100% packet loss 与 `No route to host`，作为真实断网命令记录。随后两次直接 launch 均返回应用 PID。用户确认在该条件下完成冷启动、读取已有 Trip、修改 Checklist、杀进程重启并验证修改持久化。UI 操作结论来自用户人工验收，本记录没有虚构截图或未提供的 UI 日志。

### iOS 网络隔离复核

2026-10-14 再次核对 T111 原始验收条件，并在 booted iPhone 17 Pro Simulator 上执行只读诊断：

- `xcrun simctl spawn booted /sbin/ping -c 2 -W 1000 1.1.1.1` 成功，证明测试前 Simulator 确实可以访问外部网络。
- `xcrun simctl help` 与 `xcrun simctl help ui` 均没有飞行模式、Wi-Fi 或网络禁用能力。
- Simulator 内 `ifconfig` 显示的 active `en0` 与宿主机网络接口相同；将其关闭会改变整台 Mac 的网络状态，不是 Simulator 范围内的安全隔离。
- Simulator 内调用 `networksetup` 需要宿主机授权，不能形成独立、可恢复且可审计的设备级隔离。
- Computer Use native pipe 仍启动失败，无法通过受控 UI 自动化检查是否存在可用的 Simulator 设置入口。

此前的网络隔离能力评估保留为过程记录；最终断网条件由用户人工建立并确认。Android 结论沿用本文件此前记录的 emulator 设备验证证据，iOS 结论为本次用户人工验收证据。T111 据此标记完成；未执行 T112。

## Evidence Boundary

- Jest/Mock、Prebuild 与 Metro bundle 不替代上述 simulator 原生结果。
- Simulator 不替代 Android/iPhone 真机通知实际送达、后台、时区、backup/restore、运行时隐私和设备无障碍验收；这些后续门禁保持 PENDING。
- 本批没有 Expo/Apple 账号、EAS 云端构建或签名发布证据。
