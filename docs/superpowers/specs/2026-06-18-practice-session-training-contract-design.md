# 下一轮训练契约设计

## 背景

当前战报已经能输出二次提交稿、通过门槛和过线证据包。下一步需要把这些判断转成真正的学习闭环：下一轮到底练什么、目标是什么、怎样算过线、带着哪条证据复盘。

## 目标

新增“下一轮训练契约”模块，在用户进入下一轮前给出明确契约：

- 目标分：下一轮要达到的评分目标。
- 训练题组：下一轮要进入的队列入口和题量。
- 验收口径：下一轮结束后如何判断是否通过。
- 复盘证据：下一轮重点对照哪类证据修复。

模块必须出现在“本轮过线证据包”和“下一轮训练”之间，作为从复盘到训练的桥梁。Markdown 导出必须包含同样内容。

## 设计

新增前端纯函数 `buildPracticeSessionTrainingContract(queue, progress, now)`，复用：

- `buildPracticeSessionReport`
- `buildPracticeSessionPassGate`
- `buildPracticeSessionPassEvidence`
- `buildPracticeSessionNextTrainingQueue`

状态规则：

- `empty`：没有题目或没有开口样本，提示先建立训练契约样本。
- `repair`：通过门槛阻塞，契约目标是回到本轮队列，把均分补到 80 分并清掉弱项。
- `advance`：通过门槛已通过，契约目标是进入下一轮个性化队列并保持强通过。

## UI

使用紧凑四项契约列表，不做嵌套卡片。每项包含标签、值和解释。主按钮根据状态指向当前最合理入口：

- repair：回到本轮队列修复。
- advance：进入下一轮训练队列。
- empty：进入模拟面试建立样本。

## 测试

- 工具层测试 Markdown 包含“下一轮训练契约”、目标分、训练题组、验收口径、复盘证据和主行动。
- 空队列测试等待态。
- 组件测试断言模块渲染和按钮导航。
- 跑 `npm run test -- practiceSessionReport PracticeSessionReportPanel`、`npm run test`、`npm run build`。
