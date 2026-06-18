# 模拟面试战报下一轮启动包实施计划

## 目标

新增“下一轮启动包”，把准入闸门的裁决转成可执行的开局动作，减少用户从“知道该做什么”到“马上开始做”的摩擦。

## 架构

基于 `buildPracticeSessionAdvanceGate` 和 `buildPracticeSessionNextTrainingQueue` 派生 `PracticeSessionLaunchPacket`。继续保持纯前端派生，不新增后端接口和持久化。

## 任务 1：补失败测试

涉及文件：

- `frontend/src/utils/practiceSessionReport.test.ts`
- `frontend/src/components/PracticeSessionReportPanel.test.tsx`

步骤：

- Markdown 测试断言包含 `## 下一轮启动包`、`回修启动包`、`打开启动入口`、`完成口径`、`主行动：`。
- 空队列 Markdown 测试断言包含 `等待建立启动样本`。
- 组件测试断言存在 `aria-label="下一轮启动包"`、关键动作和主按钮跳转。
- 运行聚焦测试，确认生产代码缺失导致失败。

## 任务 2：实现模型和 Markdown

涉及文件：

- `frontend/src/types.ts`
- `frontend/src/utils/practiceSessionReport.ts`

步骤：

- 新增 `PracticeSessionLaunchPacketStatus`、`PracticeSessionLaunchPacketItem`、`PracticeSessionLaunchPacket`。
- 新增 `buildPracticeSessionLaunchPacket(queue, progress, now)`。
- 在 Markdown 中把 `renderSessionLaunchPacket` 放在准入闸门之后、下一轮训练之前。
- 运行聚焦测试，确认 Markdown 断言通过。

## 任务 3：实现面板和样式

涉及文件：

- `frontend/src/components/PracticeSessionReportPanel.tsx`
- `frontend/src/styles/global.css`

步骤：

- 导入并 memoize `buildPracticeSessionLaunchPacket`。
- 在准入闸门之后渲染启动包。
- 补充空态、修复态、推进态样式。
- 移动端保持单列布局。

## 任务 4：验证和提交

步骤：

- 运行 `npm run test -- practiceSessionReport PracticeSessionReportPanel`。
- 运行 `npm run test`。
- 运行 `npm run build`。
- 运行 `git diff --check`。
- 提交文档：`文档：设计战报启动包`。
- 提交功能：`功能：战报显示启动包`。
