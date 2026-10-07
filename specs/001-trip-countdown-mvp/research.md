# Phase 0 Research

日期：2026-10-06。依据 SDK 57 版本文档及官方 sdk-57 源码。未执行实现。2026-10-06 用户接受 R1 的 Android 限制，Specification 和设计文档已同步，研究决策已收敛。

## R1 — Reminder 的设备时区与关闭应用行为（2026-10-06 已接受限制）

**Decision**：Android 使用 expo-notifications 的一次性 DATE 调度及无 exact 权限的 best-effort；iOS 候选使用非重复 CALENDAR，不指定固定 timezone。用户已接受 Android 在调度时按本地时区09:00计算，启动或恢复前台后按新时区重排；关闭期间切换时区不保证自动跟随。FR-028a 已同步该平台约定。

**Rationale**：SDK57 DateTrigger 保存绝对 timestamp；Android manifest 未注册时区变化 receiver。前台恢复重排可以修正后续请求，但不覆盖一直关闭应用的场景。CalendarTriggerInput 仅支持 iOS。Android 调度委托在没有 exact 能力时回退 setAndAllowWhileIdle，因此不申请 exact 权限有可用路径，但不保证准点送达。

**Alternatives considered**：固定 timestamp 并假称浮动时区不可接受；自建 Kotlin 时区 receiver/调度恢复需要另行评估通知边界，不擅自引入；每天重复通知无法正确表达单次指定日期，不采用。最终采用用户批准的方案：调度时按当前时区09:00，启动/前台恢复再重排，并明确关闭期间限制。新目标时刻已过去则取消旧安排、不补发，显示不可用；已送达的不重复安排。

