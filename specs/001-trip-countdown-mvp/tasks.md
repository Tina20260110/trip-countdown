# Tasks: Trip Countdown MVP

**Input**: `spec.md`、`plan.md`、`research.md`、`data-model.md`、`quickstart.md`、`contracts/ui-and-boundaries.md`、`.specify/memory/constitution.md`

**Status**: Phase 1 T001–T011、Phase 2 T012–T024A、Phase 3 T025–T040A、Phase 4 T041–T055、Phase 5 T056–T065、Phase 6 T066–T081 与 Phase 7 T082–T094 已通过；已批准进入 Phase 8，但尚未执行 Phase 8。T061 真实 SQLite contract、Android merged development artifact、Android/iOS 原生测试与真实备份属性尚未在 development build/真机执行；通知调度、离线重启恢复及设备无障碍/字体缩放证据仍待后续验证。

**约束**:

- 本清单不改变已确认架构、功能范围或技术决策。
- 测试文件统一位于 `tests/`，不得放入 `app/`。
- SQLite 是唯一业务 Source of Truth；不得引入 ORM、AsyncStorage 或第二套业务数据源。
- `android/`、`ios/` 由 CNG 生成，不接受不可重现的手工补丁。
- `[P]` 仅表示在其 Dependencies 已满足后，可与同样无文件冲突的任务并行。
- 每个 Phase 必须依次通过 Automated Validation、Diff Review、Constitution Check、Human Review；Human Review 未完成时只能标记“自动验证通过，待人工 Review”。

## Phase 1 — Engineering Baseline

**目标**: 在任何业务实现前建立可重复运行的 Node、lint、typecheck、Jest 与 CI 基线。

| Task ID | Description | Dependencies | Files / Area | Validation | 可并行 | Human Review |
|---|---|---|---|---|---|---|
| T001 | [X] 固定 Node 22.x：新增 `.nvmrc` 为 `22`，设置 `package.json#engines.node` 为 `>=22.13 <23`，保持 npm/package-lock 单一包管理器。 | 无 | `.nvmrc`, `package.json`, `package-lock.json` | Node 22.13+ 下 `npm ci` 成功；Node 24 不作为通过证据。 | 否 | 否 |
| T002 | [X] 配置 Expo SDK 57 兼容的 ESLint；增加 lint 配置并禁止 `app/`、`src/features/` 直接导入 `expo-sqlite` 或 `src/data` 内部 SQL 实现。 | T001 | `eslint.config.*`, `package.json` | `npm run lint` 能运行并对故意违规导入失败。 | 否 | 否 |
| T003 [P] | [X] 配置严格 TypeScript typecheck 脚本，保持 `strict`，不通过关闭检查或引入无理由 `any` 绕过错误。 | T001 | `tsconfig.json`, `package.json` | `npm run typecheck` 执行 `tsc --noEmit` 并成功；故意类型错误会失败。 | 是 | 否 |
| T004 [P] | [X] 安装并配置 Jest、`jest-expo` 与 React Native Testing Library，建立 `tests/` 测试目录和最小 smoke test；不得使用 `passWithNoTests`。 | T001 | `jest.config.*`, `tests/setup.*`, `tests/smoke.test.ts`, `package.json`, `package-lock.json` | 最小测试在 Node 22 下通过；空测试集会失败。 | 是 | 否 |
| T005 | [X] 增加基础 npm scripts：`lint`、`typecheck`、`test`、`test:ci`，其中 `test:ci` 固定 `jest --ci --runInBand`；保留现有 Expo scripts。 | T002, T003, T004 | `package.json` | 四个脚本均存在、退出码可传播，不含 `continue-on-error` 或吞错逻辑。 | 否 | 否 |
| T006 | [X] 配置 GitHub Actions quality gate：PR 与主分支 push 使用 Node 22，依次执行 `npm ci`、lint、typecheck、test:ci，并输出 Node 版本与 commit。 | T005 | `.github/workflows/quality.yml` | Workflow syntax 有效；四步任一失败会使 job 失败；未配置缓存为通过前提。 | 否 | 是 |
| T007 | [X] 记录工程基线使用说明与质量门禁命令，不声称尚未执行的原生/真机检查已通过。 | T005, T006 | `README.md` 或 `specs/001-trip-countdown-mvp/quickstart.md` 的实施补充 | 新 checkout 按说明可复现质量命令；文案区分自动检查与设备证据。 | 否 | 是 |
| T008 | [X] **Phase 1 Automated Validation**：在 Node 22 执行 `npm ci && npm run lint && npm run typecheck && npm run test:ci`。 | T001-T007 | 全仓库 | 记录 commit、Node/npm 版本、四条命令和退出码；全部成功才通过。 | 否 | 否 |
| T009 | [X] **Phase 1 Diff Review**：检查依赖锁定、scripts、lint 边界和 workflow，确认未改业务代码、未覆盖 `components/EditScreenInfo.tsx`。 | T008 | Phase 1 diff | 无意外依赖、脚本绕过、用户文件覆盖或业务实现。 | 否 | 是 |
| T010 | [X] **Phase 1 Constitution Check**：复核原则 I、IX、X、XI 与 Node 22/SDK57 约束。 | T009 | Constitution review record | 每项给出 PASS/不适用/修正任务；不得静默豁免。 | 否 | 是 |
| T011 | [X] **Phase 1 Human Review Checkpoint**：人工确认工程基线后才允许进入 Domain 实现。 | T010 | Review record | 记录批准、修改要求或拒绝；未审查不得开始 Phase 2 实现。 | 否 | 是（必须） |

## Phase 2 — Domain

**目标**: 先用纯 TypeScript 测试定义实体、校验、date-only、Countdown 与 progress，再实现逻辑。

