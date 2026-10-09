# Phase 6 Reminder Review

日期：2026-10-09。T066–T080 已完成实现、自动验证、Diff Review 与 Constitution Check；T081 Human Review 结论为 **PASS**，批准进入 Phase 7 — Native Module / Backup Exclusion，但尚未执行 Phase 7。生产 Bootstrap 仍等待 Phase 7 Native Private Storage，因此本记录只把 Jest/Mock 结果作为 TypeScript 行为和契约证据，不把它们表述为真实 SQLite、系统通知送达、后台、重启或时区切换的设备证据。

## Automated Validation

环境：Node `v22.23.3`，npm `10.9.9`。

| 检查 | 结果 | 证据边界 |
|---|---|---|
| Reminder 定向测试 | PASS | 11 suites、69 tests、0 snapshot；adapter、permission、calendar、coordinator、reconciliation、delete coordination、UI 与 bootstrap |
| `npm run lint` | PASS | Expo SDK 57 ESLint，退出码 0 |
| `npm run typecheck` | PASS | strict TypeScript `tsc --noEmit`，退出码 0 |
| `npm run test:ci` | PASS | 38 suites、249 tests、0 snapshot；全部 Jest/RNTL 自动测试 |
| `git diff --check` | PASS | 无空白错误 |
| iOS/Android 真实本地通知 | PENDING | 待 Phase 7 Native Private Storage 和 Development Build |

## Requirements Traceability

| 需求 | 实现与自动证据 | 状态 / 后续依赖 |
|---|---|---|
| FR-023：7 天与 1 天独立提醒 | `ReminderSection`、calendar/coordinator/UI tests | 自动 PASS；真机调度 PENDING |
| FR-024：仅主动启用请求权限 | permission flow、enable coordinator、UI tests | 自动 PASS；系统权限弹窗 PENDING |
| FR-025：拒绝/撤销不影响 P1 | 类型化 permission denied、中文状态、普通浏览不重请求 | 自动 PASS；系统设置撤销 PENDING |
| FR-026：修改日期后按原 offset 重排 | `rescheduleForTrip`、Edit Trip 集成 tests | 自动 PASS；真实 OS 重排 PENDING |
| FR-027：关闭/删除取消提醒 | disable tests、Trip deletion coordination | 自动 PASS；真实取消与 FK cascade PENDING |
| FR-028：同 Trip/offset 最多一个请求 | 稳定 identifier、Trip 队列、cancel-before-schedule、revision tests | 自动 PASS；OS 队列 PENDING |
| FR-028a：本地 09:00 与 Android R1 | calendar/timezone tests、前台 reconciliation、完整限制文案 | 自动 PASS；送达时间、后台和时区切换 PENDING |
| FR-028b：不推断目的地时区 | 调度只接收 date-only、offset、设备时区；无城市/网络逻辑 | PASS |

## Concurrency, Revision and Idempotency Review

| 检查项 | 结果 | 结论 |
|---|---|---|
| Trip 级串行 | PASS | Coordinator、Reconciliation orphan cleanup 与 Trip deletion 共用 `ReminderTripQueue`；同 Trip 操作顺序执行，不同 Trip 不互相阻塞 |
| Revision 保护 | PASS | intent 先增加 revision；scheduled/disabled/error/unavailable 最终确认均通过 `updateIfRevision`，旧结果不能覆盖新意图 |
| Enable 幂等边界 | PASS | 固定 `trip-{id}-before-{offset}` 标识，先取消旧请求再安排；快速重复操作串行，不产生两个有效标识 |
| Disable 幂等边界 | PASS | 已确认 disabled 直接返回；取消失败保留可重试状态，不虚报关闭成功 |
| Reconciliation 幂等 | PASS（自动） | 已一致的 scheduled 请求保持不变；pending、缺失请求、时区变化和过期目标按最新持久化状态修复 |
| DB/OS 边界 | PASS | OS permission/schedule/cancel/list 调用均不在 SQLite transaction 内；SQLite 不被当作 OS 成功证明 |

Reconciliation 取得的 OS 列表可能在进入 Trip 队列前变旧，但进入共享队列后会重新读取该 Trip 的最新 Reminder revision。稳定 identifier 与 cancel-before-schedule 使过时快照最多引起一次安全重排，不会让旧 revision 覆盖新意图。

## Delete and Crash Recovery Review

