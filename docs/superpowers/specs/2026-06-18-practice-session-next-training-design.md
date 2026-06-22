# 本轮战报下一轮训练建议设计

## 背景

本轮模拟面试战报已经能展示队列画像、低分题、补弱动作和复制版 Markdown，但用户完成一轮后还需要自己判断下一轮该从评分影响、复习债、错因本还是今日计划继续。为了让产品更像免费的个人面试教练，战报需要直接给出下一轮训练建议，把“刚完成一轮”自然衔接到“马上开始下一轮”。

用户已经授权持续推进，本阶段不再停下等待额外确认；设计采用最小可验证改动。

## 目标

- 在本轮战报面板中展示下一轮训练建议，包括摘要、入口按钮和最多 3 道优先题。
- 在本轮战报 Markdown 中增加“下一轮训练建议”章节，方便复制到外部笔记后仍能继续执行。
- 复用 `buildNextTrainingQueue` 和 `formatNextTrainingQueueItemMeta`，不重复实现排序策略。
- 队列为空时给出“先做模拟面试或生成今日计划”的行动入口。

## 非目标

- 不调整下一轮训练队列排序算法。
- 不新增后端接口或持久化字段。
- 不引入浏览器验证；本轮按用户要求仅做命令行测试和构建。

## 方案

`PracticeSessionReportPanel` 使用当前 `progress` 计算 `buildNextTrainingQueue(progress, now, 3)`，在队列画像和补弱动作之间加入一个紧凑的“下一轮训练”区域。主按钮进入 `primaryAction.to`，列表项进入各自 `item.to`。

`buildPracticeSessionReportMarkdown` 复用同一队列构建函数，导出标题、摘要、主入口和最多 5 道下一轮题目。Markdown 中保留来源、状态、原因和入口，保证用户复制后不丢行动上下文。

## 验收标准

- 战报面板能显示“下一轮训练”、队列摘要、优先题标题和“开始下一轮训练”按钮。
- 点击主按钮会导航到下一轮队列入口。
- 复制战报 Markdown 包含“## 下一轮训练建议”和题目入口。
- 空队列时仍显示可执行入口，不出现 `undefined`。
- `npm run test -- practiceSessionReport PracticeSessionReportPanel`、`npm run test`、`npm run build` 通过。
