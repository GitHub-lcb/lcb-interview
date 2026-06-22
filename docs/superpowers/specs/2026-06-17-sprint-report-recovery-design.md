# 冲刺报告错题恢复增强设计

## 背景

冲刺报告已经覆盖备考健康度、今日计划闭环、今日作战简报和面试表达简报。与此同时，系统已有面试错题账本、错因恢复计划和恢复验收能力，但这些信息目前分散在页面或单独导出里。用户复制冲刺报告时，仍然缺少“我为什么答不好、先修哪类错因、下一轮怎么验收”的完整链路。

要让免费面试题库从“刷题工具”升级为“本地面试教练”，冲刺报告需要纳入错题恢复信息。这样用户把报告粘到文档、聊天窗口或个人知识库时，可以同时看到宏观健康度、今日闭环、错因账本和恢复动作，而不是再手工拼接多份材料。

## 目标

- 在 `buildSprintReportMarkdown` 中新增“面试错题账本”和“错题恢复计划”两个章节。
- 复用 `buildInterviewMistakeLedger(progress)` 与 `buildInterviewRecoveryPlan(ledger)`，不重复实现错因聚合和恢复计划算法。
- 报告中输出错因状态、摘要、问题总数、最高优先级错因、关联题目和训练入口。
- 报告中输出恢复计划模式、预计耗时、步骤标题、动作原因和入口。
- 在“下一步行动”中加入错题恢复主动作，导出后仍能直接知道先补哪一环。
- 保持完全前端、本地计算、免费使用，不新增接口和持久化字段。

## 非目标

- 不改变已有 `buildInterviewRecoveryMarkdown` 的单独导出格式。
- 不改页面结构和复制按钮交互。
- 不新增 AI 评分逻辑，也不改变已有评分阈值。
- 不把所有历史模拟面试逐条导出，避免冲刺报告变成不可扫描的流水账。

## 设计方案

`buildSprintReportMarkdown(routes, progress, now)` 继续作为复制报告的唯一入口，新增：

1. `mistakeLedger = buildInterviewMistakeLedger(progress)`
2. `recoveryPlan = buildInterviewRecoveryPlan(mistakeLedger)`

新增两个渲染函数：

- `renderMistakeLedgerSection(ledger)`：输出错题账本标题、摘要、问题数量和最多 5 条错因。空账本时输出“先完成一次模拟面试”的行动提示。
- `renderRecoveryPlanSection(plan)`：输出恢复计划标题、摘要、总耗时和最多 4 个步骤。步骤保留入口路径，方便从外部报告回到产品继续练习。

章节顺序调整为：

1. 备考健康度
2. 四维诊断
3. 今日计划闭环
4. 今日作战简报
5. 可主动表达
6. 必须规避
7. 开口热身题
8. 面试错题账本
9. 错题恢复计划
10. 下一步行动

`renderActionSection` 新增 `recoveryPlan` 参数，并输出：

`- 错题恢复：${recoveryPlan.primaryAction.label} - ${recoveryPlan.primaryAction.description}（${recoveryPlan.primaryAction.to}）`

## 行为规则

- 错题账本为空时也输出章节，避免用户误以为报告缺失内容。
- 错因条目最多导出 5 条，恢复步骤最多导出 4 条，保持报告可读。
- 关联题目为空时显示“暂无”，入口为空时降级为 `/practice`。
- 恢复计划总耗时直接使用已有 `plan.totalMinutes`，不重新估算。
- 所有章节不能出现 `undefined`。

## 测试策略

- 先扩展 `sprintReport.test.ts`：
  - 非空报告中已有一次低分模拟面试，断言导出“面试错题账本”“错题恢复计划”“错题恢复：”和训练入口。
  - 空进度报告仍导出空账本提示、模拟面试入口，并且不出现 `undefined`。
- RED 阶段运行 `npm run test -- sprintReport`，确认因为缺少新章节失败。
- GREEN 阶段只改 `sprintReport.ts` 接入已有工具函数。
- 提交前运行前端全量测试、前端构建、后端测试、`git diff --check` 和 HTTP 200 探测。
