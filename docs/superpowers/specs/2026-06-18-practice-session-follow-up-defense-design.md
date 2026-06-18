# 本轮战报追问防线快照设计

## 背景

本轮战报已经具备队列画像、今日闭环、下一轮训练和高分素材沉淀。下一步需要把“答完以后面试官可能怎么继续压”也放进本轮战报，让用户在同一份报告里完成复盘、素材沉淀和追问防守。

## 目标

- 在本轮模拟面试战报中新增“本轮追问防线”。
- 只展示当前练习队列内的追问防线，避免把全局历史追问混进本轮结果。
- 复用现有 `buildInterviewFollowUpDefense` 算法，保持追问生成、压力点和回答引导一致。
- Markdown 导出可复制的追问清单，面板展示最多 3 条高优先级追问。
- 保持完全本地、完全免费，不依赖外部 AI 服务。

## 非目标

- 不修改全局追问防线算法。
- 不新增题目、答案或追问的后端存储。
- 不重做视觉布局，不打开浏览器验证。

## 方案

在 `practiceSessionReport.ts` 中新增 `buildPracticeSessionFollowUpDefense(queue, progress)`：

1. 使用 `buildPracticeSessionProgressContext(queue, progress)` 补齐本轮临时队列的题目快照。
2. 只保留当前队列题目的 `interviewAttempts`。
3. 调用 `buildInterviewFollowUpDefense` 生成本轮追问防线。

Markdown 和 UI 都复用这个导出函数，避免两个入口出现排序或空态差异。

## Markdown 呈现

在“本轮高分素材”和“下一轮训练建议”之间新增：

```markdown
## 本轮追问防线
- 状态：...
- 摘要：...
- 主行动：...
1. 题目标题
   - 维度：结构化
   - 得分：62 分
   - 追问：...
   - 压力点：...
   - 回答引导：...
   - 入口：/practice?queue=1
```

空态提示用户先完成一次模拟面试，系统才会生成可防守追问。

## 面板呈现

`PracticeSessionReportPanel` 在“本轮高分素材”和“下一轮训练”之间新增紧凑模块：

- 标题：本轮追问防线
- 摘要：复用防线报告摘要
- 按钮：跳转到防线主行动
- 列表：最多 3 条，展示题目、维度/得分、追问压力点

## 验收标准

- `practiceSessionReport.test.ts` 覆盖 Markdown 的本轮追问防线和空态。
- `PracticeSessionReportPanel.test.tsx` 覆盖面板展示追问防线和点击追问题目跳转。
- `npm run test -- practiceSessionReport PracticeSessionReportPanel` 通过。
- `npm run test` 通过。
- `npm run build` 通过。
- `git diff --check` 无空白错误（CRLF 提示可接受）。