| Task ID | Description | Dependencies | Files / Area | Validation | 可并行 | Human Review |
|---|---|---|---|---|---|---|
| T012 [P] | [X] 定义 Trip、TripSummary、TripDetail、ChecklistItem、Reminder、ReminderStatus、ReminderOffset 与输入/Result/错误类型；不包含 SQLite row 或原生类型。 | T011 | `src/domain/types.ts`, `tests/domain/types.test.ts` | Typecheck 验证边界类型；枚举仅含设计文档允许值。 | 是 | 否 |
| T013 [P] | [X] 先写 grapheme 计数与字段边界测试：组合重音、国旗、ZWJ emoji、空白、恰好/超过 80、100、500。 | T011 | `tests/domain/graphemes.test.ts`, `tests/domain/validation.test.ts` | 测试先失败；断言不使用 JS `length` 作为期望语义。 | 是 | 否 |
| T014 | [X] 实现 SDK57 Hermes 可用的 grapheme 计数边界；使用 `Intl.Segmenter`，若目标运行时不支持则停止并提出最小兼容方案 Review，不静默加依赖。 | T013 | `src/domain/graphemes.ts` | T013 通过；在开发构建任务中另验证 Hermes。 | 否 | 是（若需 fallback） |
| T015 | [X] 先写 Create/Edit validation 测试：trim Destination、保留 Notes 正文、字段错误、Create 拒绝过去日期、Create 允许今天、Edit 允许合法过去日期。 | T012, T014 | `tests/domain/trip-validation.test.ts` | 测试先失败；覆盖 FR-003–006 与 Create/Edit 分流。 | 否 | 否 |
| T016 | [X] 实现 Trip Create/Edit validation 与 Checklist title validation，返回字段化 validation error，非法输入不产生可写模型。 | T015 | `src/domain/validation.ts` | T015 与 Checklist 1/100 边界测试通过。 | 否 | 否 |
| T017 [P] | [X] 先写严格 date-only 解析测试：格式、真实公历日期、跨月/跨年、闰日、非闰日、年份四位与 0–99 年特例。 | T012 | `tests/domain/date-only.test.ts` | 测试先失败；非法日期如 2025-02-29、2026-13-01 被拒绝。 | 是 | 否 |
| T018 | [X] 实现 date-only 解析、round-trip 合法性校验、本地 today components 与 UTC day ordinal；禁止裸字符串 Date 解析和本地午夜毫秒差。 | T017 | `src/domain/date-only.ts` | T017 通过；代码检索无 `new Date('YYYY-MM-DD')` 型路径。 | 否 | 否 |
| T019 | [X] 先写 Countdown 测试矩阵：Today、未来、过去、跨月、跨年、闰日、午夜、DST、Asia/Shanghai、America/New_York、时区切换和非法日期。 | T018 | `tests/domain/countdown.test.ts`, `tests/domain/fixtures/*` | 测试先失败；时区样本用独立 TZ 进程执行且无 ±1 天。 | 否 | 否 |
| T020 | [X] 实现 Countdown 日历日差与中文显示模型：`还有 N 天`、`今天出发`、`旅行已结束`。 | T019 | `src/domain/countdown.ts` | T019 全矩阵通过；非法日期返回类型化错误。 | 否 | 否 |
| T021 [P] | [X] 先写并实现 Checklist progress 纯函数：total=0 不显示进度；否则精确聚合 completed/total 和中文文本。 | T012 | `tests/domain/checklist-progress.test.ts`, `src/domain/checklist-progress.ts` | 0、混合、全完成样本通过，不修改输入数组。 | 是 | 否 |
| T022 | [X] **Phase 2 Automated Validation**：执行 domain 测试、独立 TZ 测试、lint、typecheck。 | T012-T021 | Domain 与 tests | 所有纯逻辑测试通过；没有 SQLite/UI/Native 依赖。 | 否 | 否 |
| T023 | [X] **Phase 2 Diff Review**：检查测试确实先定义行为，确认未将业务规则放入 React/SQLite/Native。 | T022 | Phase 2 diff | FR-003–005、009–010、012、014 可追踪；无架构漂移。 | 否 | 是 |
| T024 | [X] **Phase 2 Constitution Check**：复核原则 I、IV、V、VI、X，确认纯逻辑边界符合设计。 | T023 | Constitution review record | 每项明确 PASS/不适用/修正任务；不得静默豁免。 | 否 | 是 |
| T024A | [X] **Phase 2 Human Review Checkpoint**：人工批准 Domain 类型、测试语义和实现后才进入存储实现。 | T024 | Review record | 记录人工结论；未批准不得进入 Phase 3。 | 否 | 是（必须） |

## Phase 3 — Storage / Repository

**目标**: 建立受保护存储初始化边界、SQLite schema/migration 和不泄露 SQL 的 Repository 契约。

| Task ID | Description | Dependencies | Files / Area | Validation | 可并行 | Human Review |
|---|---|---|---|---|---|---|
| T025 | [X] 定义 `preparePrivateStorage` TypeScript port、数据库初始化状态与类型化 storage/migration 错误；先用测试 adapter，不实现平台代码。 | T024A | `src/data/private-storage.ts`, `src/data/errors.ts`, `tests/data/private-storage-boundary.test.ts` | 初始化失败不调用 openDatabase，也不降级默认目录。 | 否 | 否 |
| T026 | [X] 写 schema v1 与 migration 契约测试：三表、索引、约束、FK cascade、`user_version` 0→1、重复初始化、高版本拒绝。 | T025 | `tests/data/migrations.test.ts`, `tests/data/fixtures/*` | 测试先失败；断言失败不删库重建。 | 否 | 否 |
| T027 | [X] 实现数据库连接与单飞初始化：先准备私有目录，再 open；每连接启用 `foreign_keys` 和 WAL；并发调用共享进行中 Promise。 | T026 | `src/data/database.ts` | 并发初始化只 open/migrate 一次；准备目录失败时零写入。 | 否 | 否 |
| T028 | [X] 实现 schema v1 与按序 `PRAGMA user_version` migration，在 exclusive transaction 成功后才更新版本；未来版本只读拒绝写入。 | T026, T027 | `src/data/migrations.ts`, `src/data/schema.ts` | v0→v1、重复迁移、回滚、未来版本测试通过。 | 否 | 否 |
| T029 | [X] 定义 Repository 公共模型映射与统一 validation/not-found/storage/unavailable Result；读回 row 必须验证类型、枚举与 date-only。 | T016, T018, T028 | `src/data/mappers.ts`, `src/data/repository-result.ts`, `tests/data/mappers.test.ts` | 损坏 row 返回 storage error，不被当作空数据；消息不泄露 SQL/路径/用户内容。 | 否 | 否 |
| T030 | [X] 先写 TripRepository 契约测试：list/get/create/update/delete、Create/Edit 校验、排序、Checklist 聚合、not-found、参数绑定。 | T029 | `tests/data/trip-repository.contract.test.ts` | 测试先失败；包含今天/未来升序、过去后置降序、同日 ID 稳定顺序。 | 否 | 否 |
| T031 | [X] 实现 TripRepository；聚合 Checklist 计数避免 N+1，UI 不可见 SQL/表名。 | T030 | `src/data/trip-repository.ts` | T030 通过；查询计划/spy 证明列表非逐 Trip 查询。 | 否 | 否 |
| T032 [P] | [X] 先写 ChecklistRepository 契约测试：add、setCompleted 显式目标值、remove、父 Trip 不存在、Trip 隔离、稳定顺序。 | T029 | `tests/data/checklist-repository.contract.test.ts` | 测试先失败；失败保持最后成功状态。 | 是 | 否 |
| T033 | [X] 实现 ChecklistRepository，写入串行、事务短小、参数绑定且不暴露 SQLite。 | T032 | `src/data/checklist-repository.ts` | T032 通过；不同 Trip 数据不串联。 | 否 | 否 |
| T034 [P] | [X] 先写 ReminderRepository 契约测试：offset 唯一、enabled/status/revision/notification_id、条件 revision 更新、cascade。 | T029 | `tests/data/reminder-repository.contract.test.ts` | 测试先失败；仅允许 1/7 和定义的 status。 | 是 | 否 |
| T035 | [X] 实现 ReminderRepository，只保存业务意图/调度观察状态，不请求权限、不调用 OS 通知。 | T034 | `src/data/reminder-repository.ts` | T034 通过；同 Trip/offset 不产生重复 row。 | 否 | 否 |
| T036 | [X] 实现写操作串行化、exclusive transaction helper 与有限错误映射；覆盖 busy/IO/full/corruption，禁止记录用户正文。 | T031, T033, T035 | `src/data/transactions.ts`, `src/data/error-mapping.ts`, `tests/data/transactions.test.ts` | 注入失败时回滚且原数据不丢；未知异常映射安全消息。 | 否 | 否 |
| T037 | [X] 建立实际 expo-sqlite 非发布设备契约入口：write/read、close/reopen、cascade、rollback、v0→v1、未来版本拒绝；不进入生产 route。 | T036 | `tests/device/sqlite-contract/*` | 开发构建可执行同一 Repository 契约；Jest mock 不作为通过证据。 | 否 | 是 |
| T038 | [X] **Phase 3 Automated Validation**：运行 data/domain 测试、lint、typecheck；记录实际 SQLite 契约为“待 development build”或真实结果。 | T025-T037 | Storage/Repository | JS 门禁全过；原生证据状态不得伪报。 | 否 | 否 |
| T039 | [X] **Phase 3 Diff Review**：核查 SQLite 单一 Source of Truth、无 ORM/AsyncStorage、无 UI SQL、migration 顺序与事务边界。 | T038 | Phase 3 diff | 所有 data-model 字段/约束/索引可追踪，无第二数据源。 | 否 | 是 |
| T040 | [X] **Phase 3 Constitution Check**：复核 II、III、IV、VI、VII、IX、X，记录设备证据尚未完成的准确状态。 | T039 | Constitution review record | 每项明确 PASS/不适用/修正任务，不把 mock 当持久化证据。 | 否 | 是 |
| T040A | [X] **Phase 3 Human Review Checkpoint**：人工批准 SQLite、migration、Repository 与错误边界。 | T040 | Review record | 记录人工结论；未批准不得进入 Core Trip UI。 | 否 | 是（必须） |

