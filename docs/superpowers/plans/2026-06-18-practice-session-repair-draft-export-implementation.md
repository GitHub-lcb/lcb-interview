# 模拟面试战报补弱模板导出实施计划

## 范围

- `frontend/src/utils/practiceSessionReport.ts`
- `frontend/src/utils/practiceSessionReport.test.ts`

## 步骤

1. 先在 Markdown 导出测试中断言补弱动作包含“重答模板”和四段式模板。
2. 调整 `renderSessionRepairActions`，在每条 action 下追加缩进后的 `buildPracticeSessionRepairDraft`。
3. 确认无动作时仍输出原兜底文案。
4. 运行聚焦测试、全量测试和构建。
5. 使用中文提交信息提交。

## 风险控制

- 不新增状态，不改页面交互。
- 模板只通过已有函数生成，避免同一能力出现两套文案。