| 场景 | 自动证据 | 结论 |
|---|---|---|
| 全部 future requests 取消成功 | `trip-delete-coordination` | 取消发生在 Repository delete 之前，成功 commit 后才报告删除成功 |
| 首个取消成功、后续取消失败 | partial cancellation test | 不调用 Trip delete；全部 SQLite Trip/Checklist/Reminder 保留 |
| 部分取消失败后的恢复 | desired state 保留 + reconciliation missing-request repair | 已取消但仍应存在的 future request 可在下次 reconciliation 重建；真实重启 PENDING |
| 取消后、DB delete 前崩溃 | injected `afterCancellations` crash test | DB desired state 仍存在；下次 reconciliation 恢复 future request，不增加 Trip lifecycle |
| DB delete 失败 | delete failure test | 不报告成功；仍存在的 desired state 可由 reconciliation 修复取消过的请求 |
| delivered history | scheduled-list-only deletion test | 已展示历史通知不阻塞删除，也不调用 delivered cleanup |
| 其他 Trip | isolation assertions | 不取消其他 Trip 的 request，不清空全局通知 |

## Orphan Cleanup Scope

Reconciliation 只清理由严格命名空间正则 `^trip-([1-9]\d*)-before-(1|7)$` 识别、且 SQLite 当前 Reminder 集合未认领的 scheduled request。其他 feature 或系统产生的 identifier 不会被清理。清理仍通过解析出的 Trip ID 进入共享队列，避免与同 Trip 的用户操作或删除并发执行。

## Privacy and Platform Boundary Review

| 检查项 | 结果 | 结论 |
|---|---|---|
| 权限时机 | PASS | 普通启动、浏览、reconciliation、日期修改只查询权限；仅明确 enable 可请求 |
| 通知内容 | PASS | 固定简体中文标题/正文和固定类型，不含 Destination、Notes 或 Checklist |
| Remote push/token | PASS | Adapter 无 push token API；无注册、远程服务或 Device Push Token 调用 |
| Exact alarm | PASS（源码） | 使用一次性 DATE/CALENDAR trigger；未申请或调用 exact alarm API；merged manifest 待后续构建检查 |
| 目的地时区 | PASS | 只使用设备当前本地时区；无城市映射、位置或网络服务 |
| Android best-effort | PASS（文案/设计） | UI 明确可能延迟、前台恢复重排及关闭期间切换时区不保证自动跟随 |
| Firebase 边界 | PASS（源码） | 无 Firebase project、Analytics、Crashlytics、Firestore、Auth、FCM remote push 或 token；传递依赖/manifest/网络仍待 release gate |

## Phase 6 Diff Review

| 检查项 | 结果 | 说明 |
|---|---|---|
| 架构边界 | PASS | UI 依赖 Repository contract 与 Coordinator；Feature 无 SQL/data implementation import |
| 持久化来源 | PASS | Reminder intent/status/revision/notification_id 仅在 SQLite Repository；无 AsyncStorage、ORM 或全局业务状态 |
| 状态与恢复 | PASS | pending/scheduled/disabled/error/unavailable/permission_denied 有明确恢复路径，不显示假成功 |
| 并发与崩溃窗口 | PASS（自动） | 共用 Trip 队列、revision 条件更新、删除崩溃注入与 reconciliation repair |
| 通知范围 | PASS | local-only、固定内容、稳定 identifier；无 remote push/token/exact alarm/目的地时区 |
| Android R1 | PASS | 已确认的 best-effort 与关闭期间时区限制未扩大或掩盖 |
| 产品范围 | PASS | 未实现 Native Module、backup exclusion、EAS 或 Phase 7 能力 |

审查中发现一项 MEDIUM 文案缺口：Android UI 原先未明确写出“应用关闭期间切换时区不保证自动跟随”。已按 FR-028a 做最小修复并增加 RNTL 断言；修复后全部门禁通过。没有遗留 BLOCKER、HIGH、MEDIUM 或 LOW 代码问题。

## Constitution Check

| 原则 | 结论 | 说明 |
|---|---|---|
| II Offline First | 部分待设备验证 | 设计无网络依赖；真实离线启动、后台与重启恢复待 Development Build |
| III Privacy Minimal | PASS（源码），设备待验证 | 固定无用户正文 payload、按需权限、无 tracking/push token；manifest/网络行为待后续 |
| IV 数据和业务边界 | PASS | Coordinator 分离 SQLite intent 与 OS adapter；UI 无 SQL，OS API 不进 DB transaction |
| V Native Boundary | PASS | 使用成熟 Expo local notification API；未在 Kotlin/Swift 重复通知或业务逻辑 |
| VI 面向行为的测试 | 部分待设备验证 | 249 个自动测试覆盖行为与失败恢复；Mock 不证明真实送达 |
| VII 完整且可恢复体验 | PASS | permission denied、unavailable、error、retry、busy 与删除失败均不产生假成功 |
| IX 简单代码与依赖克制 | PASS | 仅必要 Coordinator/Reconciler/adapter，无状态库、ORM、后端或额外依赖 |
| X Specification Driven Development | PASS | T066–T080 与 FR-023–028b 可追踪；T081 已由用户人工批准并记录 |
| XII Release Safety | 部分待设备验证 | 未把 Jest/Mock 当 release 证据；manifest、权限、真实通知和目标设备仍待后续 |

