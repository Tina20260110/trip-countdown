# Feature Specification: Trip Countdown MVP

**Feature Branch**: `未由扩展钩子创建`

**Created**: 2026-09-21

**Status**: Draft

**Input**: User description: "创建一个简单、离线优先的旅行倒计时与出发准备工具，支持 Trip、Checklist、本地持久化与可选本地 Reminder。"

## Clarifications

### Session 2026-10-06

- Q: Android 是否接受调度时按设备本地时区计算上午 9:00，启动或恢复前台后按新时区重排，关闭期间切换时区不保证自动跟随？ → A: 接受该 v1.0 限制。此约定取代先前对 Android 触发时自动跟随当前时区的要求；iOS 约定不变。
- Q: 自然过期的 Trip 是否允许在 Edit 时保存合法的过去 Departure Date？ → A: 允许。Create Trip 仍不得保存早于设备当前本地日期的 Departure Date；Edit existing Trip 只要求日期是合法的 YYYY-MM-DD 公历日期。

### Session 2026-09-21

- Q: 出发前 7 天或 1 天的 Reminder 应在目标日期的什么时间触发？ → A: 按用户设备当前本地时区，在对应提醒日期上午 9:00 触发。
- Q: Trip、Notes 和 Checklist 数据是否应排除在操作系统的云备份之外？ → A: 排除所有系统云备份。
- Q: v1.0 的用户界面应使用哪种语言？ → A: 仅简体中文。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 创建和管理旅行 (Priority: P1)

用户可以在不注册账号和不连接网络的情况下创建、编辑和删除多次旅行，以 Destination、Departure Date 和可选 Notes 记录出行计划。

**Why this priority**: Trip 是倒计时、Checklist 和 Reminder 的基础；没有可管理的 Trip，产品无法提供核心价值。

**Independent Test**: 在无 Trip 且设备断网时创建 Tokyo、查看、编辑并确认删除该 Trip，即可独立验证完整的 Trip 管理价值。

**Acceptance Scenarios**:

1. **Given** 用户没有任何 Trip，**When** 用户创建 Destination 为 ` Tokyo `、Departure Date 为未来本地日期且 Notes 合法的 Trip，**Then** 系统保存 Destination 为 `Tokyo`，返回 Trips 页面并显示该 Trip。
2. **Given** 用户已创建一个 Trip，**When** 用户修改其 Destination、Departure Date 或 Notes 并保存，**Then** Trips 页面和 Trip Detail 显示最新内容。
3. **Given** 用户已存在多个 Trip，**When** 用户打开 Trips 页面，**Then** 所有未来 Trip 按 Departure Date 从近到远显示；同日 Trip 保持稳定顺序。
4. **Given** 用户在 Create Trip 输入空白 Destination、超过 80 个字符的 Destination、早于当前本地日期的 Departure Date 或超过 500 个字符的 Notes，**When** 用户尝试保存，**Then** 系统阻止保存并在对应字段提供明确校验信息，同时保留已输入内容。
5. **Given** 一个已有 Trip，**When** 用户选择删除，**Then** 系统要求二次确认，且取消确认不会改变任何数据。
6. **Given** 用户确认删除一个 Trip，**When** 删除成功，**Then** Trip 及其 Checklist Items 和 Reminder 一并消失，并返回可继续操作的页面。
7. **Given** 本地保存失败，**When** 用户创建、编辑或删除 Trip，**Then** 系统明确告知操作未保存，保留可恢复的输入或原数据，并提供重试入口。
8. **Given** 一个 Departure Date 已过去的 Trip，**When** 用户在 Edit Trip 保存合法的过去日期，并修改 Destination、Notes 或 Departure Date，**Then** 系统允许保存并显示更新后的内容；用户也仍可删除该 Trip。

---

### User Story 2 - 查看旅行倒计时 (Priority: P1)

用户在 Trips 页面和 Trip Detail 查看基于设备本地日历日期计算的出发倒计时，从而快速判断距离出发还有多久。

