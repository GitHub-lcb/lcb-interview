# 冲刺报告今日任务导出设计

## 背景

首页已经有“今日冲刺任务”，会综合复习到期、岗位短板、模拟面试表现和今日计划给出 4 条以内的行动优先级。但冲刺报告导出还没有包含这份任务清单，用户复制报告后只能看到较多诊断章节，缺少“今天先做哪几件事”的执行入口。

## 目标

- 在 `buildSprintReportMarkdown` 中新增“今日冲刺任务”章节。
- 复用 `buildDailyMissionPlan(routes, progress, now)`，不重复实现任务排序和去重逻辑。
- 导出任务标题、摘要、指标、原因和入口。
- 空进度也要导出“生成今日计划 / 完成首次模拟面试”等启动任务。
- 在“下一步行动”里增加今日任务最高优先级行动。

## 方案

在 `sprintReport.ts` 中新增：

1. `dailyMission = buildDailyMissionPlan(routes, progress, now)`。
2. `renderDailyMissionSection(dailyMission)`。
3. 将章节放在“一页作战摘要”之后、“面试前急救包”之前。
4. `renderActionSection` 增加 `dailyMission` 参数，并在任务存在时输出首个任务。

章节格式：

```md
## 今日冲刺任务
- 摘要：系统已根据复习到期、岗位短板、面试表现和今日计划排好优先级。
- 任务数：4
- 1. 先补逾期复习：1 道题已经逾期...；来自智能复习排期；1 道；入口：/study
```

## 测试

- 扩展 `sprintReport.test.ts` 非空报告用例，断言“今日冲刺任务”、任务来源和“今日任务：”下一步行动。
- 扩展空报告用例，断言“完成首次模拟面试”和“生成今日计划”。
- 跑 `npm run test -- sprintReport` 完成 red/green。
- 最后跑前端全测、生产构建、后端测试和 `git diff --check`。
