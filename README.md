# Trip Countdown

Trip Countdown 使用 Expo SDK 57 和严格 TypeScript。项目基线为 Node 22.x，最低版本是 22.13；仓库使用 npm 与 `package-lock.json` 作为唯一包管理方案。

## 本地工程基线

新 checkout 在仓库根目录执行：

```sh
nvm use
npm ci
npm run lint
npm run typecheck
npm run test:ci
```

`npm test` 用于本地运行 Jest；`npm run test:ci` 使用固定的 CI 模式和串行执行。lint、typecheck 或 test 任一失败都表示质量门禁未通过。

这些命令只提供 Node 环境中的自动检查证据。模拟器、development build、Android/iOS 真机、备份恢复、通知和 release artifact 验证属于后续独立阶段；自动测试通过不代表这些设备或发布验证已经完成。
