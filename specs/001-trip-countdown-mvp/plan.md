# Implementation Plan: Trip Countdown MVP

**Feature**: `001-trip-countdown-mvp` | **Date**: 2026-10-06 | **Spec**: [spec.md](spec.md)

**Branch**: 工作流返回 `001-trip-countdown-mvp`；实际 Git 分支为 `main`，未创建或切换分支。

**Status**: Targeted amendment 与 consistency sync 已完成，未开始实现；设计文档可进入 Tasks 阶段。

## Summary

Expo Router Stack 承载四个页面，SQLite 为唯一业务数据来源，共享 TypeScript 实现日期、校验和进度逻辑。轻量 Repository 保存数据，expo-notifications 调度本地提醒，Expo Local Module 和 CNG 配置实现必要的平台隐私能力。应用自有 UI 文案均为简体中文。

## Technical Context

| 项目 | 决策 |
|---|---|
| Language/Version | TypeScript ~6.0.3，strict；Kotlin / Swift 随 SDK 57 生成工程工具链，不独立升级 |
| Primary Dependencies | 当前 Expo ~57.0.24、React Native 0.86.3、React 19.2.3、Expo Router ~57.0.22；expo-sqlite、expo-notifications 按 SDK 57 兼容版本安装并锁定 |
| Storage | 单一 SQLite；无 ORM、AsyncStorage 或全局业务状态库 |
| Testing | Jest、jest-expo、@testing-library/react-native；实际原生 SQLite 验证与真机验收补充 Jest |
| Target Platform | Android 7+、iOS 16.4+，华为目标设备必须真机验证；Web 不属于本次交付 |
| Toolchain | Node 22.x，最低 22.13；`.nvmrc` 固定 22，`package.json#engines.node` 为 `>=22.13 <23`，npm/package-lock；Xcode 26.4+，Android 工具链随 Expo 模板。不得以本机 Node 24 作为项目基线 |
| Performance Goals | 满足 SC-001 首次创建时长；列表聚合读取避免逐项查询，不虚构容量承诺 |
| Constraints | 离线，无账户/后端/上传/跟踪；业务数据排除云备份；无 exact alarm 主动授权 |
| Scale/Scope | 单设备、多 Trip；Trips/Create/Detail/Edit 四个 Stack 页面；P1 核心与 P2 提醒 |

版本依据：[Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/)。expo-dev-client 属于开发构建工具，ESLint/Expo lint 配置属于质量工具。当前只有 start/android/ios/web 脚本，尚无质量门禁与 EAS 配置。

## Constitution Check

| 原则 | 设计前 / 设计后检查 |
|---|---|
| I 严格类型 | PASS：strict 保留；Repository、原生和通知错误显式类型化，不使用无理由 any |
| II Offline First | PASS：本地业务，正式包内嵌 JS；联网构建不成为运行依赖 |
| III Privacy Minimal | 设计通过、实施待验证：备份排除覆盖 DB、sidecar 和通知持久化；仅主动提醒授权 |
| IV 数据与业务边界 | PASS：UI→feature→domain/Repository；SQL 限于 src/data |
| V Native Boundary | PASS：原生只承担备份属性/目录准备，不重写通知或业务 |
| VI 行为测试 | PASS：纯逻辑、UI、实际 SQLite 与设备重启分层验证，mock 不证明持久化 |
| VII 可恢复体验 | PASS：Loading/Empty/Error/Validation/Permission Denied、保留输入、重试、防重复提交 |
| VIII Accessibility | PASS：中文名称、角色/状态、读屏、键盘、字体缩放及触控尺寸验收 |
| IX 简单依赖 | PASS：无 ORM/全局状态/多层框架；必要提醒协调器处理跨系统一致性 |
| X Spec Driven | PASS：Specification、Plan、Data Model、Quickstart 与 Contracts 已统一 Create 拒绝过去日期、Edit 允许合法过去日期及简化删除边界 |
| XI CI | 设计通过、未执行：install/lint/typecheck/test 全部成功才可通过 |
| XII Release Safety | PASS：正式构建真机验证、华为环境、人工 Review 和人工商店提交 |

**Gate**：Phase 0、Phase 1 与本次 consistency sync 的设计门禁通过，可以进入 Tasks 阶段。实现、原生验证与人工 Review 仍须后续执行；没有运行应用质量门禁，不声称现有仓库已经通过实现质量门禁。

### Targeted Consistency Check — 2026-10-06