**Why this priority**: 准确、易读的旅行倒计时是产品的主要即时价值。

**Independent Test**: 分别查看未来、今天和已过去日期的 Trip，并在不同时区和夏令时边界验证展示结果，即可独立验证倒计时能力。

**Acceptance Scenarios**:

1. **Given** Trip 的 Departure Date 比设备当前本地日历日期晚 14 天，**When** 用户查看该 Trip，**Then** Countdown 显示 `还有 14 天`。
2. **Given** Trip 的 Departure Date 是设备当前本地日历日期，**When** 用户查看该 Trip，**Then** Countdown 显示 `今天出发`。
3. **Given** 已保存 Trip 的 Departure Date 早于设备当前本地日历日期，**When** 用户查看该 Trip，**Then** Countdown 显示 `旅行已结束`。
4. **Given** 用户跨越午夜、切换时区或处于夏令时切换日，**When** 页面重新计算 Countdown，**Then** 结果仅依据设备当前本地日历日期与 Departure Date 的日历日差，不产生一天偏差。
5. **Given** 本地 Trip 数据读取失败，**When** 用户打开 Trips 页面，**Then** 页面显示可理解的 Error 状态和重试入口，而不是空白页面或误报无 Trip。

---

### User Story 3 - 管理旅行 Checklist (Priority: P1)

用户为每个 Trip 建立独立的出发准备 Checklist，可以添加、删除、完成或恢复事项，并查看准备进度。

**Why this priority**: Checklist 将倒计时转化为可执行的准备过程，是 MVP 的第二项核心价值。

**Independent Test**: 为一个 Trip 添加 Passport、Visa、Charger，切换 Passport 状态并删除一项，即可验证 Checklist 与进度行为，且不依赖其他 Trip 的 Checklist。

**Acceptance Scenarios**:

1. **Given** Trip 没有 Checklist Item，**When** 用户打开 Trip Detail，**Then** 页面显示明确的空 Checklist 状态和添加入口，且不显示误导性的进度。
2. **Given** 用户为 Tokyo Trip 依次添加 Passport、Visa、Charger，**When** 保存成功，**Then** 页面显示三个独立 Checklist Item 和 `已完成 0 / 3`。
3. **Given** 用户输入首尾含空格的合法 title，**When** 添加 Checklist Item，**Then** 系统保存并显示去除首尾空格后的 title。
4. **Given** title 为空白或超过 100 个字符，**When** 用户尝试添加，**Then** 系统阻止保存、显示明确校验信息并保留输入。
5. **Given** 三个 Pending Item，**When** 用户将 Passport 标记为 Completed，**Then** Passport 以简体中文文字、可访问状态或等价的非颜色方式表达“已完成”，并立即显示 `已完成 1 / 3`。
6. **Given** Passport 已 Completed，**When** 用户将其恢复为 Pending，**Then** 状态立即保存并显示 `已完成 0 / 3`。
7. **Given** Checklist Item 存在，**When** 用户删除该 Item，**Then** Item 被移除且进度立即按剩余 Item 重新计算。
8. **Given** Checklist 状态变更保存失败，**When** 用户添加、切换或删除 Item，**Then** 系统明确提示失败，界面恢复到最后一次成功保存的状态或保留可重试输入，不显示虚假的成功状态。

---

### User Story 4 - 本地持久化和离线使用 (Priority: P1)

用户的 Trip、Notes、Checklist 及 Completed 状态仅保存在设备本地；无网络和 App 完全关闭后仍可继续全部核心流程。

**Why this priority**: 离线可用和可靠恢复是产品承诺，也是旅行场景中的基本可用性要求。

**Independent Test**: 在断网状态创建数据，完全关闭并重新打开 App 后读取和修改相同数据，即可独立验证该能力。

**Acceptance Scenarios**:

