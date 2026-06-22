# 模拟面试战报首题验收尺实施计划

## 范围

只改前端派生模型、Markdown 导出、面板展示、样式和测试，不改接口、不改数据库。

## 步骤

1. 在 `frontend/src/types.ts` 增加 `PracticeSessionFirstQuestionRubric` 和条目类型。
2. 在 `frontend/src/utils/practiceSessionReport.test.ts` 新增失败用例，验证 Markdown 输出验收尺和空态。
3. 在 `frontend/src/components/PracticeSessionReportPanel.test.tsx` 新增失败用例，验证面板展示和跳转。
4. 在 `frontend/src/utils/practiceSessionReport.ts` 增加构建函数、渲染函数和验收条目生成规则。
5. 在 `frontend/src/components/PracticeSessionReportPanel.tsx` 接入 memo 与 UI 区块。
6. 在 `frontend/src/styles/global.css` 增加卡片样式和移动端布局。
7. 运行聚焦测试、全量测试、构建和 `git diff --check`。

## 风险控制

- 不新增状态源，全部复用首题预演结果。
- 回修态和推进态使用不同文案，避免把阻断项误判为可以推进。
- 验收点固定为 4 项，避免战报继续膨胀到不可读。
