# 模拟面试战报首题预演卡实施计划

## 范围

本次只改前端派生数据、Markdown 导出、面板展示、样式和测试，不改接口、不改数据库、不引入付费能力。

## 步骤

1. 在 `frontend/src/types.ts` 增加 `PracticeSessionFirstQuestionRehearsal` 类型。
2. 在 `frontend/src/utils/practiceSessionReport.test.ts` 先新增失败用例，验证 Markdown 导出首题预演卡和空态。
3. 在 `frontend/src/components/PracticeSessionReportPanel.test.tsx` 先新增失败用例，验证面板展示和按钮跳转。
4. 在 `frontend/src/utils/practiceSessionReport.ts` 增加构建函数、渲染函数和辅助文案函数，并插入导出顺序。
5. 在 `frontend/src/components/PracticeSessionReportPanel.tsx` 接入 memo 与 UI 区块，放在启动执行清单之后。
6. 在 `frontend/src/styles/global.css` 增加卡片样式和移动端布局。
7. 运行聚焦测试、全量测试、构建和 `git diff --check`。

## 风险控制

- 复用现有队列与启动清单，避免创建新的状态来源。
- 所有文案都由本地规则生成，保持完全免费。
- 空态和回修态都必须有明确入口，避免导出无行动项。