## Phase 4 — Core Trip UI

**目标**: 用 Expo Router Stack 交付 Trips、Create、Detail、Edit 的 P1 UI 与完整状态，不含 Checklist/Reminder 实现细节。

| Task ID | Description | Dependencies | Files / Area | Validation | 可并行 | Human Review |
|---|---|---|---|---|---|---|
| T041 | [X] 重构 Root Stack 与 bootstrap 注入，数据库未就绪显示中文 Loading/Error/Retry；routes 仅组合 feature，不含 SQL/业务校验。 | T040A | `app/_layout.tsx`, `src/features/bootstrap/*` | 初始化成功/失败/重试 RNTL 测试通过；失败不开放写入。 | 否 | 否 |
| T042 | [X] 删除 Expo tabs 示例业务路由和无关 modal 页面，保留且不覆盖用户修改的 `components/EditScreenInfo.tsx`；配置四个目标 Stack route。 | T041 | `app/(tabs)/*`, `app/modal.tsx`, `app/index.tsx`, `app/trips/**` | 路由树仅含 `/`、new、detail、edit 及必要 not-found；测试不在 app/。 | 否 | 是 |
| T043 [P] | [X] 实现可复用中文状态组件：Loading、Empty、Error、Retry、字段 Validation、busy/disabled；支持字体缩放与 44pt/48dp 触控目标。 | T040A | `src/components/AsyncState.tsx`, `src/components/FormField.tsx`, `tests/features/components.test.tsx` | RNTL 验证可访问名称/角色、错误可感知、长文本换行。 | 是 | 否 |
| T044 | [X] 先写 Trips 页面行为测试：loading、empty、error/retry、列表、排序、Countdown、completed、progress、有/无事项。 | T031, T020, T021, T043 | `tests/features/trips-screen.test.tsx` | 测试先失败；错误不显示假 Empty。 | 否 | 否 |
| T045 | [X] 实现 Trips 页面与聚焦/恢复前台/本地午夜重查重算；不使用固定 24 小时间隔。 | T044 | `app/index.tsx`, `src/features/trips/TripsScreen.tsx`, `src/features/trips/useTrips.ts` | T044 通过；跨午夜与恢复前台更新 Countdown。 | 否 | 否 |
| T046 | [X] 先写 Create Trip 页面测试：中文字段、Create 校验、保留输入、保存失败/重试、防重复提交、成功返回列表。 | T031, T016, T043 | `tests/features/create-trip-screen.test.tsx` | 测试先失败；过去日期阻止 Repository 调用。 | 否 | 否 |
| T047 | [X] 实现 Create Trip route 与表单；保存瞬间重读 local today，commit 成功后才导航。 | T046 | `app/trips/new.tsx`, `src/features/trips/TripForm.tsx`, `src/features/trips/CreateTripScreen.tsx` | T046 通过；快速双击只创建一条。 | 否 | 否 |
| T048 | [X] 先写 Trip Detail 基础测试：loading、not-found、error/retry、Trip/Notes/Countdown、Edit/Delete 入口。 | T031, T020, T043 | `tests/features/trip-detail-screen.test.tsx` | 测试先失败；无效 id 显示“旅行不存在”和返回入口。 | 否 | 否 |
| T049 | [X] 实现 Trip Detail 基础 route 与聚焦刷新；为 Checklist/Reminder 留现有契约区域但不增加占位产品功能。 | T048 | `app/trips/[id]/index.tsx`, `src/features/trips/TripDetailScreen.tsx` | T048 通过；无 SQL 导入。 | 否 | 否 |
| T050 | [X] 先写并实现 Edit Trip：允许合法过去日期，保存失败保留输入，成功返回详情并刷新持久化结果。 | T031, T016, T043, T049 | `tests/features/edit-trip-screen.test.tsx`, `app/trips/[id]/edit.tsx`, `src/features/trips/EditTripScreen.tsx` | Edit 过去日期成功；非法日期失败；防重复提交。 | 否 | 否 |
| T051 | [X] 实现 Trip 删除 UI 协调外壳与可替换 deletion port：二次确认、取消无写入、`isDeleting` 防重复、error/retry；使用 test adapter 验证成功与失败 UI 行为。本任务不接入 `expo-notifications`、真实 OS reminder cancellation 或最终 Repository delete 协调。 | T049 | `src/features/trips/useDeleteTrip.ts`, `src/features/trips/trip-deletion-port.ts`, `tests/features/delete-trip.test.tsx` | 取消保持数据；重复提交被阻止；test adapter 失败时显示删除未完成并可重试，成功时返回列表。 | 否 | 是 |
| T052 | [X] **Phase 4 Automated Validation**：运行 Trip UI/RNTL、domain/data、lint、typecheck。 | T041-T051 | Core Trip UI | 所有状态与 CRUD 自动测试通过。 | 否 | 否 |
| T053 | [X] **Phase 4 Diff Review**：核查四页面契约、简体中文、无 app/ 测试、无 UI SQL、无 tabs 残留。 | T052 | Phase 4 diff | FR-001–010、015、020–022、034–036 可追踪。 | 否 | 是 |
| T054 | [X] **Phase 4 Constitution Check**：复核 IV、VI、VII、VIII、X；记录未实现的 Checklist/Reminder 为后续依赖而非假完成。 | T053 | Review record | 无原则违规或隐式功能新增。 | 否 | 是 |
| T055 | [X] **Phase 4 Human Review Checkpoint**：人工走查 Create→List→Detail→Edit→Delete 交互和中文文案。 | T054 | Review record | 人工批准后进入 Checklist；修改意见形成任务或回退。 | 否 | 是（必须） |

