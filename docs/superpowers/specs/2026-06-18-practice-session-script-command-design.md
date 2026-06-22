# 本轮战报面试官脚本总控设计

## 背景

本轮战报已经串起队列画像、今日闭环、下一轮训练、高分素材和追问防线。单题页也已经有“本题面试官脚本”和“本题脚本进度”，但用户完成一轮模拟面试后，战报仍缺少一个总控视角来回答：

- 本轮哪些题的面试官脚本已经被打穿？
- 哪些题卡在“追问已尝试但未通过”？
- 下一步应该先练哪一道题、哪一个追问？

如果没有这个总控，用户会在每道题之间来回点，复盘成本高。要做到明显强于普通题库网站，战报需要像面试教练一样直接给出本轮追问脚本推进路线。

## 目标

- 在本轮模拟面试战报中新增“本轮脚本总控”。
- 汇总当前练习队列内每道题的 `buildPracticeInterviewerScriptProgress` 结果。
- 输出本轮总题数、总脚本步数、已通过步数、修复中步数和整体通过率。
- 选出一个最该处理的脚本项作为主行动，优先级为：修复中题目 > 已开始但未完成题目 > 队列第一道待练题 > 全部通过后的复练。
- Markdown 导出完整总控清单，UI 展示最多 3 道高优先级题。
- 保持完全本地、完全免费，不依赖外部 AI 或后端新增接口。

## 非目标

- 不修改单题面试官脚本的生成算法。
- 不修改脚本追问验收规则。
- 不新增持久化字段。
- 不打开浏览器验证。

## 方案

新增 `buildPracticeSessionScriptCommand(queue, progress)`，位于 `frontend/src/utils/practiceSessionReport.ts` 或同目录下的轻量辅助模块。为了控制改动范围，本轮先放在 `practiceSessionReport.ts` 中并导出，后续如果战报继续膨胀再拆分。

数据流：

1. 遍历当前 `queue`。
2. 对每道题读取 `progress.interviewAttempts[question.id]`。
3. 调用 `buildPracticeInterviewerScriptProgress(question, attempts)` 得到单题脚本进度。
4. 派生本轮总控项：
   - `questionId`
   - `title`
   - `to`
   - `scriptTitle`
   - `summary`
   - `totalSteps`
   - `passedCount`
   - `attemptedCount`
   - `progressPercent`
   - `nextPrompt`
   - `status`
5. 按状态和进度排序，生成主行动与最多 5 条 Markdown 清单。

## 状态规则

- `empty`：队列为空。
- `complete`：队列非空，所有脚本步骤均已通过。
- `repair`：存在修复中脚本步骤。
- `active`：存在部分通过但仍未完成的题。
- `pending`：有队列但还没有任何脚本步骤通过或尝试。

排序优先级：

1. `repair` 项优先，因为用户已经暴露了追问断点。
2. `active` 项次之，避免半途而废。
3. `pending` 项按队列顺序进入第一问。
4. `complete` 项放后面，用于复练和沉淀。

## Markdown 呈现

位置放在“本轮追问防线”和“下一轮训练建议”之间：

```markdown
## 本轮脚本总控
- 状态：脚本追问需要修复
- 总进度：2 / 9（22%）
- 修复中：1 道
- 主行动：修复当前脚本追问，回到 /practice?queue=1

1. Java 面试题 1
   - 脚本阶段：低分修复追问
   - 进度：1 / 3（33%）
   - 状态：修复中
   - 下一问：请围绕...
   - 入口：/practice?queue=1
```

空态提示用户先建立本轮队列。

## 面板呈现

`PracticeSessionReportPanel` 在“本轮追问防线”和“下一轮训练”之间新增紧凑模块：

- 标题：本轮脚本总控
- 摘要：状态标题和总通过率
- 主按钮：跳转到总控主行动
- 列表：最多 3 道题，展示题目、脚本阶段、进度和下一问摘要

视觉上沿用当前战报卡片语言，保持 8px 圆角、紧凑间距、可扫描信息密度。

## 验收标准

- `practiceSessionReport.test.ts` 覆盖本轮脚本总控 Markdown、空态和只读取当前队列题目。
- `PracticeSessionReportPanel.test.tsx` 覆盖面板展示脚本总控、主行动跳转和题目跳转。
- `npm run test -- practiceSessionReport PracticeSessionReportPanel` 通过。
- `npm run test` 通过。
- `npm run build` 通过。
- `git diff --check` 无空白错误（CRLF 提示可接受）。
