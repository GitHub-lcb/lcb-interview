# 本轮战报队列画像设计

## 背景

练习页已经支持 `/practice?queue=...`，首页指挥中心、学习计划页、日报和冲刺报告都会把用户带到一组个性化训练题。当前“本轮模拟面试战报”能导出本轮摘要、指标、补弱动作和题目队列，但题目队列里的来源和状态仍偏技术化，用户很难一眼判断这组队列从哪里来、下一步该补哪道、还有几道没答。

## 目标

- 在 `buildPracticeSessionReportMarkdown` 中增加 `## 队列画像`。
- 用中文输出来源构成、下一题、未答题、低分/薄弱题和队列入口。
- 继续复用现有 `PracticeQueueItem` 和 `StudyProgress`，不改变评分、状态同步或队列排序逻辑。
- 空队列仍保持可执行提示，不出现 `undefined`。

## 非目标

- 不改练习页 UI。
- 不新增后端接口。
- 不改变 `buildPracticeSessionReport` 的通过/补弱判定。

## Markdown 结构

```md
## 队列画像
- 来源构成：今日计划 2 道、复习优先 1 道
- 下一题：Java 面试题 3（Java 基础，未评分）
- 未答题：3
- 低分/薄弱题：1, 2, 3
- 队列入口：/practice?queue=1,2,3
```

## 验收标准

- 有题队列导出包含 `## 队列画像`、来源构成、下一题和队列入口。
- 空队列导出包含 `暂无队列画像`。
- `npm run test -- practiceSessionReport` 通过。
- `npm run test`、`npm run build` 通过。
