# 本轮行动优先级设计

## 背景

练习战报已经包含错因验收、薄弱能力雷达、面试官决策卡和下一轮训练。信息足够丰富后，新的问题是用户需要在多个区块里判断“现在到底先点哪个”。战报应该直接给出 1-3 个最该做的动作，并解释排序原因。

## 目标

- 在本轮战报中新增“本轮行动优先级”。
- 将面试官决策、错因验收、能力雷达和下一轮训练合并成最多 3 个行动。
- 每个行动包含标题、原因、入口和优先级。
- Markdown 导出包含同样顺序，方便离线执行。
- 不新增后端接口，不依赖外部服务，继续保持本地免费。

## 非目标

- 不替代原有各区块；行动优先级只负责排序和聚合。
- 不引入复杂任务系统或持久化状态。
- 不跨天保存已完成动作。

## 方案

新增 `PracticeSessionActionPriority` 类型和 `buildPracticeSessionActionPriorities(queue, progress, now)` 函数。函数复用已有构建器：

- `buildPracticeSessionInterviewerDecision`
- `buildPracticeSessionRecoveryAcceptance`
- `buildPracticeSessionAbilityRadar`
- `buildPracticeSessionNextTrainingQueue`

排序规则：

1. 面试官决策为 `reject-risk` 或 `hold` 时，优先执行决策阻断动作。
2. 错因验收为 `failed`、`pending` 或 `testing` 时，插入复测动作。
3. 能力雷达为 `risk` 或 `watch` 时，插入能力回炉动作。
4. 永远保留下一轮训练作为兜底动作。
5. 最多展示 3 个动作；同名动作去重。

面板中放在“本轮面试官决策卡”之后、“下一轮训练”之前，让用户先看到判断，再直接拿到执行顺序。

## 测试策略

- 工具测试覆盖低分场景聚合出决策阻断、复测和能力回炉。
- 空队列导出必须仍显示“等待建立行动队列”。
- 面板测试覆盖行动列表和第一行动导航。
- 提交前运行 focused tests、完整前端测试、生产构建和 `git diff --check`。
