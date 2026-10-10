# Phase 7 Native Module / Backup Exclusion Review

日期：2026-10-10。T082–T093 已完成实现、自动验证、Diff Review 与 Constitution Check；T094 Human Review 已由用户批准为 PASS，阶段性批准进入 Phase 8。本阶段记录区分源代码/Jest/CNG 证据、Development Build 产物和真机系统行为。

## Automated Validation

| 检查 | 结果 | 证据边界 |
|---|---|---|
| Node / npm | PASS | Node 22.23.3、npm 10.9.9 |
| lint / typecheck | PASS | `npm run lint`、`npm run typecheck` |
| Jest | PASS | 44 suites、276 tests、0 snapshots |
| diff whitespace | PASS | `git diff --check` |
| CNG | PASS | 两次 SDK 57 clean-by-default prebuild、Local Module autolinking 与生成文件 hash 一致 |
| Android source manifest / backup XML | PASS（生成证据） | `allowBackup=false`，旧/新规则覆盖 file/database/sharedpref；不等于 merged artifact |
| Android merged manifest | PENDING | 验证器已提供；需 Development Build artifact，检查 exact alarm 与无关敏感权限 |
| Android backup / device transfer | PENDING | 需目标设备和 OEM 实测 |
| iOS native tests / resource readback | PENDING | 测试源和步骤已提供；需生成 workspace 后执行 |
| iPhone backup / restore | PENDING | 模拟器、Jest 或 XCTest 均不替代真机 restore |

T088 检查发现 SDK 57 `expo-file-system` 的传递 manifest 声明旧版 READ/WRITE_EXTERNAL_STORAGE。已用 SDK 57 `android.blockedPermissions` 移除，并增加 CNG removal marker 与 merged artifact 回归检查。修复后自动门禁通过；最终 merged manifest 仍保持 PENDING。

`tasks.md` 不包含 T090；本阶段从 T089 直接依赖到 T091。Development Build 和设备证据由后续构建/设备门禁承接，本阶段没有虚构或跳过 T090。

## T088 Android Review

- CNG plugin 设置 `allowBackup=false`、`fullBackupContent` 与 `dataExtractionRules`。
- 旧规则与 Android 12+ cloud-backup/device-transfer 均排除适用 file/database/sharedpref 及 device-protected domains；通知 SharedPreferences 包含在排除范围。
- `verify:android-artifact` 面向实际 merged manifest，拒绝 exact alarm、位置、相机、麦克风、通讯录、日历、媒体及电话等无关敏感权限。
- 当前没有 Development Build artifact，因此 merged manifest 与 OEM backup/transfer 结论为 PENDING。

## T089 iOS Review

- 生产模块固定使用 user-domain Application Support/TripCountdown，不使用 Caches、tmp 或 SQLite 默认目录。
- 初始化在数据库打开前验证目录；启用 WAL 后再次调用同一幂等原生边界，覆盖新建 DB/WAL/SHM/journal。
- Swift 每次调用设置并读回 `isExcludedFromBackup`，现有文件属性丢失时重新维护；验证失败使初始化关闭连接并进入 failed，绝不回退默认路径。
- XCTest 入口、静态契约检查与 Development Build/真机步骤已存在；尚未实际原生编译、读回或 backup/restore，状态为 PENDING。

## Diff Review

| 检查项 | 结论 | 说明 |
|---|---|---|
| Native boundary | PASS | Local Module 只准备/验证目录，不含 Trip、Checklist、Countdown 或通知业务 |
| SQLite path | PASS（JS 契约） | SDK 57 `openDatabaseAsync(name, {}, directory)` 使用原生返回目录，无默认目录 fallback |
| 初始化与清理 | PASS（自动） | 两平台 prepare 失败均零 open；post-open verification 失败关闭连接并保持 failed |
| WAL / sidecar | PASS（设计/自动），设备待验证 | WAL 后二次 prepare；真实文件路径与属性需 Development Build |
| CNG | PASS | plugin、本地模块与规则两次隔离 prebuild 等价；仓库无生成 android/ios source-of-truth |
| Backup rules | PASS（生成），系统待验证 | cloud backup 与 device transfer 均覆盖；不宣称控制 OEM 私有迁移 |
| 依赖与数据源 | PASS | 无新依赖、ORM、AsyncStorage、后端或第二业务数据源 |
| 范围 | PASS | 无 standalone module/npm publish、Phase 8、EAS 或 release 实现 |

