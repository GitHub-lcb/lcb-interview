# 本轮过线证据包设计

## 背景

“本轮通过门槛”已经告诉用户能否进入下一轮，但用户还需要一份更便于复盘、复制和解释的证据包：为什么系统认为当前可以推进，或者为什么必须先修复。

## 目标

新增“本轮过线证据包”模块，把战报中的关键证据压缩成 4 条可复盘证据：

- 评分证据：本轮均分和通过题数。
- 完成证据：本轮题目是否答完。
- 弱项证据：弱题数量和最低能力雷达。
- 提交证据：二次提交稿是否可用。

每条证据必须包含证据值、解释和下一步动作。Markdown 导出必须包含同样内容，方便用户复制到个人复盘记录。

## 设计

实现一个前端纯函数 `buildPracticeSessionPassEvidence(queue, progress)`：

- 复用 `buildPracticeSessionReport`、`buildPracticeSessionAbilityRadar`、`buildPracticeSessionRetryDrafts` 和 `buildPracticeSessionPassGate`。
- 空队列或未答题时返回 `empty`，提示先建立证据样本。
- 若通过门槛阻塞，状态为 `blocked`，摘要说明最关键证据不足。
- 若通过门槛就绪，状态为 `ready`，摘要说明可以带着证据包进入下一轮。

UI 放在“本轮通过门槛”之后，“下一轮训练”之前。它是通过门槛的解释层，不重复渲染门槛判断，而是展示证据值、解释和动作。

## 测试

- 工具层测试 Markdown 包含“本轮过线证据包”、4 类证据和主行动。
- 空队列测试等待态。
- 组件测试断言模块渲染、证据标签展示、按钮导航。
- 跑 `npm run test -- practiceSessionReport PracticeSessionReportPanel`、`npm run test`、`npm run build`。