## Phase 5 — Checklist

**目标**: 完成每个 Trip 隔离的 Checklist CRUD、Pending/Completed、progress 与失败恢复。

| Task ID | Description | Dependencies | Files / Area | Validation | 可并行 | Human Review |
|---|---|---|---|---|---|---|
| T056 | [X] 先写 Checklist feature 测试：空状态、add trim/validation、防重复、Trip 隔离、持久化重读。 | T055, T033, T016 | `tests/features/checklist-add.test.tsx` | 测试先失败；错误保留输入且不显示假成功。 | 否 | 否 |
| T057 | [X] 实现 Checklist 列表、空状态与 add 流程，写成功后从 Repository 重查。 | T056 | `src/features/checklist/ChecklistSection.tsx`, `src/features/checklist/useChecklist.ts` | T056 通过；另一 Trip 不变化。 | 否 | 否 |
| T058 | [X] 先写并实现 `setCompleted(itemId, completed)` UI：Pending↔Completed、checked 状态、保存中禁用、失败回滚最后成功状态。 | T057 | `tests/features/checklist-toggle.test.tsx`, `src/features/checklist/ChecklistItemRow.tsx` | RNTL 验证 checkbox role/name/checked/disabled 与中文非颜色表达。 | 否 | 否 |
| T059 | [X] 先写并实现 Checklist delete 与进度重算；一项删到零项恢复 Empty，不影响其他 Trip。 | T057, T058 | `tests/features/checklist-delete.test.tsx`, `src/features/checklist/ChecklistSection.tsx` | 删除失败保留 item/进度并可重试；成功重读持久化值。 | 否 | 否 |
| T060 | [X] 将 Checklist Section 接入 Trip Detail，并把 progress 聚合展示接入 Trips；验证 add/toggle/delete 后两页一致。 | T059, T045, T049 | `src/features/trips/TripDetailScreen.tsx`, `src/features/trips/TripsScreen.tsx`, `tests/features/checklist-integration.test.tsx` | `已完成 x / y` 仅 total>0 显示；聚合无 N+1。 | 否 | 否 |
| T061 | [X] 补充实际 SQLite Checklist persistence/reopen/cascade/Trip isolation 设备契约。 | T060, T037 | `tests/device/sqlite-contract/checklist.*` | close/reopen 后状态一致；删除 Trip 零 Checklist 残留。 | 否 | 是 |
| T062 | [X] **Phase 5 Automated Validation**：运行 Checklist、Trip 回归、lint、typecheck。 | T056-T061 | Checklist | 自动测试全过；设备项如未运行明确标 later development validation。 | 否 | 否 |
| T063 | [X] **Phase 5 Diff Review**：核查立即保存语义、错误恢复、progress、Trip 隔离、可访问 checkbox。 | T062 | Phase 5 diff | FR-011–014、018–022、029 可追踪。 | 否 | 是 |
| T064 | [X] **Phase 5 Constitution Check**：复核 II、IV、VI、VII、VIII、X。 | T063 | Review record | 记录 PASS/修正项，无虚假持久化成功。 | 否 | 是 |
| T065 | [X] **Phase 5 Human Review Checkpoint**：人工走查 Passport/Visa/Charger 场景及错误恢复。 | T064 | Review record | 人工批准后进入 Reminder。 | 否 | 是（必须） |

## Phase 6 — Reminder

**目标**: 按既有 Plan 实现 expo-notifications 本地提醒、权限、协调、一致性与 reconciliation，不引入 remote push/exact alarm。

