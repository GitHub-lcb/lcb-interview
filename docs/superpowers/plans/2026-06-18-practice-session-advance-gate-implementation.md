# 模拟面试战报下一轮准入闸门实施计划

## 目标

新增“下一轮准入闸门”，让战报在回执验收卡之后给出明确裁决：本轮是否可以进入下一轮训练，还是必须先回修。

## 架构

基于既有 `buildPracticeSessionReceiptAcceptance` 派生 `PracticeSessionAdvanceGate`，不新增持久化和后端接口。Markdown、React 面板和测试共用同一份模型。

## 任务 1：补失败测试

涉及文件：

- `frontend/src/utils/practiceSessionReport.test.ts`
- `frontend/src/components/PracticeSessionReportPanel.test.tsx`

步骤：

- Markdown 测试断言包含 `## 下一轮准入闸门`、`暂缓进入下一轮`、`目标清晰`、`证据可查`、`主行动：`。
- 空队列 Markdown 测试断言包含 `等待建立准入样本`。
- 组件测试断言存在 `aria-label="下一轮准入闸门"`、准入条件和主按钮跳转。
- 运行 `npm run test -- practiceSessionReport PracticeSessionReportPanel`，确认生产代码缺失导致失败。

## 任务 2：实现模型和 Markdown

涉及文件：

- `frontend/src/types.ts`
- `frontend/src/utils/practiceSessionReport.ts`

步骤：

- 新增 `PracticeSessionAdvanceGateStatus`、`PracticeSessionAdvanceGateItem`、`PracticeSessionAdvanceGate`。
- 新增 `buildPracticeSessionAdvanceGate(queue, progress, now)`。
- 在 Markdown 中把 `renderSessionAdvanceGate` 放在回执验收卡之后、下一轮训练之前。
- 运行聚焦测试，确认 Markdown 断言通过。

## 任务 3：实现面板和样式

涉及文件：

- `frontend/src/components/PracticeSessionReportPanel.tsx`
- `frontend/src/styles/global.css`

步骤：

- 导入并 memoize `buildPracticeSessionAdvanceGate`。
- 在回执验收卡之后渲染准入闸门。
- 补充空态、阻断态、可推进态样式。
- 移动端保持单列布局。

## 任务 4：验证和提交

步骤：

- 运行 `npm run test -- practiceSessionReport PracticeSessionReportPanel`。
- 运行 `npm run test`。
- 运行 `npm run build`。
- 运行 `git diff --check`。
- 提交文档：`文档：设计战报准入闸门`。
- 提交功能：`功能：战报显示准入闸门`。