## T081 Human Review Matrix

T081 已完成对权限时机、平台差异文案、一致性和崩溃恢复设计的人工审查。下列 Development Build、真机与系统行为检查尚未实际执行，因此继续保持 `PENDING`；T081 的阶段批准不改变这些验证状态。

| 场景 | 预期行为 | 自动证据 | 人工状态 | 后续依赖 |
|---|---|---|---|---|
| 普通启动/浏览 | 不弹通知权限；P1 正常可用 | permission/UI/bootstrap tests | PENDING | Development Build 系统弹窗观察 |
| 主动开启 7 天 | 需要时请求权限，授权后安排本地提醒 | enable/calendar/adapter tests | PENDING | iOS/Android 真实权限与 OS schedule |
| 主动开启 1 天 | 与 7 天独立，不产生重复请求 | offset 参数化 tests | PENDING | 真机 OS 队列 |
| Permission denied | 明确中文反馈，不影响 Trip/Checklist | permission/UI tests | PENDING | 真实系统拒绝与再次进入 |
| 权限撤销 | 普通恢复只查询并显示不可用，不强制请求 | permission/reschedule tests | PENDING | 系统设置撤销、前台恢复 |
| Disable | 取消成功后才显示关闭；失败可重试 | disable tests | PENDING | 真实 OS cancel failure |
| 修改 Departure Date | Trip 先保存；提醒保留 offset 重排，失败不回滚 Trip | reschedule/Edit tests | PENDING | 真实 SQLite + OS 调度 |
| 过去目标 | 取消旧请求、不补发、显示不可用 | calendar/reconciliation tests | PENDING | 真实系统队列与送达历史 |
| Android 时区变化 | 返回前台后按新时区重排 future request | timezone/reconciliation tests | PENDING | Android Development Build 时区切换 |
| Android 关闭期间切时区 | 不承诺自动跟随，UI 明确限制与可能延迟 | ReminderSection 文案 test | PENDING | 真机后台/关闭场景 |
| Reconciliation 幂等 | 多次启动/前台恢复无重复有效通知 | reconciliation tests | PENDING | 真实后台、重启、OS queue |
| 删除 Trip | 先取消该 Trip future requests，再 transaction delete/cascade | delete coordination tests | PENDING | 真实 SQLite + OS notifications |
| 部分取消失败 | 不删 SQLite；下次恢复缺失 future request | partial failure/reconciliation tests | PENDING | 原生失败注入、进程重启 |
| 取消后崩溃 | DB desired state 保留，重启恢复 future request | crash injection test | PENDING | 真机杀进程/重启 |
| 孤儿清理 | 只清理应用 Reminder 命名空间，不碰其他通知 | orphan scope test | PENDING | 真实 OS queue 混合请求 |
| 通知隐私 | payload 无目的地、备注、Checklist；无 remote push/token | adapter tests、静态审查 | PENDING | artifact、manifest、网络行为检查 |
| Android best-effort | 不保证准点，不申请 exact alarm | adapter/UI/static review | PENDING | merged manifest、华为真机送达 |
| Reminder Accessibility | 中文名称、状态、错误和 busy 可感知，长文案可换行 | RNTL 自动语义 | PENDING | VoiceOver/TalkBack、字体缩放、键盘 |

## Open Dependencies

- T081 已由用户人工批准，可以进入 Phase 7；该批准不构成 Development Build、真机或发布验收。
- Phase 7 Native Private Storage 完成前，production Bootstrap 仍明确 unavailable，无法形成生产路径设备证据。
- 真实 iOS/Android 本地通知调度、取消、实际送达、后台、重启、时区变化和 Android 延迟仍待 Development Build/真机。
- 真实 SQLite、离线重启恢复、merged manifest/permissions/dependency graph/网络行为、VoiceOver/TalkBack、外接键盘和字体缩放仍待后续门禁。

## Human Review

T081：**PASS — 已批准进入 Phase 7 — Native Module / Backup Exclusion**。

人工审查依据：T066–T080 已完成；Node 22 环境下 38 test suites、249 tests 全部通过；`npm run lint`、`npm run typecheck`、`npm run test:ci` 与 `git diff --check` 均为 PASS；审查发现的 MEDIUM Android 时区限制文案问题已修复，且无遗留代码问题。

本次批准只解除进入 Phase 7 的阶段门禁，不表示真实设备通知送达或发布验收通过。真实通知权限、调度、取消和送达，后台/重启/时区行为，真实 SQLite 与离线恢复，Native Private Storage，以及 VoiceOver/TalkBack、外接键盘和字体缩放仍为 `PENDING`。Jest/Mock 自动测试不得作为上述真实设备行为的通过证据。
