# 冲刺报告错题恢复验收导出设计

## 背景

学习页的面试错因本已经包含“错题恢复验收”，可以判断首要错因是否通过最新模拟面试复测。但冲刺报告目前只导出错因账本和恢复计划，缺少“修完了吗”的结果判断。用户复制报告后仍需要回到页面确认恢复是否过线。

## 目标

- 在 `buildSprintReportMarkdown` 中新增“错题恢复验收”章节。
- 复用 `buildInterviewRecoveryAcceptance(progress, mistakeLedger)`，不重复实现验收判断。
- 导出验收状态、摘要、通过数量、未通过题目、待复测题目和主行动。
- 空状态同样输出，提醒先建立模拟面试样本。
- 在“下一步行动”中增加错题验收行动线。

## 方案

在 `sprintReport.ts` 中新增：

1. `recoveryAcceptance = buildInterviewRecoveryAcceptance(progress, mistakeLedger)`。
2. `renderRecoveryAcceptanceSection(recoveryAcceptance)`。
3. 将章节放在“错题恢复计划”之后、“下一步行动”之前。
4. 将 `recoveryAcceptance.primaryAction` 加入 `renderActionSection`。

章节格式：

```md
## 错题恢复验收
- 状态：最新复测仍未过线
- 摘要：还有关联题的最新复测低于 70 分...
- 已验收：0/1
- 已过线题目：暂无
- 未过线题目：1
- 待复测题目：暂无
- 行动：继续复测 - ...（/practice?queue=1）
```

## 测试

- 扩展 `sprintReport.test.ts` 非空用例，断言导出“错题恢复验收”、失败状态、验收数量和下一步行动。
- 扩展空报告用例，断言“等待建立验收样本”和模拟入口。
- 跑 `npm run test -- sprintReport` 完成 red/green。
- 最后跑前端全测、生产构建、后端测试和 `git diff --check`。