1. **Given** 已存在 Trip、Notes、Checklist 和 Completed 状态，**When** 用户完全关闭并重新打开 App，**Then** 所有数据和状态与关闭前最后一次成功保存的状态一致。
2. **Given** 设备没有网络，**When** 用户创建、编辑、查看或删除 Trip，并添加、切换或删除 Checklist Item，**Then** 所有核心功能正常工作。
3. **Given** App 正在读取本地数据，**When** 用户进入依赖该数据的页面，**Then** 页面显示明确 Loading 状态，并最终进入内容、Empty 或可重试 Error 状态。
4. **Given** 用户连续触发保存操作，**When** 前一次保存尚未完成，**Then** 系统防止产生重复 Trip 或 Checklist Item，并向用户表达当前操作状态。

---

### User Story 5 - 设置旅行提醒 (Priority: P2)

用户可以主动为 Trip 开启出发前 7 天和／或 1 天的本地 Reminder；拒绝通知权限不会影响其他功能。

**Why this priority**: Reminder 提升准备事项的及时性，但不影响倒计时和 Checklist 的核心闭环。

**Independent Test**: 用户主动开启一种 Reminder，分别允许和拒绝权限，再修改日期和删除 Trip，即可验证权限、重排和取消行为。

**Acceptance Scenarios**:

1. **Given** 用户从未主动开启 Reminder，**When** 用户启动 App、查看 Trips 或进入 Trip Detail，**Then** 系统不请求通知权限。
2. **Given** Trip 尚未开启 Reminder，**When** 用户主动开启 `出发前 7 天` 或 `出发前 1 天`，**Then** 系统仅在需要时请求通知权限，并在获准后为所选提前量安排本地 Reminder。
3. **Given** 用户拒绝通知权限，**When** 权限请求结束，**Then** 系统明确说明 Reminder 未启用，保持核心功能可用，且不会在后续普通操作中反复强制请求。
4. **Given** 已开启 Reminder 的 Trip，**When** 用户修改 Departure Date 并成功保存，**Then** 所有关联 Reminder 按新的日期保持相同提前量；无法安排的 Reminder 明确显示为不可用且不影响 Trip 保存。
5. **Given** 用户关闭一个 Reminder，**When** 更改保存成功，**Then** 对应 Reminder 被取消，其他已选择 Reminder 不受影响。
6. **Given** 用户确认删除 Trip，**When** 删除成功，**Then** 该 Trip 的所有 Reminder 被取消。
7. **Given** 某提前日期已经过去，**When** 用户尝试开启或因修改 Departure Date 需要重排该 Reminder，**Then** 系统不安排过去时间的通知，并明确反馈该选项当前不可用。

8. **Given** Android 已安排 Reminder，**When** 设备切换时区后启动 App 或恢复前台，**Then** 尚未触发且新目标时刻仍在未来的 Reminder 按当前设备时区对应日期上午 9:00 重排，同一提前量不产生重复通知。
9. **Given** Android App 关闭期间设备切换时区，**When** 用户未再次启动或恢复 App，**Then** 不保证已有 Reminder 自动跟随新时区；界面提前说明该限制及实际送达可能延迟。
10. **Given** Android 时区变化后恢复 App，**When** 按新时区计算的提醒时刻已过去，**Then** 不补发，取消尚存的旧安排并显示该选项不可用；已送达的提醒不因重排再次发送。

### Edge Cases

