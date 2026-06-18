# 模拟面试战报启动执行清单实施计划

## 目标

新增“启动执行清单”，把下一轮启动包的动作转成可复制、可核销、可复盘的证据模板，补齐启动阶段的学习闭环。

## 架构

基于 `buildPracticeSessionLaunchPacket` 派生 `PracticeSessionLaunchChecklist`。继续保持纯前端派生，不新增后端接口和持久化。

## 任务 1：补失败测试

涉及文件：

- `frontend/src/utils/practiceSessionReport.test.ts`
- `frontend/src/components/PracticeSessionReportPanel.test.tsx`

步骤：

- Markdown 测试断言包含 `## 启动执行清单`、`证据模板`、`复盘问题`、`完成口径`、`主行动：`。
- 空队列 Markdown 测试断言包含 `等待生成启动执行清单`。
- 组件测试断言存在 `aria-label="启动执行清单"`、关键清单项和主按钮跳转。
- 运行聚焦测试，确认生产代码缺失导致失败。

## 任务 2：实现模型和 Markdown

涉及文件：

- `frontend/src/types.ts`
- `frontend/src/utils/practiceSessionReport.ts`

步骤：

- 新增 `PracticeSessionLaunchChecklistStatus`、`PracticeSessionLaunchChecklistItem`、`PracticeSessionLaunchChecklist`。
- 新增 `buildPracticeSessionLaunchChecklist(queue, progress, now)`。
- 在 Markdown 中把 `renderSessionLaunchChecklist` 放在启动包之后、下一轮训练之前。
- 运行聚焦测试，确认 Markdown 断言通过。

## 任务 3：实现面板和样式

涉及文件：

- `frontend/src/components/PracticeSessionReportPanel.tsx`
- `frontend/src/styles/global.css`

步骤：

- 导入并 memoize `buildPracticeSessionLaunchChecklist`。
- 在启动包之后渲染执行清单。
- 补充空态、修复态、推进态样式。
- 移动端保持单列布局。

## 任务 4：验证和提交

步骤：

- 运行 `npm run test -- practiceSessionReport PracticeSessionReportPanel`。
- 运行 `npm run test`。
- 运行 `npm run build`。
- 运行 `git diff --check`。
- 提交文档：`文档：设计战报启动执行清单`。
- 提交功能：`功能：战报显示启动执行清单`。
