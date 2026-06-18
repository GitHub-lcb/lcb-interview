# 模拟面试战报首题回执模板实施计划

## 范围

只改前端派生模型、Markdown 导出、面板展示、样式和测试。

## 步骤

1. 在 `frontend/src/types.ts` 增加首题回执模板类型。
2. 在 `frontend/src/utils/practiceSessionReport.test.ts` 新增失败用例，验证 Markdown 输出和空态。
3. 在 `frontend/src/components/PracticeSessionReportPanel.test.tsx` 新增失败用例，验证面板展示和跳转。
4. 在 `frontend/src/utils/practiceSessionReport.ts` 增加构建函数、渲染函数和 4 个回执字段生成规则。
5. 在 `frontend/src/components/PracticeSessionReportPanel.tsx` 接入 memo 与 UI 区块。
6. 在 `frontend/src/styles/global.css` 增加紧凑卡片样式和移动端单列。
7. 运行聚焦测试、全量测试、构建和 `git diff --check`。

## 风险控制

- 固定 4 个字段，避免用户被模板淹没。
- 回修态文案强调阻断减少，推进态文案强调评分样本。
- 不新增存储，先保持模板可复制、可导出。
