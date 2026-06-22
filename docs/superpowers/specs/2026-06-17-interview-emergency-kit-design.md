# 面试前急救包设计

## 背景

当前学习计划页已经具备配速教练、今日作战简报、今日闭环验收、面试表达简报和错因账本。用户平时可以按完整闭环训练，但临近面试前常常只剩 15 到 30 分钟，这时长报告和完整训练队列都太重。

要让产品明显超过普通题库，需要在本地进度上生成“面试前急救包”：把复习债、薄弱题、低分错因、今日计划和模拟面试补样本压缩成一个短时间行动队列。用户不需要会员、不需要联网、不需要 AI 等待，就能得到最后一轮临场动作。

## 目标

- 新增 `buildInterviewEmergencyKit(progress, now)` 纯函数。
- 基于本地 `StudyProgress`、复习排期、错因账本、恢复计划和今日闭环生成急救包。
- 控制总耗时不超过 30 分钟，最多 5 个行动。
- 行动覆盖四类优先级：复习债、错因修复、薄弱开口、今日闭环、建立样本。
- 在学习计划页新增 `InterviewEmergencyKitPanel`，放在今日闭环验收之后、面试简报之前。
- 保持完全前端、本地计算，不新增后端接口和付费能力。

## 非目标

- 不替代现有今日计划、错题账本和恢复计划，只做临场压缩视图。
- 不新增倒计时器、通知、日历和外部提醒。
- 不改变题目状态流转和面试评分逻辑。
- 不使用浏览器验证；本次按用户要求只用命令行测试、构建和 HTTP 探测。

## 设计方案

新增类型：

- `InterviewEmergencyKitLevel = 'empty' | 'critical' | 'focused' | 'ready'`
- `InterviewEmergencyKitItemKind = 'review' | 'mistake' | 'weak' | 'closure' | 'sample'`
- `InterviewEmergencyKitItem`：标题、说明、原因、入口、耗时、优先级、关联题目。
- `InterviewEmergencyKit`：等级、标题、摘要、总耗时、主行动、指标、行动列表。

`buildInterviewEmergencyKit(progress, now)` 生成流程：

1. 读取 `buildScheduledReviewQueue(progress, now, 12)`，取到期/逾期题生成复习债行动。
2. 读取 `buildInterviewMistakeLedger(progress)` 和 `buildInterviewRecoveryPlan(ledger)`，将恢复计划第一步作为错因修复行动。
3. 查找状态为 `weak` 且没有模拟面试记录的题目，生成薄弱开口行动。
4. 读取 `buildDailyPlanCompletion(progress, now)`，如果今日闭环未达标，生成闭环行动。
5. 如果没有任何面试样本，生成建立样本行动。
6. 按优先级排序，保留总耗时不超过 30 分钟、最多 5 个行动。

优先级规则：

- 逾期/到期复习债最高，避免临场遗忘。
- 明确低分错因次之，避免同类表达问题复发。
- 薄弱未开口题第三，解决“会看不会说”。
- 今日闭环和建立样本作为兜底，保证没有数据时也可行动。

## 页面设计

新增 `InterviewEmergencyKitPanel`：

- 顶部显示“面试前急救包”、等级标题、摘要、总耗时。
- 右侧主按钮进入首要行动。
- 下方四个指标：行动数、预计耗时、复习债、错因状态。
- 行动列表最多 5 条，每条展示耗时、原因和入口。

学习计划页接入位置：

1. `StudyPaceCoachPanel`
2. `DailyPlanBriefPanel`
3. `DailyPlanCompletionPanel`
4. `InterviewEmergencyKitPanel`
5. `InterviewBriefPanel`
6. `InterviewMistakeLedgerPanel`

## 行为规则

- 没有任何轨迹时输出 `empty`，主行动指向 `/practice`，引导完成一次模拟面试。
- 有复习债或错因时输出 `critical`。
- 有行动但没有紧急风险时输出 `focused`。
- 今日闭环已完成且没有明显风险时输出 `ready`。
- 每个行动必须有明确入口；空入口降级为 `/practice`。
- 总耗时超过 30 分钟时按优先级截断，不拆分行动。

## 测试策略

- 工具函数测试覆盖：
  - 空进度输出建立样本行动。
  - 逾期复习债优先于错因修复。
  - 低分错因生成恢复计划入口。
  - 总耗时不超过 30 分钟且最多 5 条。
  - 已稳定状态输出 ready。
- 组件测试覆盖标题、耗时、主行动和行动列表渲染。
- 提交前运行前端全量测试、前端构建、后端测试、`git diff --check` 和 HTTP 200 探测。