| Task ID | Description | Dependencies | Files / Area | Validation | 可并行 | Human Review |
|---|---|---|---|---|---|---|
| T066 | [X] 安装 SDK57 兼容 `expo-notifications` 并定义 NotificationAdapter 类型：permission、schedule、cancel、listScheduled、delivered cleanup；不获取 push token。 | T065 | `package.json`, `package-lock.json`, `src/features/reminders/notification-adapter.ts` | 依赖版本与 SDK57 对齐；API 无 remote token 方法。 | 否 | 是 |
| T067 [P] | [X] 先写 Reminder calendar 测试：7/1 天、09:00、过去时刻、跨月/年/闰日、iOS CALENDAR components、Android 当前时区 DATE instant。 | T065, T018 | `tests/reminders/reminder-time.test.ts` | 测试先失败；过去时刻返回 unavailable，不补发。 | 是 | 否 |
| T068 | [X] 实现 Reminder 目标日期/时间纯逻辑与平台 trigger 候选，不推断 Destination 时区。 | T067 | `src/features/reminders/reminder-time.ts` | T067 通过；无城市/网络/位置逻辑。 | 否 | 否 |
| T069 | [X] 先写并实现权限流程：普通启动/浏览只查询不请求；主动 enable 才按需请求；denied/canAskAgain=false/撤销均为中文状态且 P1 可用。 | T066 | `tests/reminders/permission-flow.test.ts`, `src/features/reminders/permission.ts` | requestPermission 仅出现在明确 enable 路径。 | 否 | 否 |
| T070 | [X] 实现平台 adapter：固定中文无用户正文 payload、稳定 identifier、repeats=false、Android channel 与 best-effort；不得申请 exact alarm。 | T066, T068, T069 | `src/features/reminders/expo-notification-adapter.ts`, `tests/reminders/notification-adapter.test.ts` | mock 验证 payload/trigger/id；无 push token/exact alarm API。 | 否 | 否 |
| T071 | [X] 先写 ReminderCoordinator enable 测试：保存 pending/revision，取消旧 ID，再 schedule，再条件确认；失败为 error/unavailable/permission_denied 且可重试。 | T035, T070 | `tests/reminders/coordinator-enable.test.ts` | 测试先失败；OS 调用不在 DB transaction；旧 revision 不能覆盖新意图。 | 否 | 否 |
| T072 | [X] 实现按 Trip 串行的 enable/retry 协调流程与 revision/notification_id 防旧结果覆盖。 | T071 | `src/features/reminders/reminder-coordinator.ts` | T071 通过；同 Trip/offset 最多一个有效请求。 | 否 | 否 |
| T073 | [X] 先写并实现 disable：先保存 pending 意图、cancel 成功才确认 disabled；失败保留可重试状态，其他 offset/Trip 不受影响。 | T072 | `tests/reminders/coordinator-disable.test.ts`, `src/features/reminders/reminder-coordinator.ts` | cancel 失败不显示 disabled 成功。 | 否 | 否 |
| T074 | [X] 先写并实现 Departure Date 修改后的 reschedule：Trip commit 不回滚；保留 offset；新目标过去则取消旧请求并标 unavailable；已送达不重复。 | T072, T050 | `tests/reminders/reschedule.test.ts`, `src/features/reminders/reminder-coordinator.ts`, `src/features/trips/EditTripScreen.tsx` | 日期更新成功而调度失败时准确分离两种结果。 | 否 | 否 |
| T075 | [X] 先写并实现启动/前台 reconciliation：对照 SQLite 与 OS pending，修复 pending/孤儿/DB确认失败，Android 按当前时区重排 future，不补发过去提醒。 | T072 | `tests/reminders/reconciliation.test.ts`, `src/features/reminders/reconciliation.ts`, `src/features/bootstrap/*` | 重复运行幂等；时区变化无重复；旧 revision 不覆盖新状态。 | 否 | 否 |
| T076 | [X] 将 T051 deletion port 接入真实 Reminder cancellation 与 TripRepository delete：先取消 future scheduled reminders；失败时保留全部 SQLite Trip/Checklist/Reminder；成功后执行 Repository transaction delete 与 FK cascade。注入取消后/DB删除前崩溃并由 reconciliation 恢复所需调度或完成最终删除。 | T051, T075 | `tests/reminders/trip-delete-coordination.test.ts`, `src/features/trips/useDeleteTrip.ts`, `src/features/trips/trip-deletion-port.ts` | 取消失败绝不调用 Repository delete；崩溃窗口无重复通知；历史 delivered 不阻塞删除。 | 否 | 否 |
| T077 | [X] 实现 Trip Detail Reminder UI：7天/1天、permission denied、unavailable/error/retry、09:00说明、Android 已确认的时区/延迟限制；防重复操作。 | T073-T075, T049 | `src/features/reminders/ReminderSection.tsx`, `tests/features/reminder-section.test.tsx` | 全部自有文案简体中文；状态非仅颜色；普通渲染不弹权限。 | 否 | 否 |
| T078 | [X] **Phase 6 Automated Validation**：运行 reminder adapter/coordinator/reconciliation/UI 与全量 JS 门禁。 | T066-T077 | Reminder | 全部自动测试通过；真实通知仍标设备验证依赖。 | 否 | 否 |
| T079 | [X] **Phase 6 Diff Review**：核查无 remote push/token、无 exact alarm、无目的地时区、无用户正文通知、DB/OS 非事务边界正确。 | T078 | Phase 6 diff | FR-023–028b 可追踪；R1 限制未被扩大或掩盖。 | 否 | 是 |
| T080 | [X] **Phase 6 Constitution Check**：复核 II、III、IV、V、VI、VII、IX、X、XII。 | T079 | Review record | 明确 simulator/mock 不等于真机提醒证据。 | 否 | 是 |
| T081 | [X] **Phase 6 Human Review Checkpoint**：人工审查权限时机、平台差异文案、一致性/崩溃恢复设计。 | T080 | Review record | 批准后进入 Native/Backup；问题形成修正任务。 | 否 | 是（必须） |

## Phase 7 — Native Module / Backup Exclusion

**目标**: 用 Expo Local Module 与 CNG 可重现地准备受保护目录和备份排除；不承载业务或通知能力。

| Task ID | Description | Dependencies | Files / Area | Validation | 可并行 | Human Review |
|---|---|---|---|---|---|---|
| T082 | [X] 初始化 `modules/expo-trip-native` Local Module 与配置，暴露窄 TypeScript API `preparePrivateStorage(): Promise<{directory:string}>` 和类型化错误。 | T081 | `modules/expo-trip-native/expo-module.config.json`, `modules/expo-trip-native/src/*`, app module linking config | Typecheck 通过；接口不接收任意路径、不导入 `src/domain`。 | 否 | 是 |
| T083 [P] | [X] 实现 Android Kotlin `preparePrivateStorage`：固定 `noBackupFilesDir` 子目录、创建/校验、类型化失败；不实现 Trip/Checklist/Countdown/Notification。 | T082 | `modules/expo-trip-native/android/*` | Android 单元/开发构建验证返回 no-backup 路径；失败不降级。 | 是 | 否 |
| T084 [P] | [X] 实现 iOS Swift `preparePrivateStorage`：Application Support 专用目录；每次调用验证目录、DB 与已有 `-wal/-shm/-journal` 的 `isExcludedFromBackup`，设置后读回。 | T082 | `modules/expo-trip-native/ios/*` | 重复初始化与属性被移除后恢复测试；读回失败抛类型化错误。 | 是 | 否 |
| T085 | [X] 将真实 Local Module 接入 T025/T027 初始化边界，确保 backup exclusion 验证成功后才打开 DB。 | T083, T084, T027 | `src/data/private-storage.ts`, `src/data/database.ts` | 两平台失败注入均零 DB open；sidecar 与主库同一受保护路径。 | 否 | 否 |
| T086 | [X] 实现 Android CNG config plugin：`allowBackup=false`、旧版 `fullBackupContent`、Android 12+ `dataExtractionRules`，排除 cloud-backup/device-transfer 的 file/database/sharedpref 等适用域。 | T083 | `plugins/withBackupExclusion.*`, backup XML templates, `app.json` | plugin 测试验证 app config 与 XML；覆盖 expo-notifications SharedPreferences。 | 否 | 是 |
| T087 | [X] 增加 clean checkout CNG 验证脚本/说明：隔离目录两次 `expo prebuild --clean`，检查生成 manifest、backup rules、Local Module linking；不依赖手改 `android/ios`。 | T086, T085 | `scripts/verify-prebuild.*` 或 `tests/native-config/*`, quickstart 实施补充 | 两次生成结果等价；生成工程无手工 source-of-truth。 | 否 | 是 |
| T088 | [X] 检查 Android merged manifest/backup XML：allowBackup、fullBackupContent、dataExtractionRules、无 exact alarm 与无无关敏感权限。 | T087, T070 | `tests/native-config/android-*`, validation record | 实际 development build artifact 检查通过或明确记录待构建。 | 否 | 是 |
| T089 | [X] 检查 iOS Application Support 路径和每次初始化 backup resource values；确认 DB/WAL/SHM/journal 不位于 Caches/tmp 或默认未保护目录。 | T085 | `tests/device/backup-exclusion/ios-*`, validation record | development build 读回属性；模拟器结果不替代最终真机 restore。 | 否 | 是 |
| T091 | [X] **Phase 7 Automated Validation**：运行 JS 门禁、module typecheck/plugin tests、可用的 prebuild 检查。 | T082-T089 | Native/Backup | 自动项通过；需账户/真机项准确标记 later。 | 否 | 否 |
| T092 | [X] **Phase 7 Diff Review**：核查 Native Boundary、CNG 可重现、无业务重复、无手工原生补丁。 | T091 | Phase 7 diff | FR-017a 实现链可追踪；standalone publish 未进入范围。 | 否 | 是 |
| T093 | [X] **Phase 7 Constitution Check**：复核 III、V、IX、X、XII。 | T092 | Review record | 无静默 fallback 或备份保护假设。 | 否 | 是 |
| T094 | [X] **Phase 7 Human Review Checkpoint**：人工审查 Kotlin/Swift/plugin、生成 manifest 与备份边界。 | T093 | Review record | 批准后进入跨功能整合。 | 否 | 是（必须） |