- **PASS**：Node 基线在 Technical Context、CI 与 research.md 一致；均为 Node 22.x、最低22.13，Implementation 增加 `.nvmrc` 与 `engines.node >=22.13 <23`，不使用 Node 24 基线。
- **PASS**：plan.md、research.md、data-model.md 均不再要求持久化 Trip lifecycle；删除使用 UI `isDeleting`、future reminder cancel、SQLite transaction + FK cascade，并保留 Reminder status/revision/notification_id reconciliation。
- **PASS**：Firebase 边界、iOS 每次 storage initialization 验证 backup exclusion，以及既有 SQLite/Repository/Countdown/Notification/Native/CNG/Test/CI/EAS 技术边界保持一致。
- **PASS**：spec.md 的 FR-004、Assumptions 与验收场景已区分 Create/Edit；quickstart.md 已同步测试步骤；contracts/ui-and-boundaries.md 已移除旧的分阶段删除 API 与持久化删除生命周期语义。全套设计文档可以进入 `$speckit-tasks`。

## Project Structure

```text
specs/001-trip-countdown-mvp/
  plan.md
  research.md
  data-model.md
  quickstart.md
  contracts/ui-and-boundaries.md
app/
  _layout.tsx                 # bootstrap / Stack composition
  index.tsx                  # Trips
  trips/new.tsx              # Create Trip
  trips/[id]/index.tsx        # Trip Detail
  trips/[id]/edit.tsx         # Edit Trip
src/
  domain/                    # date-only、validation、progress、实体类型
  features/trips/             # 页面与查询生命周期
  features/checklist/         # Checklist UI
  features/reminders/         # 调度协调器、权限/状态呈现
  data/                      # DB 初始化、migration、Repository
  components/                # 必要的可访问表单和状态组件
modules/expo-trip-native/
  src/
  android/                   # Kotlin
  ios/                       # Swift
  expo-module.config.json
plugins/                     # CNG 备份/权限配置
tests/
  domain/
  features/
  data/
  reminders/
  device/                    # 非发布的实际存储验证工具/记录
.github/workflows/quality.yml
.nvmrc
package.json                   # engines.node >=22.13 <23
eas.json
```

这是目标结构，未创建实现文件。迁移移除模板业务 Tabs 和示例路由；`components/EditScreenInfo.tsx` 存在用户修改，不能覆盖。测试不放 app/；android/ios 由 CNG 生成，不维护手工补丁。tasks.md 留给下一阶段。

## Data Model / SQLite Schema and Migration

字段与约束见 [data-model.md](data-model.md)。Trip→Checklist/Reminder 一对多；Countdown 与 progress 动态计算。

用 PRAGMA user_version 表示 schema version，首版 1。先准备排除备份的目录，再 openDatabaseAsync；每个连接启用 foreign_keys，使用 WAL。migration 按序在独占事务内执行，成功后才更新版本。数据库版本高于应用支持版本时停止写入；失败回滚、保留数据、允许重试，禁止删库重建。参数绑定处理用户内容；固定 migration SQL 可用 execAsync。写入串行化，withExclusiveTransactionAsync 内全部查询使用事务对象，避免异步事务混入其他操作。[SQLite SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/)

## Repository Boundaries and State

TripRepository 提供 list/get/create/update/delete；ChecklistRepository 提供 add/setCompleted/remove；ReminderRepository 保存选择与调度状态。返回业务模型及 validation/not-found/storage/unavailable 类型错误，不暴露 SQL、表名、SQLite row。

React local state 只持有表单、加载/错误/提交状态及当前页面短生命周期查询结果，不维护第二份长期业务来源。聚焦、写入成功、恢复前台后重新查询。Context 若使用，仅注入稳定 Repository/平台能力引用。Checklist 使用明确 setCompleted 值，提交时禁用重复操作；失败保持最后保存状态。

ReminderCoordinator 是 SQLite 与 OS 之间唯一必要协调点；不增加 Service/UseCase/DAO。通知调用通过小型可替换 adapter，便于失败测试。

## Countdown Calculation Strategy

Departure Date 保存经校验的 YYYY-MM-DD，不保存 UTC timestamp。当前时间取本地 year/month/day；双方 calendar components 转为 UTC date-only 数值，差除以 86,400,000。UTC 仅用于日历算术，不代表出发时刻。禁止裸日期解析后取本地日期，禁止本地午夜毫秒差除以一天。注意 JS 年份 0–99 特例，使用显式 UTC full-year 设置并 round-trip 校验实际日期。

正数“还有 N 天”、零“今天出发”、负数“旅行已结束”。Create Trip 保存时重新读取设备当前本地日期，拒绝早于当天的 departureDate；Edit existing Trip 只要求 departureDate 是合法 date-only 值，允许保存过去日期，使自然过期 Trip 仍能编辑 Destination、Notes 或修正日期。前台到下一本地午夜刷新，恢复前台和聚焦也重算，不使用固定24小时间隔。不新增 Archive 状态或功能。

