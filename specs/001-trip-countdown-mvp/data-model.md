# Data Model: Trip Countdown MVP

日期：2026-10-06。本文件定义设计契约，不是可执行 migration。Reminder 时区约定见 FR-028a 和 research.md R1：Android 调度时使用本地时区，启动/前台恢复重排，关闭期间不保证跟随。

## Entities and Schema v1

| 表 | 字段与约束 |
|---|---|
| trips | id INTEGER PRIMARY KEY AUTOINCREMENT；destination TEXT NOT NULL；departure_date TEXT NOT NULL；notes TEXT NOT NULL DEFAULT ''；created_at INTEGER NOT NULL；updated_at INTEGER NOT NULL |
| checklist_items | id INTEGER PRIMARY KEY AUTOINCREMENT；trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE；title TEXT NOT NULL；completed INTEGER NOT NULL DEFAULT 0 CHECK IN (0,1)；created_at INTEGER NOT NULL |
| reminders | trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE；offset_days INTEGER NOT NULL CHECK IN (1,7)；PRIMARY KEY(trip_id,offset_days)；enabled INTEGER NOT NULL CHECK IN (0,1)；status TEXT NOT NULL；revision INTEGER NOT NULL；notification_id TEXT NOT NULL UNIQUE；target_date TEXT NULL；scheduled_at INTEGER NULL；scheduled_timezone TEXT NULL；error_code TEXT NULL |

主键作为稳定排序兜底，不复用已删除 ID。created_at/updated_at 为技术时间戳，不参与 Countdown。target_date 是技术派生的提醒日历日期；scheduled_at 是已提交 OS 调度的 instant（允许提醒技术状态使用时间戳），不是 Departure Date。scheduled_timezone 仅用于诊断/重排判断，不是目的地时区。

索引：trips(departure_date,id)、checklist_items(trip_id,id)；reminders 复合主键支持从属查询。外键每连接启用。title/destination 数据库约束非空，真正的 trim/grapheme/date 校验在 domain 和 Repository 入口执行；SQLite length 不能实现用户可见字符上限。

## Validation

- destination trim 后必填，1–80 grapheme clusters；title 同样 trim，1–100。
- notes 可空、不擅自 trim 用户正文，最多500 grapheme clusters。
- departure_date 始终必须是严格 YYYY-MM-DD 和真实公历日期。Create Trip 保存时不得早于设备当前本地日期；Edit existing Trip 允许保存合法的过去日期，因此自然过期 Trip 仍可编辑 Destination、Notes 或修正日期。不新增 Archive 状态或功能。
- 日期四位年份与实际 calendar components round-trip 校验；不以 UTC timestamp 代替 date-only。
- 输入无效返回字段错误，不执行写入；read 结果也验证类型/枚举/日期，损坏返回 storage 错误，不当作空数据。

## Queries and Derived Values

Trips 查询聚合 checklist 总数与完成数，无逐 Trip N+1 查询。今天/未来在前，日期升序、id升序；过去在后，日期降序、id升序，始终可见。同日依创建 ID 排序。查询 today 参数由本地日历计算传入，不用 SQLite UTC date('now')。

Checklist 依 id 升序，completed 不改变顺序。progress={completed,total}，total=0不显示进度；Countdown 根据当前本地日期计算，二者不入表。

## Transitions and Consistency

Trip 不持久化 lifecycle/deleting 状态。取消确认不发生写入；确认后页面使用短生命周期 `isDeleting` 防止重复操作，先取消该 Trip 的 future scheduled reminders。取消失败时 SQLite 数据保持不变并允许重试；取消成功后在一个 SQLite transaction 中删除 Trip，由 FK cascade 删除 checklist/reminders。不为 Notification Center 已展示的历史通知阻塞删除。

Checklist：Pending ↔ Completed，直接提交目标值，写入成功才确认；新增/删除/更新在事务失败时保持上次状态。

Reminder status 限定 disabled/pending/scheduled/permission_denied/unavailable/error。首次拒绝权限时 enabled=0；已选择提醒被撤销时可保留 enabled=1 的意图，但 status=permission_denied，不显示有效启用。未来时间安排成功为 scheduled；到期且不在 OS 队列中不自动补发，以目标日期/当前时间决定 unavailable。status 是上次观察结果，不能推断实际送达。

启用/改日期增加 revision，设置 pending；稳定 notification_id 由安装内 Trip ID+offset 形成（例如 trip-42-before-7）。先取消同一 ID 再安排，防止重复；OS成功/DB确认失败可用 ID 枚举恢复。按 Trip 串行协调，旧 revision 的结果不得覆盖新意图。关闭时 enabled=0、pending，取消确认后 disabled。若删除流程已取消 future 通知但在 DB transaction 前崩溃，启动 reconciliation 依据仍存在的 Reminder desired state/status/revision/notification_id 重新调度仍有效的 future reminder；已过去目标不补发。删除成功后不留业务 tombstone。

## Migration and Failures

PRAGMA user_version=0→1 创建表/索引；逐版本迁移均事务执行，最后更新版本。新安装与已有数据库走同一初始化路径。启动完成前不开放写入；并发初始化共享一个进行中的 Promise，不产生多个 migration。写操作串行且短事务，busy/IO/full/corruption 返回可重试错误，不自动删除数据库。高版本数据库拒绝降级写入。WAL/SHM/journal 必须与主库处于排除备份路径。

实际设备测试覆盖写入后关连接重开、杀进程20次、cascade、失败回滚、重复迁移、未来版本拒绝和文件损坏。Jest 存储 mock 只能覆盖调用方行为。
