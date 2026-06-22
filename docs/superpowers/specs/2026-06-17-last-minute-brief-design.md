# 最后 24 小时面试简报设计

## 背景

现有学习计划页已经具备每日计划、完成闭环、面试前急救包、面试简报、错题账本和冲刺报告。急救包解决“现在先做哪几个动作”，但用户在临近面试时仍需要一页更稳定的进场材料：哪些题必须复盘、表达主线怎么收束、哪些回答坏习惯要避免、最后应该说什么。

## 目标

- 完全免费，复用浏览器本地学习轨迹，不依赖付费服务和后端新增能力。
- 将最后 24 小时的备考重点压缩成一页“进场简报”。
- 简报必须同时服务页面查看和 Markdown 报告导出。
- 输出可执行动作，按钮能进入 `/practice` 或带题目队列的练习路径。

## 方案

新增 `buildInterviewLastMinuteBrief(progress, now)` 纯函数，聚合以下既有信号：

- `buildInterviewEmergencyKit`：判断是否存在临场高风险动作。
- `buildScheduledReviewQueue`：提取逾期/今日到期题目。
- `buildInterviewMistakeLedger`：提取最高优先级错因。
- `buildInterviewReviewSummary`：识别平均分、最弱评分维度和表达趋势。
- 本地 `questionStates` 与 `questionSnapshots`：生成强项题域和可复盘题目。

函数输出 `InterviewLastMinuteBrief`：

- `level`：`empty`、`risk`、`focused`、`ready`。
- `confidenceScore`：0-100 的进场信心分，用于页面快速扫描。
- `metrics`：面试样本数、复习债、错因数、平均表达分。
- `items`：最多 5 个简报条目，覆盖复盘、表达主线、禁忌、收尾话术和首个样本。
- `primaryAction`：进入最关键动作。

## 页面呈现

新增 `InterviewLastMinuteBriefPanel`，放在 `StudyPlan` 的急救包之后、传统面试简报之前。视觉上使用白底紧凑面板，左侧展示标题、摘要和信心分，右侧展示指标和条目。每个条目都是可点击动作，能直接跳转到练习页。

## 报告导出

`buildSprintReportMarkdown` 在急救包之后插入 `## 最后 24 小时面试简报`，包含状态、信心分、核心指标和前 5 个条目。这样用户导出报告时，可以直接拿到面试前一页清单。

## 测试

- 工具函数测试：覆盖空状态、高风险复习债、错因禁忌、准备充分状态。
- 组件测试：确认面板展示标题、分数、指标和主按钮。
- 报告测试：确认 Markdown 导出包含最后 24 小时简报。

