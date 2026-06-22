# 本轮战报错因账本设计

## 背景

本轮模拟面试战报已经覆盖队列画像、今日闭环、高分素材、追问防线、脚本总控和下一轮训练。现在仍缺一个关键视角：用户低分或卡住时，战报只告诉他“哪题要补”，还没有明确告诉他“错因是什么、按什么闭环恢复”。

项目里已经有全局 `buildInterviewMistakeLedger` 和 `buildInterviewRecoveryPlan`，能根据低分维度、薄弱未开口题和稳定高分状态生成错因本与修复计划。下一步要把这套能力限定到当前练习队列，放进本轮战报，避免全局历史污染当前复盘。

## 目标

- 在本轮模拟面试战报中新增“本轮错因账本”。
- 只分析当前练习队列内的题目、评分记录和薄弱状态。
- 复用现有 `buildInterviewMistakeLedger` 和 `buildInterviewRecoveryPlan`。
- Markdown 导出首要错因、影响题目、三步修复计划和入口。
- 面板展示最多 3 个错因项，并展示修复计划首步行动。
- 保持完全本地、完全免费，不依赖外部 AI 或后端新增接口。

## 非目标

- 不修改全局错因账本算法。
- 不重做错因账本独立页面。
- 不新增数据库或本地存储字段。
- 不打开浏览器验证。

## 方案

在 `practiceSessionReport.ts` 中新增 `buildPracticeSessionMistakeLedger(queue, progress)`：

1. 使用 `buildPracticeSessionProgressContext(queue, progress)` 补齐临时队列上下文。
2. 构造当前队列 ID 集合。
3. 过滤 `questionStates`、`questionSnapshots`、`interviewAttempts` 和 `dailyPlan`，只保留队列内题目。
4. 调用 `buildInterviewMistakeLedger(sessionProgress)` 得到本轮错因账本。
5. Markdown 和 UI 再基于账本调用 `buildInterviewRecoveryPlan(ledger)`，生成修复计划。

这样全局错因算法继续保持单一来源，本轮战报只负责“限定输入范围”和“呈现当前队列结果”。

## Markdown 呈现

位置放在“本轮脚本总控”和“下一轮训练建议”之间：

```markdown
## 本轮错因账本
- 状态：面试错因本
- 摘要：已定位 1 类高频表达问题...
- 问题数：2
- 修复计划：三步修复首要错因，37 分钟
- 主行动：回炉训练...

1. 场景细节反复失分
   - 类型：criterion
   - 平均分：42
   - 影响题目：1, 2
   - 最近题目：HashMap 为什么线程不安全？
   - 动作：回炉训练
   - 入口：/practice?queue=1,2

修复计划：
1. 场景细节反复失分回炉训练，12 分钟，入口：/practice?queue=1,2
```

空态提示用户先完成一次模拟面试。

## 面板呈现

`PracticeSessionReportPanel` 在“本轮脚本总控”和“下一轮训练”之间新增紧凑模块：

- 标题：本轮错因账本
- 摘要：账本摘要
- 主按钮：跳转到账本主行动
- 指标：问题数、计划分钟数
- 列表：最多 3 个错因项，展示错因标签、平均分/影响题目、最近题目
- 修复首步：展示恢复计划第一步标题和行动按钮

视觉上使用琥珀/中性色，保持和“补弱动作”区分：错因账本是诊断 + 计划，补弱动作是具体题目重答模板。

## 验收标准

- `practiceSessionReport.test.ts` 覆盖本轮错因账本 Markdown、空态和队列过滤。
- `PracticeSessionReportPanel.test.tsx` 覆盖面板展示错因账本和错因项跳转。
- `npm run test -- practiceSessionReport PracticeSessionReportPanel` 通过。
- `npm run test` 通过。
- `npm run build` 通过。
- `git diff --check` 无空白错误（CRLF 提示可接受）。