## Phase 8 — Integration / Error / Accessibility

**目标**: 完成跨层失败恢复、离线、隐私与可访问性验收，消除功能间状态不一致。

| Task ID | Description | Dependencies | Files / Area | Validation | 可并行 | Human Review |
|---|---|---|---|---|---|---|
| T095 | 建立端到端 RNTL 集成测试：Trips/Create/Detail/Edit/Checklist/Reminder 的 Loading、Empty、Error、Validation、Retry 与防重复提交。 | T094 | `tests/features/app-flows.test.tsx`, shared test adapters | 所有异步分支有终态；无空白页、假 Empty、假成功。 | 否 | 否 |
| T096 | 实现统一安全错误呈现与重试连接，确保 SQL、路径、Trip/Notes/Checklist 内容不进入 UI/远程日志。 | T095 | `src/components/*`, `src/features/**/*` | 错误注入快照/文本检查只含安全中文消息。 | 否 | 否 |
| T097 [P] | 完成 accessibility 自动检查：全部 button/checkbox 的 name/role/checked/disabled，错误读屏可感知，完成/提醒状态不只靠颜色。 | T094 | `tests/accessibility/components.test.tsx`, UI components | RNTL accessibility queries 全过。 | 是 | 否 |
| T098 | 调整核心布局支持系统字体缩放、换行/滚动与触控尺寸；不设置阻止字体缩放属性。 | T097 | `src/components/*`, `src/features/**/*`, styles | 最大受支持字体设置下关键信息/操作无阻断；设备验证任务关联 T138/T139。 | 否 | 是 |
| T099 | 验证外接键盘焦点顺序与激活契约，补齐可测试的 focus/submit 行为，不新增桌面/Web 产品范围。 | T098 | UI components, `tests/accessibility/keyboard.test.tsx` | 创建、事项、编辑、删除可按契约完成；Web 仍非交付目标。 | 否 | 是 |
| T100 | 执行离线集成测试：禁网下 Trip CRUD、Countdown、Checklist；确认无后端、Analytics、业务上传或运行时网络前置。 | T095, T096 | Integration tests / validation record | SC-003 自动/模拟验证通过；真实 production 离线留 Phase 11。 | 否 | 是 |
| T101 | 审查隐私依赖与代码：不配置 Firebase project，不使用 Analytics/Crashlytics/Firestore/Auth/FCM Remote Push、不获取 push token；检查 expo-notifications 传递依赖并记录接受边界。 | T066, T088 | `package-lock.json`, dependency report, source scan | 仅允许已知 Firebase Messaging 传递依赖且无产品级配置/调用。 | 否 | 是 |
| T102 | **Phase 8 Automated Validation**：运行全量 lint/typecheck/test:ci、独立 TZ 测试和 privacy source scan。 | T095-T101 | 全仓库 JS/TS | 全部通过并记录；设备检查状态单列。 | 否 | 否 |
| T103 | **Phase 8 Diff Review**：对照 quickstart P1/P2 场景审查错误、离线、中文与 accessibility 覆盖。 | T102 | Phase 8 diff | FR-017、019–022、029–033、036 可追踪。 | 否 | 是 |
| T104 | **Phase 8 Constitution Check**：复核全部十二原则，确认集成状态与未完成设备证据准确。 | T103 | Constitution review record | 无未记录违反项；真机项明确未完成而非失败。 | 否 | 是 |
| T104A | **Phase 8 Human Review Checkpoint**：人工确认跨层错误、离线、隐私和 accessibility 行为后进入构建阶段。 | T104 | Review record | 记录人工结论；未批准不得进入 Phase 9。 | 否 | 是（必须） |

## Phase 9 — CI / Development Build / Preview

**目标**: 在不要求真机作为当前 blocker 的前提下，验证质量门禁、Local Module development build 与脱离 Metro 的 preview。

