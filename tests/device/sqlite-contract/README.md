# expo-sqlite development-build contract

状态：**待 development build**。本目录不由 Jest 执行，memory adapter 结果不能替代此证据。

`runExpoSqliteContract(privateDirectory)` 必须在 Android/iOS development build 中调用，且参数必须来自已经完成备份排除验证的平台私有存储边界。它使用独立数据库文件验证：

- v0 → v1 migration、WAL、主连接及独占事务连接的 foreign keys；
- 独占事务在 `BEGIN` 前读回 `foreign_keys=1`，非法外键写入被拒绝；
- Repository write/read；
- close/reopen 后读取；
- FK cascade；
- exclusive transaction rollback；
- future schema version rejection。

同一入口还会调用 `runChecklistSqliteContract(privateDirectory)`，在另一个按
`runId` 隔离的真实 SQLite 文件中验证：

- Checklist add、`setCompleted(true)`、close/reopen 后内容与状态保持；
- Trip A/B 数据隔离，更新和删除 Trip A 事项不影响 Trip B；
- close/reopen 后隔离仍保持；
- 删除父 Trip 后 Checklist FK cascade，其他 Trip 不受影响；
- 真实 exclusive transaction 中注入失败后 rollback，先前成功数据不损坏。

执行时记录平台、系统版本、development build、commit、私有目录准备结果和返回的 `SqliteContractEvidence`。在该记录存在前，Phase 3/5 只能声明 JS/TS 自动门禁和设备契约入口实现通过，不能声明真实 SQLite persistence、cascade 或 reopen 已通过。

`device-entry.tsx` 是 development build 专用 harness，不接入生产 route。执行时临时把 Metro entry 指向该文件，运行结束后恢复 `package.json#main`；日志中的 `TRIP_COUNTDOWN_SQLITE_CONTRACT_PASS` 及 JSON evidence 才表示契约完成。`TRIP_COUNTDOWN_SQLITE_CONTRACT_FAIL` 或缺少 PASS marker 均不得记为通过。