长度按 grapheme cluster，优先验证 SDK 57 Hermes 的 Intl.Segmenter；不能退化为 JS length/code point 计数。组合重音、国旗、ZWJ emoji 纳入测试；如目标运行时缺能力，先审查最小兼容方案，不静默加库。

## Reminder Scheduling Strategy

仅 expo-notifications 本地通知，无 push token/后端。主动启用时查询并按需申请权限；canAskAgain=false 显示中文说明和系统设置指引。普通浏览只查状态，不弹授权。Android 创建本地 channel，iOS 区分授权状态；拒绝/撤销不阻断 P1。

从 Departure Date 减7或1个日历日，目标09:00，过去时间不补发。iOS 候选为非重复 CALENDAR components、不固定旧设备时区；Android DATE trigger 在安排时用当前本地时区构造，best-effort，不增加 SCHEDULE_EXACT_ALARM/USE_EXACT_ALARM。Android 启动或恢复前台时按当前设备时区重排尚未触发的提醒；关闭期间切换时区不保证自动跟随，用户已接受（R1）。新目标时间已过去则取消旧安排、显示不可用，不补发；已送达的不再次调度。 [Notifications SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/)

Trip/offset 采用稳定 notification identifier 与 revision。先保存 desired state=pending，取消旧调度，再安排新调度并确认；失败显示未生效和重试。OS 调用不能放在 DB 事务里。启动/前台恢复对照 SQLite 与 OS pending requests，修复 pending/孤儿；过去时间不补发。改日期先提交 Trip 与 Reminder revision，再协调；失败不回滚 Trip。关闭选项取消成功才确认，失败显示待重试。

Trip 删除不引入持久化 lifecycle/deleting 状态。用户确认后，页面用短生命周期 `isDeleting` 禁止重复操作；先取消该 Trip 的 future scheduled reminders。取消失败时保留全部 SQLite 数据、恢复可操作状态并允许重试；取消成功后在一个 SQLite transaction 中删除 Trip，由 foreign-key cascade 删除 Checklist 与 Reminder 记录。不为已经展示在 Notification Center 的历史通知阻塞删除。

如果 future 通知已取消但进程在 SQLite 删除前崩溃，启动 reconciliation 看到 Trip 与 Reminder desired state 仍存在时，按 status/revision/notification_id 重新调度仍然有效的 future reminders；已过去的目标不补发。SQLite 与 OS 无共同事务，测试须注入取消后崩溃窗口，验证恢复或最终删除均不产生重复通知。操作按 Trip 串行，revision 防止旧结果覆盖。

通知用固定中文准备提示，不复制 Destination/Notes/Checklist，仅含不透明 ID。系统调度额度/失败必须显示不可用，不静默丢弃，不假定无限待处理通知。

## Native Module Boundary

Expo Local Module 位于 modules/expo-trip-native。初始窄接口为 `preparePrivateStorage(): Promise<{ directory: string }>`：原生固定目录、不接收任意路径，失败类型化，平台不可用明确反馈；失败不能降级写入未保护目录。Kotlin 使用 noBackupFilesDir，Swift 设置备份排除属性。这是 FR-017a 必要平台能力，SQLite 自定义目录本身不设置 iOS backup resource value。

