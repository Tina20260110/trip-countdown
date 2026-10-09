# Trip Countdown Codex Guide

本文件规定 Codex 在本仓库中的稳定工作方式。产品需求、技术设计和阶段任务以
`.specify/` 与 `specs/001-trip-countdown-mvp/` 中的批准文档为准，不在此重复。

## 开始工作前

- 先阅读本文件以及与当前任务直接相关的项目文档和现有实现。
- 编写 Expo 或 React Native 代码前，阅读准确的
  [Expo SDK 57 文档](https://docs.expo.dev/versions/v57.0.0/)，不得用其他版本推断 API。
- 检查 `git status` 和相关 diff；保留用户已有、未提交及与本批无关的修改。
- 使用 Node 22（最低 22.13）和 npm；以 `.nvmrc`、`package.json`、
  `package-lock.json` 为工具链依据。

## SDD 文档职责

- `.specify/memory/constitution.md` 管不可绕过的工程原则、质量门禁和治理规则。
- `spec.md` 管产品需求、用户可见行为、边界条件和成功标准。
- `plan.md` 及其设计附件管已批准的技术方案、模块边界和取舍。
- `tasks.md` 管实现顺序、依赖、验证要求和 Human Review checkpoint。
- Contracts 定义跨层接口和可观察行为；Review 文档记录阶段证据与人工结论。
- 发现文档冲突时，停止受影响的实现并报告；不得自行改写已批准的决策。
- 需求或设计发生变化时，先同步相应 SDD 文档，再按批准后的 Tasks 实现。

## 任务范围与执行

- 只执行用户明确指定的 Task ID，并先确认其依赖和前置 Review 已满足。
- 按 `tasks.md` 的顺序、文件范围和 Validation 工作，不提前实现下一批能力。
- 未经用户要求，不扩大产品范围、技术栈、依赖或抽象层。
- 任务要求测试先行时，先添加行为测试并确认其按预期失败，再实现最小改动。
- 优先复用现有 Domain、Contracts、Repository、Adapters 和公共组件。
- 修复缺陷时补充能复现用户行为或边界错误的回归测试。
- 不为未来假设创建 Service、UseCase、DAO、状态库或其他无当前收益的层。

## 架构与数据边界

- 保持 `Expo Router → Feature → Contract/Repository → Data/SQLite` 的依赖方向。
- `app/` 只组合路由；UI 和 Feature 不直接导入 SQLite、SQL 或 data implementation。
- Domain 保持纯 TypeScript，不依赖 React、Expo、SQLite 或原生平台代码。
- SQLite 是业务数据的唯一 Source of Truth；不得引入 AsyncStorage、ORM、
  全局状态库或内存业务副本作为第二套长期数据源。
- React local state 仅保存页面短生命周期 UI 状态；持久化结果须由 Repository 确认。
- Kotlin/Swift 只承担 Plan 已批准的平台能力，不重复实现共享业务规则。
- OS API 不进入 SQLite transaction；跨系统结果必须保留类型化、可恢复状态。

## 隐私、存储与错误

- 保持离线优先、无后端、无业务数据上传、无跟踪及最小权限原则。
- 不绕过 Private Storage、backup exclusion、migration、revision 或 reconciliation 边界。
- 不添加默认目录、内存数据库或其他静默 fallback 来掩盖生产能力缺失。
- Notification 权限只可由用户明确启用 Reminder 的动作触发。
- 错误必须安全且可恢复；不得泄露 SQL、文件路径或用户正文，也不得显示假成功。
- 新依赖须必要、兼容 Expo SDK 57，并检查权限、网络和数据收集影响。

## 类型、测试与可访问性

- 保持 TypeScript `strict`；不得通过关闭规则、无理由 `any`、删测试或吞退出码过关。
- 测试用户可观察行为和公共契约，避免以 snapshot 或实现细节作为主要证据。
- Loading、Empty、Error、Validation、Busy、Permission Denied 等状态须明确区分。
- 异步写入要防重复提交；失败保留最后成功状态或可恢复输入。
- 用户可见自有文案使用简体中文；按钮、输入、checkbox 和错误具备可访问语义。
- 自动测试可检查角色、名称与状态，但不能替代字体缩放、键盘或读屏真机验收。

## 验证与证据

- 每批代码完成后运行：`npm run lint`、`npm run typecheck`、
  `npm run test:ci`、`git diff --check`。
- 任一要求的检查失败或未执行时，不得将相关 Task 标记完成。
- 不得通过降低 lint、类型或测试要求来消除失败；先定位并修复本批引入的问题。
- Jest/Mock 只证明 TypeScript 契约与行为；不得表述为真实 SQLite、原生或通知证据。
- 模拟器证据与真机证据分开记录；Expo Go 不替代 Development Build 或原生验证。
- 离线重启、系统备份、真实通知、时区、VoiceOver/TalkBack、字体缩放等仅在
  对应设备实际执行后才能记为 PASS。

## Review、Git 与报告

- Automated Validation、Diff Review 和 Constitution Check 不替代 Human Review。
- Human Review 必须由用户明确批准；Codex 不得自行执行、批准或标记 checkpoint。
- 只有实际完成且验证通过的 Task 才能标记 `[X]`，并保留后续门禁为未完成状态。
- 不主动执行 `git commit`、发布、提交商店或其他不可逆外部动作。
- 不覆盖、格式化、删除或恢复与当前 Task 无关的用户修改。
- 每批报告保持简洁：完成的 Task、文件与依赖变化、验证结果、Review findings、
  未解决问题，以及下一阶段所需依赖或设备门禁。
- 报告要准确区分已实现、自动验证通过、待人工 Review 和待设备验证。
