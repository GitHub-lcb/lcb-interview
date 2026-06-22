# 模拟面试评分后状态自动收敛实施计划

## 范围

- `frontend/src/utils/studyProgress.ts`
- `frontend/src/utils/studyProgress.test.ts`

## 步骤

1. 在 `studyProgress.test.ts` 为 `recordInterviewAttempt` 新增低分自动标弱测试：
   - 输入 55 分。
   - 期望题目状态为 `weak`。
   - 期望 `addedToPlan` 为 `true` 且 `dailyPlan` 包含题目。
   - 期望 `reviewCount` 加 1，`lastReviewedAt` 等于尝试时间。
2. 新增通过线测试：
   - 原题为 `weak`。
   - 输入 72 分。
   - 期望状态变成 `learning`，不强行加入计划。
3. 新增高分测试：
   - 输入 86 分。
   - 期望状态变成 `mastered`。
4. 运行聚焦测试，确认红测失败。
5. 在 `recordInterviewAttempt` 内先写入尝试，再按分数生成下一题目状态。
6. 保持最近 5 次尝试截断逻辑不变。
7. 运行聚焦测试、全量测试和构建。
8. 中文提交。

## 风险控制

- 状态收敛集中在 `recordInterviewAttempt`，避免练习页和其他入口各自实现一套规则。
- 不自动移出计划，减少对现有每日计划 UI 的破坏。
- 测试覆盖新增状态行为和既有尝试截断行为。
