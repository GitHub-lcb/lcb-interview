# 冲刺报告追问防线导出设计

## 背景

学习页已经新增“面试追问防线”，能把最近模拟面试里最容易被连续追问的问题聚合出来。但冲刺报告复制到外部文档后仍缺少这部分信息，用户离线复盘时会看到健康度、急救包和素材库，却看不到“今天最该防守哪些追问”。

## 目标

- 在 `buildSprintReportMarkdown` 中新增“面试追问防线”章节。
- 复用 `buildInterviewFollowUpDefense(progress)`，不重复计算追问优先级。
- 导出防线标题、摘要、指标和最多 5 条追问。
- 空状态也输出行动入口，保证空报告不出现信息断层。
- 在“下一步行动”里增加追问防线主行动。

## 方案

在 `sprintReport.ts` 中新增：

1. `followUpDefense = buildInterviewFollowUpDefense(progress)`。
2. `renderFollowUpDefenseSection(followUpDefense)`。
3. 将章节放在“高分表达素材库”之后、“备考健康度”之前。
4. 将 `followUpDefense.primaryAction` 补入 `renderActionSection`。

章节格式：

```md
## 面试追问防线
- 状态：先补高风险追问
- 摘要：发现 1 道低分回答...
- 防线追问：5，今日优先演练
- 最近均分：62 分，仍需加压
- Java 并发 题目 1：如果面试官追问线上场景...；面试官在追项目场景...；入口：/practice?queue=1
```

## 测试

- 扩展 `sprintReport.test.ts` 的非空报告用例，断言导出追问防线章节、风险标题、追问条目和下一步行动。
- 扩展空报告用例，断言追问防线空状态和 `/practice` 行动入口。
- 跑 `npm run test -- sprintReport` 完成 red/green。
- 最后跑前端全测、生产构建、后端测试和 `git diff --check`。
