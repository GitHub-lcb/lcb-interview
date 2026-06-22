# 模拟面试战报补弱重答模板实施计划

## 范围

前端单体改造，涉及：

- `frontend/src/utils/practiceSessionReport.ts`
- `frontend/src/components/PracticeSessionReportPanel.tsx`
- `frontend/src/pages/Practice/index.tsx`
- 对应测试文件

## 步骤

1. 在工具层新增 `buildPracticeSessionRepairDraft`，从 `PracticeSessionRepairAction` 生成中文重答模板。
2. 为工具层补测试，覆盖结构化维度和无评分薄弱题兜底。
3. 扩展 `PracticeSessionReportPanel`，允许“去补弱”优先调用 `onUseRepairAction`，没有回调时继续走原跳转。
4. 为面板补测试，确认点击补弱动作会把 action 回传给上层。
5. 在练习页接入回调：
   - 当前题就是目标题时立即写入答案框。
   - 目标题在队列内但不是当前题时，暂存模板，切题后由 `current.id` effect 写入。
   - 不在队列内时走已有跳转。
6. 运行聚焦测试、全量测试和构建。
7. 使用中文提交信息提交。

## 风险控制

- 不改后端和数据结构持久化，降低回归面。
- 模板生成集中在工具函数，避免 UI 拼接业务文案。
- 题目切换 effect 必须识别待应用模板，避免先写入又被清空。
