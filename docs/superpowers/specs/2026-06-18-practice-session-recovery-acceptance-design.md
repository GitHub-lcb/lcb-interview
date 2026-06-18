# 本轮战报错因验收门禁设计

## 背景

本轮战报已经能展示当前队列的错因账本与三步修复计划，但用户还需要知道“修完以后是否真的过线”。如果只给修复动作，没有验收门禁，用户容易把“做过一遍”误判成“已经修好”。

项目里已有 `buildInterviewRecoveryAcceptance(progress, ledger)`，能根据首要错因的关联题和最新评分判断待复测、复测中、已通过或仍未过线。下一步要把它接入本轮战报，并且复用已经队列限定过的本轮错因账本。

## 目标

- 在本轮模拟面试战报中新增“本轮错因验收”。
- 只基于当前队列限定的错因账本和当前队列内评分记录进行验收。
- 展示通过数、总数、失败题、待复测题和主行动。
- Markdown 导出验收状态与题目 ID 清单。
- 面板展示紧凑验收模块，用户能一键进入复测或继续加压。
- 保持完全本地、完全免费，不依赖外部 AI 或后端新增接口。

## 非目标

- 不修改全局错因验收算法。
- 不新增“已验收”持久化字段。
- 不重做错因账本独立页。
- 不打开浏览器验证。

## 方案

在 `practiceSessionReport.ts` 中新增 `buildPracticeSessionRecoveryAcceptance(queue, progress)`：

1. 调用 `buildPracticeSessionMistakeLedger(queue, progress)` 得到队列限定账本。
2. 复用同一套队列过滤上下文，构造只包含当前队列的 `StudyProgress`。
3. 调用 `buildInterviewRecoveryAcceptance(sessionProgress, ledger)`。
4. Markdown 和 UI 都使用该函数，确保状态、题目 ID 和主行动一致。

为了避免复制过滤逻辑，将队列过滤提成私有 helper，例如 `buildPracticeSessionScopedProgress(queue, progress)`，供错因账本和验收门禁共用。

## Markdown 呈现

位置放在“本轮错因账本”和“下一轮训练建议”之间：

```markdown
## 本轮错因验收
- 状态：最新复测仍未过线
- 摘要：还有关联题的最新复测低于 70 分...
- 通过：1 / 2
- 失败题：2
- 待复测：暂无
- 主行动：继续复测...
```

空态提示先完成模拟面试。

## 面板呈现

`PracticeSessionReportPanel` 在错因账本后新增紧凑模块：

- 标题：本轮错因验收
- 摘要：验收摘要
- 指标：通过数、失败题数、待复测题数
- 按钮：跳转到验收主行动

视觉上用红/绿状态边界表达门禁结果，但保持当前战报的密度，不增加独立大卡片。

## 验收标准

- `practiceSessionReport.test.ts` 覆盖本轮错因验收 Markdown、失败态和空态。
- `PracticeSessionReportPanel.test.tsx` 覆盖面板展示验收状态和主行动跳转。
- `npm run test -- practiceSessionReport PracticeSessionReportPanel` 通过。
- `npm run test` 通过。
- `npm run build` 通过。
- `git diff --check` 无空白错误（CRLF 提示可接受）。