来源：[Expo SDK57 Notifications](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/)、[DateTrigger源码](https://raw.githubusercontent.com/expo/expo/sdk-57/packages/expo-notifications/android/src/main/java/expo/modules/notifications/notifications/triggers/NotificationTriggers.kt)、[Manifest](https://raw.githubusercontent.com/expo/expo/sdk-57/packages/expo-notifications/android/src/main/AndroidManifest.xml)、[SchedulingDelegate](https://raw.githubusercontent.com/expo/expo/sdk-57/packages/expo-notifications/android/src/main/java/expo/modules/notifications/service/delegates/ExpoSchedulingDelegate.kt)、[Android alarms](https://developer.android.com/develop/background-work/services/alarms)、[Apple calendar trigger](https://developer.apple.com/documentation/usernotifications/uncalendarnotificationtrigger)。以上 Android 能力缺口为基于官方实现的推论；iOS 时区切换行为须用实际构建验证。

## R2 — Backup exclusion / CNG

**Decision**：Android allowBackup=false，加本地 config plugin 生成旧 fullBackupContent 和新 dataExtractionRules 的排除规则。cloud-backup 排除适用的 root/file/database/sharedpref/external 与 device-protected 域；device-transfer 也配置排除以避免官方迁移通路复制，不能声称能约束所有 OEM 私有搬迁。SQLite 放 noBackupFilesDir 下。iOS 用 Application Support/TripCountdown；Swift 在每次 storage initialization、DB 打开前验证必要目录、数据库及已有 sidecar 的 isExcludedFromBackup，缺失时重新设置并读回确认。

**Rationale**：SDK57 Android 通知库用 SharedPreferences 保存请求，排除 SQLite 不够。iOS 路径可由 SQLite directory 参数指定，但需平台 backup resource attribute；属性可能因目录或文件被替换而缺失，所以不能只在首次创建时设置。Expo Local Module 提供最小目录准备与逐次验证 API，CNG 生成规则可重复。初始化保护失败必须中止写业务数据，不能默默退回默认目录。

**Alternatives considered**：只排除 .db 遗漏 WAL/SHM/通知存储；只设置 allowBackup 无法解释所有版本和厂商行为；Caches/tmp 会被清理，不适合持久化；手改生成工程不可重现。

来源：[Android Auto Backup](https://developer.android.com/identity/data/autobackup)、[Expo SDK57 app config](https://docs.expo.dev/versions/v57.0.0/config/app/)、[通知 SharedPreferences源码](https://raw.githubusercontent.com/expo/expo/sdk-57/packages/expo-notifications/android/src/main/java/expo/modules/notifications/service/delegates/SharedPreferencesNotificationsStore.kt)、[Apple备份属性](https://developer.apple.com/documentation/foundation/urlresourcekey/isexcludedfrombackupkey)、[Apple文件系统](https://developer.apple.com/documentation/foundation/using-the-file-system-effectively)、[Config plugins](https://docs.expo.dev/config-plugins/introduction/)。

**Verification boundary**：iOS 系统通知队列不是应用可设置属性的目录。业务 Reminder 选择只在受保护 SQLite；通知使用通用中文与不透明 ID，不能复制用户输入。仍需备份/恢复真机证据验证系统调度副本；若平台测试表明业务 Reminder 状态被恢复，不得标记 FR-017a 通过，需重新评审。应用配置不能保证控制厂商非标准备份实现。

## R3 — Local Module 的必要性与边界

**Decision**：modules/expo-trip-native 使用 Expo Local Module，提供 preparePrivateStorage 的小型平台能力；不增加触觉产品交互，不重复通知。模块不导入 src/domain，便于未来抽离，当前不 publish。

**Rationale**：iOS 备份属性与 Android 受保护目录是已批准隐私需求；仅 SQLite API 不完整覆盖。用户列出的 timezone/feedback API 是示例，不意味着必须创建无业务用途的原生函数。

**Alternatives considered**：创建所有示例 API 无必要；Standalone Module/npm 发布超出阶段；Kotlin/Swift 重写通知违反边界。

来源：[Expo Local Module](https://docs.expo.dev/modules/get-started/)、[CNG](https://docs.expo.dev/workflow/continuous-native-generation/)。

## R4 — SQLite、状态与日期

**Decision**：唯一 SQLite 来源、参数绑定、foreign_keys/WAL、user_version 顺序迁移、独占短事务、轻量 Repository；React 保存临时表单/查询展示。纯 TS date-only 算术和 grapheme 校验。Create 拒绝过去 departureDate；Edit existing Trip 允许保存合法过去日期。Trip 删除不持久化 lifecycle/deleting 状态，仅用 UI `isDeleting`，先取消 future scheduled reminders，再事务删除并 FK cascade。

**Rationale**：事务失败可回滚，schema 可升级；页面刷新从 DB 恢复，不产生长期双状态。Create/Edit 分流允许自然过期 Trip 继续编辑而不引入 Archive。日历 components 映射 UTC day ordinal 避免 DST 天长变化，UTC 不承担用户日期语义。删除取消失败则保留 SQLite 数据；若取消成功后在 DB 删除前崩溃，启动 reconciliation 根据仍存在的 Reminder desired state/status/revision/notification_id 恢复 future 调度。不为历史已展示通知阻塞删除。

**Alternatives considered**：ORM、AsyncStorage、Redux/Zustand/MobX、通用多层框架不提供当前不可替代收益；UTC timestamp 出发日期违反要求；JS length 不等于可见字符；Trip lifecycle/deleting 持久状态不是 Specification 要求，增加 schema 和恢复分支而无必要收益。

来源：[SDK57 SQLite](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/)。迁移/表设计为本项目决策。Intl.Segmenter 的 Hermes 实际兼容性须在实施验证，不以 Node 中通过代替原生通过。

## R5 — 测试、构建与质量门禁

**Decision**：项目统一使用 Node 22.x、最低22.13；Implementation 增加 `.nvmrc`（22）和 `package.json#engines.node`（`>=22.13 <23`），GitHub Actions 使用 Node 22，不采用本机 Node 24 作为基线。Jest/jest-expo + RNTL 为自动行为门禁，实际 SQLite 与真机测试提供原生证据；GitHub Actions npm ci/lint/typecheck/test 全必需。EAS development/preview/production 分离，Android生产APK、iOS商店IPA，人工审核和提交。

**Rationale**：Local Module 需要开发构建；Jest native mock 不能证明文件持久化。已存在 npm lockfile，不增第二包管理器；release 验证脱离 Metro，覆盖离线。

**Alternatives considered**：Expo Go 验收原生配置不成立；大量 snapshot 不验证行为；JS测试通过不能替代设备证据；自动商店发布不在范围。

来源：[Expo Jest](https://docs.expo.dev/develop/unit-testing/)、[EAS build profiles](https://docs.expo.dev/build/eas-json/)、[APK](https://docs.expo.dev/build-reference/apk/)、[SDK57版本矩阵](https://docs.expo.dev/versions/v57.0.0/)。

## Dependency and Privacy Review

“不引入 Firebase”解释为：不配置 Firebase project，不使用 Firebase Analytics、Crashlytics、Firestore、Auth、FCM Remote Push 或 Device Push Token。接受 expo-notifications Android 自身可能包含 Firebase Messaging 传递依赖；该事实不得产生产品级 Firebase 服务依赖、远程推送或用户跟踪。Release 必须审查锁定版本依赖、dependency graph、merged manifest、permissions、自动初始化与实际网络行为，不能只以“未调用 push API”代替隐私验收。依据为 R1 的 SDK57 Manifest。

## Research Exit

R1 已获用户确认。Targeted amendment 已收敛 Node、Create/Edit 校验、删除、Firebase 与 iOS backup 设计；后续 consistency sync 已将 Specification、Quickstart 与 Contracts 统一为 Create 拒绝过去日期、Edit 允许合法过去日期，以及无持久化 Trip deleting lifecycle 的删除边界。Specification Driven / cross-artifact consistency gate 通过，可以进入 Tasks。平台真机验证仍属后续实现验收，不能虚构为本轮已测。本次不开始 Implementation。