| Task ID | Description | Dependencies | Files / Area | Validation | 可并行 | Human Review |
|---|---|---|---|---|---|---|
| T105 | 安装 SDK57 兼容 `expo-dev-client`，保持生产依赖边界，不使用 Expo Go 作为 Local Module/backup 验收。 | T104A | `package.json`, `package-lock.json`, `app.json` | Expo doctor/依赖版本检查通过。 | 否 | 是 |
| T106 | 配置 `eas.json` development profile：`developmentClient=true`、`distribution=internal`，不加入秘密或自动提交。 | T105 | `eas.json` | EAS config 解析成功；profile 与 production 隔离。 | 否 | 是 |
| T107 [P] | 配置 preview profile，内嵌 JS 且不依赖 Metro；平台输出保持既有决策。 | T105 | `eas.json` | preview config 可解析且无 developmentClient。 | 是 | 是 |
| T108 | 在 Android emulator 构建/安装 development client，运行实际 SQLite 契约、Local Module、manifest/permissions/backup rule 检查。 | T106, T087, T037 | Development build evidence | 记录 emulator/OS/build/commit/结果；失败形成修正任务。 | 否 | 是 |
| T109 | 在 iOS simulator 构建/安装 development client，运行实际 SQLite 契约与 backup exclusion 属性检查。 | T106, T087, T037 | Development build evidence | 记录 simulator/OS/build/commit/结果；不冒充真机通知证据。 | 否 | 是 |
| T110 | 验证 Local Module、plugin 或 app config 变更后必须 rebuild；仅 JS/TS UI 变更可通过 Metro 刷新。 | T108, T109 | Developer workflow docs/evidence | 分别修改原生边界和 JS，验证 rebuild/refresh 行为符合说明。 | 否 | 是 |
| T111 | 构建并验证 preview：关闭 Metro、断网冷启动、读取/修改持久化数据，确认正式运行不依赖开发服务器。 | T107, T108, T109 | Preview build evidence | Android/iOS simulator 离线冷启动与核心流程通过。 | 否 | 是 |
| T112 | 在 GitHub Actions 实际执行 quality workflow 并将 lint/typecheck/test 设置为 required checks；记录 commit 与结果。 | T006, T102 | GitHub repository settings/evidence | PR/主分支运行成功；任一失败阻断合并。 | 否 | 是（外部设置） |
| T113 | 审查 production dependency graph、expo-notifications 传递依赖、merged manifest、permissions 与自动初始化；确认无 Firebase project/push token/Analytics。 | T108, T101 | Dependency/manifest reports | 报告含锁定版本和结论；无无关敏感权限/exact alarm。 | 否 | 是 |
| T114 | **Phase 9 Automated Validation**：重跑 CI 四门禁、Expo config/prebuild checks、development/preview 可自动化检查。 | T105-T113 | Build/CI | 全部可执行项通过；外部账户或真机项明确状态。 | 否 | 否 |
| T115 | **Phase 9 Diff Review**：核查 EAS profiles、dev-client、CNG 和证据记录，无秘密、无自动发布。 | T114 | Phase 9 diff | development/preview/production 边界清晰。 | 否 | 是 |
| T116 | **Phase 9 Constitution Check**：复核 II、III、V、XI、XII；确认模拟器阶段不被真机缺失阻塞。 | T115 | Review record | 真机项标 later/manual gate，不标实现失败。 | 否 | 是 |
| T117 | **Phase 9 Human Review Checkpoint**：人工批准 CI、Android emulator、iOS simulator 与 preview 离线证据。 | T116 | Review record | 批准后进入 release preparation。 | 否 | 是（必须） |

## Phase 10 — Release Preparation

**目标**: 准备 Android APK 与 iOS IPA 的人工发布材料；不自动提交商店。

| Task ID | Description | Dependencies | Files / Area | Validation | 可并行 | Human Review |
|---|---|---|---|---|---|---|
| T118 | 配置 EAS production 公共设置：不含 developmentClient/EAS Update/auto-submit，版本与 build number 可追踪，秘密不入 Git。 | T117 | `eas.json`, `app.json`, release docs | EAS config 解析通过；版本/build/commit 对应明确。 | 否 | 是 |
| T119 | 配置 Android production 为签名 Release APK（非默认 AAB），记录签名由 EAS/人工安全管理。 | T118 | `eas.json`, Android release checklist | buildType=apk；仓库无 keystore/secret。 | 否 | 是 |
| T120 | 生成 Android production APK 并检查签名、版本、merged manifest、permissions、backup rules、dependency graph。 | T119, T113 | EAS build evidence / artifact report | 构建 ID、commit、hash、签名与检查结果齐全；不申请 exact/unrelated 权限。 | 否 | 是（必须） |
| T121 | 编写华为应用市场上传前 checklist：当前有效要求、隐私说明、不备份后果、Android best-effort reminder 限制、截图/材料、人工批准；不执行上传。 | T120 | `docs/release/huawei-checklist.md` | checklist 无“已满足商店审核”无证据断言。 | 否 | 是（必须） |
| T122 | 配置 iOS production 为 store、非 simulator IPA，设置可追踪 build number 与人工签名流程。 | T118 | `eas.json`, `app.json`, iOS release checklist | production IPA profile 与 development/preview 隔离。 | 是 | 是 |
| T123 | 生成 iOS production IPA/TestFlight 候选并检查签名、版本、entitlements、权限与 privacy 信息。 | T122, T113 | EAS build evidence / artifact report | 构建 ID、commit、hash、签名/entitlement 检查齐全。 | 否 | 是（必须） |
| T124 | 编写 App Store Connect metadata 与中国大陆发行 checklist：privacy information、数据不备份、通知、截图/描述、当时有效要求；不执行自动提交。 | T123 | `docs/release/app-store-checklist.md` | 明确中国大陆发行人工检查和首次发布 Human Review。 | 否 | 是（必须） |
| T125 | 规划 production build 实际网络行为检查：冷启动/核心 CRUD/Reminder 场景无业务上传、跟踪或未声明自动初始化；执行留到有待发包的验收。 | T120, T123 | `docs/release/network-validation.md` | 方法、设备、抓包范围和通过标准明确，不虚构结果。 | 是 | 是 |
| T126 | **Phase 10 Automated Validation**：对 release config/artifact 可自动检查项运行 lint/typecheck/test、config、manifest/permissions/dependency scan。 | T118-T125 | Release preparation | 可自动项全过；商店与真机项仍为人工 gate。 | 否 | 否 |
| T127 | **Phase 10 Diff Review**：核查版本、签名边界、隐私材料、无 auto-submit、无秘密。 | T126 | Phase 10 diff | Android APK/iOS IPA 决策未改变。 | 否 | 是 |
| T128 | **Phase 10 Constitution Check**：复核 III、X、XI、XII 和当时有效商店要求检查义务。 | T127 | Review record | 未完成真机 Release Gate 时不得批准发布。 | 否 | 是 |
| T129 | **Phase 10 Human Review Checkpoint**：人工审查两个待发构建与清单；仅批准进入真机 Gate，不提交商店。 | T128 | Review record | 记录批准/拒绝、已知问题和构建标识。 | 否 | 是（必须） |

## Phase 11 — Manual Release Gates

**目标**: 在实现后期用真实 production 构建完成真机与人工发布 Gate；无真机时状态为 `later/manual gate`，不阻塞 Phase 1–9 的模拟器开发结论。