- Destination 或 Checklist title 仅由空白字符组成时，trim 后视为空并拒绝保存。
- 字符上限按用户可见字符计数；恰好达到上限时允许保存，超过上限时拒绝保存。
- 创建 Trip 时 Departure Date 恰好为设备当前本地日期时允许保存并显示 `今天出发`；已保存 Trip 后续自然过期时仍保留并显示 `旅行已结束`。
- 多个 Trip 具有同一 Departure Date 时采用稳定顺序，避免页面刷新或重启后无故跳动。
- 设备本地日期、时区或夏令时规则变化后，当前展示的 Countdown 随页面恢复或日期变化更新；保存的 Departure Date 不因时区转换而改变日历日。
- Checklist 为零项时不显示进度；从一项删除到零项后恢复空 Checklist 状态。
- 本地数据部分损坏或读取异常时，不把错误解释为空数据；用户可重试，且错误信息不泄露 Trip、Notes 或 Checklist 内容。
- Trip、Notes、Checklist、Completed 状态和 Reminder 选择不得进入操作系统或设备厂商提供的云备份。
- Reminder 权限之后被用户从系统设置撤销时，页面明确显示 Reminder 不可用，核心功能继续正常工作。
- 同一 Trip 同一提前量最多存在一个有效 Reminder，重复操作不得产生重复通知。
- iOS Reminder 按触发时设备当前本地时区，在对应提醒日期上午 9:00 触发。Android 按调度时设备本地时区计算对应提醒日期上午 9:00；App 启动或恢复前台后按当前时区重排尚未触发的提醒，关闭期间切换时区不保证自动跟随。Android 为尽力调度，实际送达可能受系统限制延迟，不保证准点。重排后已过时刻不补发，显示该选项不可用。
- v1.0 不识别目的地时区，不进行城市到时区映射，也不依赖相关网络服务。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统必须允许用户创建、查看、编辑和删除多个 Trip，且无需账号或网络。
- **FR-002**: 每个 Trip 必须包含唯一标识、必填 Destination、必填 Departure Date、可选 Notes，以及创建和稳定排序所需的信息。
- **FR-003**: 系统必须在保存前 trim Destination；trim 后不能为空，最多 80 个用户可见字符。
- **FR-004**: Create Trip 时，Departure Date 不得早于保存当下的设备本地日历日期；Edit existing Trip 时，Departure Date 只需是合法的 YYYY-MM-DD 公历日期，允许保存过去日期，使自然过期的 Trip 仍可修改 Destination、Notes、Departure Date 或删除。
- **FR-005**: Notes 最多允许 500 个用户可见字符。
- **FR-006**: 校验失败必须阻止保存，在相关字段附近提供明确反馈，并保留用户输入。
- **FR-007**: Trips 页面必须展示全部 Trip；每个 Trip 至少展示 Destination、Departure Date、Countdown，以及存在 Checklist Item 时的完成进度。
- **FR-008**: 未来 Trip 必须默认按 Departure Date 从近到远排序；同日 Trip 必须保持稳定顺序。已完成 Trip 也必须可见，并排在未来及当天 Trip 之后。
- **FR-009**: Countdown 必须按设备当前本地日历日期计算：未来显示 `还有 N 天`，当天显示 `今天出发`，过去显示 `旅行已结束`。
- **FR-010**: Countdown 计算必须以日历日为单位，不得因 UTC 转换、时区或夏令时产生一天偏差。
- **FR-011**: 每个 Trip 必须拥有相互独立的 Checklist，用户可添加、删除、标记 Completed 并恢复为 Pending。
- **FR-012**: 系统必须 trim Checklist Item title；trim 后不能为空，最多 100 个用户可见字符。
- **FR-013**: Checklist 状态变化必须在用户操作后立即保存；保存成功前不得把未持久化状态表达为已可靠保存。
- **FR-014**: 存在 Checklist Item 时，系统必须按 `已完成 {已完成数} / {总数}` 显示进度，例如 `已完成 3 / 5`；不存在 Item 时不要求显示进度，并必须显示明确空状态。
- **FR-015**: 删除 Trip 前必须二次确认；只有用户确认后才能删除。
- **FR-016**: 删除 Trip 必须同时删除其 Notes、Checklist Items，并取消所有关联 Reminder，不得影响其他 Trip。
- **FR-017**: 所有 Trip、Notes、Checklist、Completed 状态和 Reminder 选择必须仅保存在用户设备本地，App 不得上传、远程记录或同步这些内容。
- **FR-017a**: 系统必须把全部业务数据排除在操作系统及设备厂商提供的云备份之外，卸载或设备丢失后的数据不提供云端恢复。
- **FR-018**: App 完全关闭并重新打开后，必须恢复最后一次成功保存的全部业务数据及状态。
- **FR-019**: 在无网络条件下，Trip CRUD、Countdown 查看和 Checklist 全部操作必须正常工作。
- **FR-020**: 本地数据读取过程必须显示 Loading 状态；读取失败必须显示 Error 状态和重试入口，不得显示空白页面或错误的 Empty 状态。
- **FR-021**: 保存失败不得静默处理；系统必须明确告知未保存，保留可恢复输入或最后成功状态，并提供重试或安全退出路径。
- **FR-022**: 系统必须防止快速重复提交导致重复 Trip、Checklist Item 或相互覆盖的状态变化。
- **FR-023**: 系统必须为每个 Trip 提供可独立选择的 `出发前 7 天` 和 `出发前 1 天` 本地 Reminder。
- **FR-024**: 系统只有在用户主动开启 Reminder 且当前授权不足时才可请求通知权限，不得在启动、浏览或使用其他功能时请求。
- **FR-025**: 用户拒绝或撤销通知权限后，系统必须提供明确反馈、保持所有 P1 功能可用，并仅在用户再次主动尝试开启 Reminder 时允许再次发起权限相关流程。
- **FR-026**: 修改 Departure Date 成功后，系统必须让已有 Reminder 与新日期及原提前量一致；不得安排触发时间已经过去的 Reminder，并必须反馈无法安排的选项。
- **FR-027**: 用户关闭 Reminder 或删除 Trip 时，系统必须取消对应的已安排 Reminder。
- **FR-028**: 同一 Trip 的同一提前量最多只能存在一个有效 Reminder。
- **FR-028a**: iOS Reminder 按触发时设备当前本地时区，在对应提醒日期上午 9:00 触发。Android Reminder 按调度时设备本地时区计算对应提醒日期上午 9:00，并在 App 启动或恢复前台后按当前时区重排尚未触发的提醒；关闭期间切换时区不保证自动跟随。Android 采用尽力调度，不保证实际准点送达。界面必须清楚表达提醒时间及 Android 的时区和送达限制；重排后已过时刻不补发并明确显示不可用。
- **FR-028b**: v1.0 不得识别目的地时区、建立城市到时区映射或使用相关网络服务；Reminder 时间不得依据 Destination 推断。
- **FR-029**: Button 和 Checklist Checkbox 必须具有明确的可访问名称、正确角色及状态；Completed、错误、选择和提醒状态不得只依赖颜色表达。
- **FR-030**: 核心创建、编辑、删除、Checklist 和 Reminder 交互必须支持平台屏幕阅读器与可用的键盘操作，触控区域适合移动端使用。
- **FR-031**: 核心内容和操作必须兼容系统字体缩放，在受支持的字体设置下不丢失信息或阻断操作。
- **FR-032**: App 不得要求注册，不得包含后端、云同步、广告、Analytics、社交能力，且不得读取位置、通讯录、照片、相机或麦克风。
- **FR-033**: 除用户主动启用 Reminder 所需的通知权限外，App 不得申请与核心功能无关的敏感权限。
- **FR-034**: Trips 页面必须在没有 Trip 时显示明确 Empty State，并提供进入 Create Trip 的操作。
- **FR-035**: Create/Edit Trip 页面必须提供 Destination、Departure Date、Notes、Validation 和 Save；Trip Detail 必须提供 Trip 信息、Countdown、Notes、Checklist、Reminder、Edit 和 Delete。
- **FR-036**: v1.0 的全部用户可见 UI 文案、校验与错误反馈、权限说明和辅助功能名称必须使用简体中文；用户输入的 Destination、Notes 和 Checklist title 保持原文，代码标识、类型和 API 保持英文。