没有遗留代码级 BLOCKER、HIGH、MEDIUM 或 LOW 问题。真实系统证据为计划内 PENDING，而非自动测试 PASS。

## Constitution Check

| 原则 | 结论 | 说明 |
|---|---|---|
| III Privacy Minimal | PASS（实现），设备待验证 | 数据目录 fail-closed、备份规则覆盖、旧外部存储权限已阻止；merged manifest/restore 待后续 |
| V Native Boundary | PASS | Kotlin/Swift 仅实现不可由共享 TS 完成的平台存储属性，API 窄且无业务规则 |
| IX Simplicity / Dependency Restraint | PASS | 无新增依赖或额外持久化层；复用既有 Private Storage port |
| X Specification Driven Development | PASS | T082–T093 与 FR-017a/SC-009 可追踪；T094 已由用户人工批准 |
| XII Release Safety | 部分待设备验证 | 未把 Jest/prebuild 当原生编译、merged artifact 或备份恢复证据 |

## T094 Human Review Matrix

T094 已完成对 Kotlin/Swift、config plugin、生成配置与备份边界的人工审查。下列 Development Build、真机和系统行为检查尚未执行，因此继续保持 PENDING；阶段批准不改变这些证据状态。

| 场景 | 预期 | 当前证据 | 人工状态 / 后续依赖 |
|---|---|---|---|
| Android 私有目录 | 返回 noBackupFilesDir 固定子目录，无 fallback | Kotlin source/unit test entry | PENDING — Development Build/设备 |
| Android generated config | 三个 manifest 属性与两套规则可重现 | 双 prebuild PASS | PASS — Human Review |
| Android merged permissions | 无 exact alarm、外部存储及无关敏感权限 | artifact verifier ready | PENDING — merged artifact |
| Android cloud backup | 业务数据不恢复 | XML 生成 PASS | PENDING — device backup/restore |
| Android device transfer | 业务数据不迁移 | dataExtractionRules 生成 PASS | PENDING — 目标设备/OEM |
| iOS Application Support | DB 位于固定受保护目录 | Swift/static test | PENDING — Development Build readback |
| iOS repeated initialization | 丢失属性可恢复，失败 fail-closed | XCTest source / JS failure injection | PENDING — native test execution |
| iOS sidecars | DB/WAL/SHM/journal 均 excluded | post-WAL second prepare design | PENDING — resource-value readback |
| iPhone backup/restore | Trip/Checklist/Reminder 不恢复 | 无设备证据 | PENDING — real iPhone encrypted backup |
| Bootstrap | Native/verification 失败显示 unavailable，不写默认 DB | Jest PASS | PENDING — Development Build failure injection |
| CNG reproducibility | clean generation 无手工原生补丁 | automated PASS | PASS — Human Review |

## Human Review

T094：**PASS — 阶段性批准进入 Phase 8 — Integration / Error / Accessibility**。

人工审查依据：T082–T089、T091–T093 已完成，当前 `tasks.md` 不存在 T090；Node 22 环境下 44 test suites、276 tests 全部通过；`npm run lint`、`npm run typecheck`、`npm run test:ci`、`npm run verify:prebuild` 与 `git diff --check` 均为 PASS；Diff Review 和 Constitution Check 通过；Android 多余存储权限已通过 `blockedPermissions` 修正并具备后续 merged artifact 验证入口。

本次批准只解除进入 Phase 8 的阶段门禁，不表示真实原生运行或发布验收通过。Android/iOS Development Build、真实 merged manifest、iOS backup exclusion 属性读回、真实 SQLite 与离线重启、Android/iPhone backup/restore，以及 VoiceOver/TalkBack、外接键盘和字体缩放等设备无障碍验证继续保持 `PENDING`。Jest、静态检查与 Prebuild 结果不得作为上述真实设备行为的通过证据。
