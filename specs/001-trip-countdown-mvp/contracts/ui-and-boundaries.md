# UI and Boundary Contracts

日期：2026-10-06。仅本地应用契约，无 HTTP API；Reminder 时区契约已按2026-10-06用户确认同步，见 FR-028a。

## Navigation and UI

| Route | 页面契约 |
|---|---|
| / | “旅行”；列表展示目的地、出发日期、倒计时与有事项时的“已完成 3 / 5”；无旅行显示“还没有旅行”及“创建旅行” |
| /trips/new | “创建旅行”；“目的地”“出发日期”“备注”“保存”；成功返回列表，失败保留输入和重试 |
| /trips/[id] | “旅行详情”；信息/备注/Checklist；“添加事项”、checkbox 完成/恢复、删除事项；提醒选项、“编辑旅行”“删除旅行” |
| /trips/[id]/edit | “编辑旅行”；字段与创建页相同，但合法的 YYYY-MM-DD 过去日期允许保存；成功回详情，刷新持久化结果 |

路由仅组合 feature 组件，不包含 SQL/业务校验。删除二次确认含“取消”“删除”；成功回列表，失败保留数据和“重试”。不存在/无效 id 显示“旅行不存在”和返回入口，不崩溃。

所有异步读取先呈现“正在加载”，读取失败“读取失败，请重试”与重试入口；零数据才是 Empty。空 Checklist 显示“还没有准备事项”与添加入口。保存失败“保存未成功，请重试”；提交期间按钮 disabled/busy，输入保留。Checklist 状态使用 checkbox checked 与非颜色表达，不先显示可靠保存。

Reminder：“出发前7天”“出发前1天”，说明设备本地09:00；拒绝显示“通知权限未开启，提醒未启用”；过去时间/调度失败/重排失败各有准确反馈。Android 说明：“按设置时的设备时区，在提醒日期上午9:00安排。打开或返回应用后更新时区；应用关闭期间切换时区可能影响提醒时间，实际送达可能延迟。”iOS 保留按当前本地时区上午9:00的说明。系统权限弹框由 OS 控制语言；应用自有说明、通知内容、可访问名称全部简体中文，用户正文不翻译。

按钮至少采用 iOS 44pt/Android 48dp 的可操作目标；不设置阻止系统字体缩放的属性，布局可换行/滚动。checkbox/button 使用正确 role/name/checked/disabled，错误文字读屏可感知。顺序遵循视觉流程，外接键盘验证焦点与激活；VoiceOver/TalkBack 验证创建→事项→编辑→删除全流程。

## Repository Contract

以下为接口设计而非实现源码。

| Boundary | 操作与结果 |
|---|---|
| TripRepository | list(today)→TripSummary[]；get(id)→TripDetail或not-found；create(input,localToday)→Trip，拒绝过去日期；update(id,input)→Trip，允许合法过去日期；delete(id)→在 SQLite transaction 中删除并由 FK cascade 清理从属数据 |
| ChecklistRepository | add(tripId,title)→Item；setCompleted(itemId,completed)→Item；remove(itemId)→确认结果；不存在的父 Trip 拒绝写入 |
| ReminderRepository | 查询选择、保存意图/revision、条件更新调度结果；不请求系统权限 |
| NotificationAdapter | getPermission/requestPermission、schedule、cancel、listScheduled、清理delivered；系统错误转换为有限类型，不泄漏用户数据 |
| ReminderCoordinator | enable/disable/reconcile/reschedule/cancelForTrip；只在明确用户动作中调用requestPermission |
| Native storage | preparePrivateStorage→受保护目录；调用在数据库初始化边界；无业务参数/敏感权限 |

统一 Result 成功或类型化错误，错误种类 validation/not-found/storage/permission-denied/unavailable/scheduling，字段错误只对应允许字段。未知原生异常映射为安全通用消息，不把 SQL、路径、Trip/Notes 内容输出到界面或远程日志。写入确认须来自 commit；不向 UI 暴露“已保存”后再异步持久化。

## Trip Deletion Contract

删除不持久化 Trip lifecycle 状态。用户确认后，页面用短生命周期 `isDeleting` 阻止重复操作，并调用 ReminderCoordinator 取消该 Trip 尚未触发的 scheduled reminders。取消失败时不得调用 TripRepository.delete：SQLite 中的 Trip、Checklist 与 Reminder 保持不变，界面显示“删除未完成”并允许重试。

取消成功后，TripRepository.delete 在一个 SQLite transaction 中删除 Trip，Checklist 与 Reminder 记录由 foreign-key cascade 删除。不需要取消或清理已经显示在系统 Notification Center 的历史通知，也不以历史通知清理结果阻塞 Trip 删除。

如果 future 通知已取消、进程却在数据库删除前崩溃，下次启动 reconciliation 根据仍存在的 Reminder desired state、status、revision 与 notification_id 恢复仍需安排的 future reminders；已过去的目标不补发。Reminder 自身的一致性字段保留，Trip 不增加 `deleting` 或等价的持久化状态。

## Local Notification Contract

同一 Trip/offset 最多一个有效请求，identifier 稳定，repeats=false。payload 不含目的地/备注/Checklist，使用固定中文提示与不透明标识；不注册 remote token。改日期不新增选择，只保留原offset并重排。关闭和删除取消对应请求，其他Trip不受影响。平台容量不足、权限撤销或已过时刻返回不可用而不是成功。

Android 使用无 exact 权限的 best-effort，按调度时本地时区09:00安排；启动/恢复前台按当前时区重排尚未触发的提醒。关闭期间不保证自动跟随时区；新目标已过去则取消旧安排、不补发并显示不可用，已送达提醒不重复安排。此限制已由用户接受并写入 FR-028a。