| Task ID | Description | Dependencies | Files / Area | Validation | 可并行 | Human Review |
|---|---|---|---|---|---|---|
| T130 | **Release Gate — Android 真机（华为优先）**：使用 T120 APK 验证离线 CRUD、杀进程/重启20次、Checklist 隔离、系统字体、TalkBack/键盘、production 冷启动。无设备则标 `later/manual gate`。 | T129 | Device evidence | 记录华为型号/OS/build/commit/20次结果；缺设备不标产品失败。 | 是 | 是（必须） |
| T131 | **Release Gate — Android Reminder/Privacy**：验证主动授权/拒绝/撤销、7/1天、09:00、后台/重启/时区恢复重排、best-effort、无 exact alarm、backup/restore 与实际网络行为。 | T130 | Device/privacy evidence | 无重复/补发；restore 不带回业务记录；无业务上传。 | 否 | 是（必须） |
| T132 | **Release Gate — iPhone 真机**：使用 T123 production/TestFlight 构建验证离线 CRUD、杀进程/重启20次、VoiceOver/键盘/字体缩放、通知09:00/权限/后台、backup/restore 与网络行为。无设备则标 `later/manual gate`。 | T129 | Device evidence | 记录设备/OS/build/commit；目录属性与实际 restore 均验证。 | 是 | 是（必须） |
| T133 | **Release Gate — Cross-platform acceptance**：执行 quickstart 全部 P1/P2 场景和 SC-001–SC-010，比较 Android/iOS 结果；记录已知平台限制。 | T131, T132 | Acceptance matrix | 每项 PASS/FAIL/BLOCKED/later 有证据，SC-005 两端一致。 | 否 | 是（必须） |
| T134 | **Release Gate — Store readiness**：按当时有效华为应用市场、中国大陆 App Store 要求复核 metadata、privacy、权限、签名、版本/build number；不得自动上传。 | T133 | Store checklists | 人工签字；要求变化形成新任务。 | 否 | 是（必须） |
| T135 | **Phase 11 Automated Validation**：针对最终 release commit 重跑 CI、artifact/config/permission/dependency scans，并关联真机记录。 | T133, T134 | Final validation record | 所有自动门禁通过；失败不得发布。 | 否 | 否 |
| T136 | **Phase 11 Diff Review**：对最终 release diff、构建标识、已知问题、证据完整性进行审查。 | T135 | Final diff review | 无未审查代码/配置漂移；构建来自已审查 commit。 | 否 | 是 |
| T137 | **Phase 11 Constitution Check**：逐项复核十二原则，尤其 Offline First、Privacy Minimal、Accessibility、Release Safety。 | T136 | Final constitution record | 全部 PASS 或停止发布；不得用豁免口头放行。 | 否 | 是 |
| T138 | **Final Human Release Review**：首次发布保留人工决策；确认两个商店提交材料、真机证据与已知问题后才允许人工提交。 | T137 | Release approval record | 明确批准/拒绝与负责人；不执行 auto-submit。 | 否 | 是（必须） |
| T139 | **Manual Store Submission（仅获批后）**：由授权人员人工上传华为应用市场和 App Store Connect，并记录提交版本与结果；本任务不是当前自动执行项。 | T138 | External store records | 提交记录关联 T120/T123 构建；无批准不得执行。 | 否 | 是（必须） |

## Dependencies & Execution Order

### Phase dependency chain

`Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7 → Phase 8 → Phase 9 → Phase 10 → Phase 11`

- Phase 1 是所有实现的硬前置：lint/typecheck/test 未能运行前不得开始业务实现。
- Phase 2 纯逻辑先于 SQLite/UI；Phase 3 Repository 先于页面。
- Phase 4 提供 Trip/路由骨架；Phase 5 Checklist、Phase 6 Reminder 在其上独立增量接入。
- Phase 7 将存储边界替换为真实 Local Module/CNG；Phase 8 做跨层收口。
- Phase 9 的模拟器/development/preview 验证不被缺少真机阻塞。
- Phase 10 只准备待发构建和人工清单；Phase 11 才是真机与商店 Release Gate。

### Critical task chains

- **Trip**: T012 → T015 → T016 → T030 → T031 → T044–T051。
- **Countdown**: T017 → T018 → T019 → T020 → T044/T048 → T045/T049。
- **Checklist**: T021 → T032 → T033 → T056–T061。
- **Reminder**: T034 → T035 → T066–T077 → T088/T113 → T131/T132。
- **Private storage/backup**: T025 → T027 → T082–T089 → T108/T109 → T131/T132。
- **Release**: T117 → T118 → T120/T123 → T129 → T130/T132 → T133–T139。

## Parallel Opportunities

满足各自 Dependencies 后可并行的主要任务组：

- T003 与 T004。
- T012、T013、T017；T021 可在 T012 后独立进行。
- T032 与 T034；对应实现 T033/T035 在各自测试后互不修改同一文件。
- T043 可与早期路由准备并行；各页面测试需按依赖串行接入。
- T067 可与 T066 的 adapter 类型定义并行起步。
- T083 与 T084；Android/iOS 原生实现分属不同目录。
- T097 与 T095/T096 的非 accessibility 文件工作可并行。
- T107 与 T106；T108 与 T109；Android/iOS development 验证可并行。
- T122–T124 的 iOS release preparation 可在 T119–T121 Android 工作旁并行。
- T130/T131 Android 与 T132 iPhone Gate 可在设备和已批准构建可用时并行；T133 等待两端结果。

## Requirements / Success Criteria Traceability

| Requirement | Primary tasks |
|---|---|
| FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-015, FR-016, FR-034, FR-035, FR-036 | T012, T015–T016, T030–T031, T041–T051, T076 |
| FR-009, FR-010 | T017–T020, T044–T045, T048–T049 |
| FR-011, FR-012, FR-013, FR-014 | T021, T032–T033, T056–T061 |
| FR-017, FR-017a, FR-018, FR-019 | T025–T028, T037, T082–T089, T091–T101, T108–T111 |
| FR-020, FR-021, FR-022 | T041, T043–T051, T056–T060, T095–T096 |
| FR-023, FR-024, FR-025, FR-026, FR-027, FR-028, FR-028a, FR-028b | T034–T035, T066–T077, T101, T113, T131–T133 |
| FR-029, FR-030, FR-031 | T043, T058, T077, T097–T099, T130, T132 |
| FR-032, FR-033 | T066, T070, T086–T088, T100–T101, T113, T120, T123 |
| SC-001 | T046–T047, T055, T133 |
| SC-002 | T017–T020, T045, T133 |
| SC-003 | T100, T111, T130, T132–T133 |
| SC-004 | T037, T061, T130, T132–T133 |
| SC-005 | T108–T111, T130–T133 |
| SC-006 | T036–T037, T051, T061, T076, T133 |
| SC-007 | T069, T077, T131–T133 |
| SC-008 | T097–T099, T130, T132–T133 |
| SC-009 | T086–T089, T101, T113, T120, T123, T131–T134 |
| SC-010 | T043, T046–T051, T056–T060, T077, T095–T096, T133 |

## Out of Scope / Later Engineering Milestone

- 将 `modules/expo-trip-native` 抽离为 standalone Expo Module 或发布 npm package；当前只保留模块边界和未来可抽离性，不创建实现/发布任务。
- 自动商店提交、EAS Update、后端、账号、云同步、Analytics、remote push、目的地时区、exact alarm、数据导出/云恢复。
- 真机缺失不会阻塞 Phase 1–9；T130–T139 保持 `later/manual gate`，直到设备、账号、签名和人工批准可用。
