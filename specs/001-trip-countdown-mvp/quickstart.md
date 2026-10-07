# Quickstart Validation Guide

日期：2026-10-07。Phase 1 已建立 Node、lint、typecheck、Jest 与 CI 工程基线；T011 Human Review 尚未执行，未进入 Phase 2。EAS profiles、原生/真机与 release 验证仍属于后续阶段，不能因自动门禁通过而宣称完成。

## Prerequisites

使用仓库兼容的固定 Node 22.x（至少22.13）、npm、Android工具链与设备、macOS/Xcode 26.4+及iOS真机。EAS构建需开发者账户和平台签名权限；不把这些要求传递给最终App用户。先读 SDK57 文档与 plan.md，检查用户未提交修改。

## Quality Gate

在新 checkout 的仓库根目录执行：

```sh
nvm use
npm ci
npm run lint
npm run typecheck
npm run test:ci
```

每个命令独立检查退出码，任一失败/未运行/缺配置即不通过。日期测试另以 Asia/Shanghai、America/New_York 的独立 TZ 进程执行测试配置。记录提交、运行环境和结果；测试契约见 contracts/ui-and-boundaries.md 与 data-model.md。

## Development and Native Validation

完成 development profile 和 expo-dev-client 配置后：

```sh
eas build --profile development --platform android
eas build --profile development --platform ios
npx expo start --dev-client
```

本机构建可使用 npx expo run:android / npx expo run:ios。Local Module/plugin变更后重建。用隔离干净 checkout 两次执行 npx expo prebuild --clean，比较生成 manifest/backup XML/模块链接，不在存在手工原生修改的工作目录执行 clean。不得在这个规划阶段运行构建或安装依赖。

在非发布测试入口执行 tests/device 中同一 Repository 契约：实际 expo-sqlite 创建/读回/更新/删除、close/reopen、foreign key cascade、迁移回滚、已知高版本拒绝。生产路由树不含验证入口。记录设备/OS/构建/结果；只跑 Jest mock 不通过此项。

## End-to-End Scenarios

| 场景 | 操作和通过标准 |
|---|---|
| P1 创建 | 无数据、断网启动显示空状态；创建 Tokyo，日期为本地今天+14天，显示“还有14天”（实际UI可含空格），目的地trim；首次使用者样本至少90%在1分钟内完成 |
| 校验/编辑 | Create：空目的地、81可见字符、过去日期、501备注均阻止保存且保留输入；Edit existing Trip：合法的 YYYY-MM-DD 过去日期允许保存，可修改 Destination、Notes 或 Departure Date，且仍可删除。对无效公历日期、80/500/100边界、组合字符/emoji同样验证 |
| Checklist | 添加 Passport/Visa/Charger；勾选Passport显示“已完成 1 / 3”，恢复后0/3，删除后重算；另一Trip不变 |
| 持久化 | 多Trip与混合完成状态、备注，完全杀进程重启20次，最后保存状态一致；过程中离线增改删 |
| 日期 | 今天“今天出发”，自然过期“旅行已结束”；跨月/年/闰日、午夜、DST、切时区无±1天；出发日期文本不改变 |
| 排序 | 今天/未来日期升序，同日稳定；已过去在后仍可查看 |
| 删除 | 取消确认保持数据；确认后以短生命周期 isDeleting 防重复，先取消 future scheduled reminders；取消失败保留 Trip/Checklist/Reminder 并显示未完成可重试；取消成功后 transaction 删除 Trip 且 FK cascade 清除从属数据。注入“通知已取消、DB删除前崩溃”，下次启动依据仍存在的 Reminder desired state 恢复所需 future 调度；历史已展示通知不阻塞删除 |
| 错误 | 非发布测试构建注入读取/写入/迁移失败；无空白页/假Empty/假成功，保留输入或原状态，重试后可用 |
| 权限 | 普通使用无通知请求；主动启用才请求，拒绝后明确反馈，P1继续工作；普通浏览不重弹，系统撤销后前台更新状态 |
| Reminder | 7/1分别开关、重排、取消、过去目标、重复操作、进程中断恢复；Android无exact权限且容许系统延迟；关闭期间切时区允许不自动跟随；启动/恢复前台后未来提醒重排为新当地09:00，无重复；新时刻已过去取消旧安排、不补发并显示不可用，已送达不重复 |
| Accessibility | 两端读屏识别所有按钮/checkbox名称角色状态，键盘完成核心流程，大字体无截断阻断，完成/错误不靠颜色 |

Reminder测试可用非发布测试注入时钟缩短等待，最终仍需真实本地09:00与后台/重启/时区场景验证；不增加生产调试选项。

## Backup and Privacy Validation

检查实际 APK 合并权限和全部旧/新备份规则，确认未申请 exact alarm、位置/通讯录/相机/麦克风/照片权限。检查 Android SQLite目录及通知shared preferences排除；iOS读回目录和已有文件的备份属性，确认WAL/SHM同处保护目录。创建数据后进行平台备份/恢复验证，目标华为环境重复；恢复不带回业务记录。系统通知队列作为单独检查项，不把应用目录检查等同全部通过。

检查运行网络行为、日志与依赖自动初始化，无业务数据上传/Analytics；通知payload无用户正文。测试数据不提交到仓库、不发送给EAS构建服务。

## Release Validation

配置完production后：

```sh
eas build --profile production --platform android
eas build --profile production --platform ios
```

Android产出签名Release APK（非默认AAB）；iOS产出商店签名IPA。使用内嵌JS包脱离Metro测试离线冷启动；Android含目标华为真机，iOS使用对应production/TestFlight构建。留存构建ID、版本、commit、自动验证、设备矩阵、已知问题及人工Review。首次人工提交华为应用市场/App Store Connect，不执行自动发布。

通过标准：全部P1及获批P2验收、质量门禁、备份/权限检查及人工Review通过；未审查时只写“自动验证通过，待人工 Review”。本次文档检查不代替上述实施证据。
