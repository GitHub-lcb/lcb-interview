# 模拟面试本题脚本一键继续动作实施计划

## 现状

- `PracticeInterviewerScriptPanel` 已持有 `scriptProgress.steps`，其中每一步有 `pending`、`attempted`、`passed` 状态。
- 面板已有 `onUsePrompt` 回调，可把指定追问带入回答框。
- 进度区已有“复制进度”按钮。

## 实施步骤

1. 为面板测试补行为用例。
   - 第一问已通过时，点击“继续下一问”应带入第二问 prompt。
   - 第一问修复中时，点击“修复当前问”应带入第一问 prompt。

2. 在 `PracticeInterviewerScriptPanel` 中派生 `nextProgressItem`。
   - 取第一个 `status !== 'passed'` 的步骤。
   - 根据状态计算按钮文案。
   - 点击后调用 `onUsePrompt(nextProgressItem.step.prompt)`。

3. 调整进度区按钮布局。
   - 把“继续下一问 / 修复当前问”和“复制进度”放在同一操作组。
   - 操作组在窄屏换行，避免文字挤压进度摘要。

4. 验证。
   - 目标测试：`npm run test -- PracticeInterviewerScriptPanel`
   - 构建：`npm run build`

## 风险与处理

- 风险：新增按钮和卡片按钮语义重复。
  - 处理：进度区按钮表达“系统建议的下一步”，卡片按钮保留“手动选择任意一步”。
- 风险：全部通过时仍出现继续按钮造成混淆。
  - 处理：没有未通过步骤时不渲染主操作按钮。