### Key Entities

- **Trip**: 一次旅行计划；包含唯一标识、Destination、Departure Date、可选 Notes、用于稳定排序的创建信息，并拥有零个或多个 Checklist Item 与 Reminder 选择。
- **Checklist Item**: 某个 Trip 的一项出发准备任务；包含唯一标识、所属 Trip、title、Pending/Completed 状态及稳定展示所需信息。其生命周期从属于 Trip。
- **Reminder**: 某个 Trip 在指定提前量（7 天或 1 天）的本地提醒选择及安排状态；其生命周期从属于 Trip，并受通知权限、Departure Date 和当前本地时间约束。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 至少 90% 的首次使用者能在 1 分钟内从 Empty State 创建并看到第一个 Trip，无需账号或网络。
- **SC-002**: 在未来、当天、已过期、跨午夜、至少两个时区及适用的夏令时边界验收样本中，Countdown 的日历日结果 100% 符合定义且无一天偏差。
- **SC-003**: 在断网验收中，Trip 创建、编辑、查看、删除及 Checklist 添加、切换、删除场景 100% 可完成。
- **SC-004**: 对包含多个 Trip、Notes、Checklist 和混合 Completed 状态的数据集，连续 20 次完全关闭并重新打开 App 后，恢复结果与最后成功保存状态 100% 一致。
- **SC-005**: 所有 P1 验收场景在 Android 和 iOS 上表现一致，且 100% 具有明确、可验证的通过或失败结果。
- **SC-006**: 删除任一含 Checklist 和 Reminder 的 Trip 后，验收检查中该 Trip 及全部从属数据、通知均为零残留，其他 Trip 数据保持不变。
- **SC-007**: 通知权限被拒绝或撤销的全部验收场景中，100% 显示明确反馈，且所有 P1 核心流程仍可完成。
- **SC-008**: 核心流程中的所有 Button 和 Checkbox 均可被屏幕阅读器识别并操作，Completed 状态均可在不依赖颜色时辨认；系统字体放大验收中关键内容与操作仍可用。
- **SC-009**: 发布权限检查中，除用户主动启用 Reminder 所需的通知权限外，不出现任何与产品功能无关的敏感权限；不发生业务数据上传或用户跟踪。
- **SC-010**: 所有读取和保存失败验收样本均在可见界面提供明确反馈及恢复入口，不出现空白页面、静默失败或虚假成功。