getDeviceTimeZone/successFeedback/warningFeedback 是用户允许的示例，本版不为示例新增触觉或重复已有 Expo 能力。核心 CRUD、Countdown、Checklist 保持 TypeScript；不实现通知引擎。模块不导入业务实体，后续可抽离，但本版不做 standalone/npm publish。[Local Module](https://docs.expo.dev/modules/get-started/)

## Backup Exclusion Implementation Strategy

Android：CNG plugin 配置 allowBackup=false，生成旧版 fullBackupContent 与 Android 12+ dataExtractionRules，排除 cloud-backup/device-transfer 的相关内部文件、数据库、shared preferences 域，覆盖 expo-notifications 自身持久化。DB 放 noBackupFilesDir 固定子目录，覆盖 -wal/-shm/journal，禁止未保护的业务副本。厂商行为必须华为实测。

iOS：Application Support 专用持久目录，设置 URLResourceValues.isExcludedFromBackup=true。每次 storage initialization 都必须在 DB 打开前验证必要目录、数据库及已有 sidecar 的 exclusion 属性；缺失时重新设置并读回确认，失败则停止初始化，不得只在首次创建时设置。不使用 Caches/tmp 保存业务。选择只进 SQLite，不写 UserDefaults/日志。通知内容不含用户输入；系统管理通知存储仍须独立验证，不能把目录标记视为控制系统数据库。

plugin、模块源码、app config、lockfile 纳入版本管理；干净 checkout prebuild 验证生成规则，再检查 APK/IPA 与备份恢复结果。配置存在不等于验收通过。来源及平台限制见 research.md。[CNG](https://docs.expo.dev/workflow/continuous-native-generation/)

## Testing Strategy

| 层次 | 范围 |
|---|---|
| Jest domain | Today/未来/过去、跨月/跨年/闰日、非法日期、DST、午夜、Asia/Shanghai 和 America/New_York；trim/长度/grapheme/保存时校验、progress |
| Jest + RNTL | Trip CRUD、Checklist CRUD/toggle、隔离、防重复、Loading/Empty/Error/retry、中文可访问名称/角色/状态、删除确认与取消 |
| Reminder adapter | 不主动授权、拒绝/撤销、过去时间、reschedule/cancel、重复、失败、中断恢复/revision |
| 实际 expo-sqlite | 同一 Repository 契约：写入/关闭重开、cascade、事务回滚、v0→v1、重复迁移、未来版本拒绝、保存失败不丢原数据 |
| 真机 release | 杀进程重启20次、离线冷启动/CRUD、时区/DST/后台提醒、备份排除、VoiceOver/TalkBack/键盘/大字体、华为后台/重启 |

使用 jest-expo preset，以行为断言为主。mock 不能证明原生持久化；tests/device 通过非发布测试入口执行实际 SQLite 契约并记录，不进业务 route/生产包。日期样本用独立 TZ 进程运行。[Expo Jest](https://docs.expo.dev/develop/unit-testing/)

## CI Strategy

GitHub Actions 在 PR/主分支 push 执行，明确使用 Node 22；Implementation 增加 `.nvmrc`（22）并在 `package.json` 设置 `engines.node: ">=22.13 <23"`，本机 Node 24 不作为开发或 CI 基线。CI 执行 npm ci → npm run lint → npm run typecheck → npm run test:ci（Jest --ci --runInBand）。缺配置即失败，不用 continue-on-error、passWithNoTests、吞退出码。typecheck=tsc --noEmit；lint 约束 UI 不能导入 SQLite。全部设 required checks，记录 commit、实际 Node 版本、命令和结果。JS CI 不替代真机/原生证据，本轮只规划，不生成 workflow。

## Development Build Strategy

expo-dev-client + EAS development profile（developmentClient=true、distribution=internal），或本机 expo run:android/run:ios。Expo Go 不承担 Local Module/备份集成验收。原生模块/plugin/config 变更需重建。隔离 checkout 验证 clean prebuild，不破坏用户修改。preview 内嵌 JS，验证脱离 Metro 的离线冷启动。iOS simulator 与真机签名分开；通知及正式验收使用真机。

## Release Build Strategy

EAS production 不含 developmentClient；Android android.buildType=apk，生成签名 Release APK，人工审核后提交华为应用市场，不使用默认 AAB 作为目标。[EAS APK](https://docs.expo.dev/build-reference/apk/)

iOS distribution=store、非 simulator，生成 Production IPA，人工上传 App Store Connect、选择中国大陆发行并人工提交。无 auto-submit。待发 APK 与对应 production/TestFlight 构建完成真机验证；记录版本、build number、构建 ID、签名/权限、设备矩阵、人工批准。包名/账号/证书由发布阶段确认，不编造；秘密不入 Git。EAS 接收构建源码，不接收用户数据库。[EAS profiles](https://docs.expo.dev/build/eas-json/)

“不引入 Firebase”在本项目中指不配置 Firebase project，不使用 Firebase Analytics、Crashlytics、Firestore、Auth、FCM Remote Push 或 Device Push Token。接受 expo-notifications Android 自身可能包含 Firebase Messaging 传递依赖，但该依赖不得形成产品级 Firebase 服务、远程推送或用户跟踪。Release 验收检查 merged manifest、permissions、dependency graph 与实际网络行为。

发布前核查当时有效商店要求、隐私与材料，不宣称已满足审核。无 EAS Update、Analytics 或自动发布需求。

## Risks and Trade-offs

1. R1 已接受的取舍：Android 关闭期间切换时区不保证跟随，启动/恢复前台才重排；best-effort 不保证恰好09:00送达。UI 与验收必须准确表达。
2. 不备份意味着卸载/丢失不可恢复；厂商与系统通知数据行为要实测。
3. DB/OS 无原子事务；使用 Reminder 的 desired state/status/revision/notification_id 和启动 reconciliation 覆盖取消后、删除前的崩溃窗口，不增加 Trip lifecycle 状态。
4. Jest 不覆盖原生持久化和系统调度；真机证据必须保留。
5. Hermes grapheme、通知额度、华为后台限制均须验证，不能用新后台服务/权限绕过。

## Complexity Tracking

无章程豁免。Repository、提醒协调器和备份模块均服务现有需求；R1 已由用户明确接受并同步至 Specification，不构成章程豁免。