## Assumptions

- 产品面向单设备上的单一使用者，不设置账号、用户角色或跨设备数据合并。
- Departure Date 表示不含时刻和时区的本地日历日期。Create Trip 不能保存过去日期；Edit existing Trip 允许保存合法的过去日期，使自然过期 Trip 仍可编辑或删除。过去日期不产生 Archive、History 或其他新状态，Trip 继续按 Countdown 规则显示 `旅行已结束`。
- “用户可见字符”用于字段长度验收，组合字符按用户看到的单个字符处理。
- 同日 Trip 按创建先后维持稳定顺序；当天和未来 Trip 排在已完成 Trip 之前，已完成 Trip 仍保留供用户查看或手动删除。
- Reminder 可以分别启用出发前 7 天和出发前 1 天两种提前量。iOS 按触发时设备当前本地时区上午 9:00；Android 按调度时设备本地时区上午 9:00，启动或恢复前台后重排，关闭期间不保证自动跟随时区变化，实际送达可能延迟；界面必须清楚表达。v1.0 不识别目的地时区、不进行城市到时区映射，也不使用相关网络服务。
- 当 Reminder 的目标触发时间已过去时，不立即补发通知，而是把该选项显示为无法安排。
- Reminder 安排失败不回滚已成功保存的 Trip 内容，但必须准确呈现 Reminder 未生效并允许用户重试。
- 本地数据不由产品提供导出、备份、恢复、云同步或跨设备迁移，并排除在操作系统及设备厂商提供的云备份之外；卸载或设备丢失后不能从云端恢复。
- v1.0 的所有面向用户的 UI 文案仅使用简体中文，不提供英文或其他语言切换；用户输入内容保持原文，代码标识、类型和 API 保持英文。
- 产品不依赖任何远程服务，唯一可能涉及的系统外部能力是设备本地通知。

## Scope Boundaries

v1.0 不包含用户账号、后端、云同步、多设备同步、Trip 分享、地图、GPS、天气、航班或酒店查询、旅行预订、AI 行程规划、社区、图片上传、支付、广告、Analytics 或任何社交功能。
