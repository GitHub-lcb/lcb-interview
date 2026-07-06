# 本轮战报高分素材快照设计

## 背景

当前本轮模拟面试战报已经能给出队列画像、今日闭环和下一轮训练建议，但用户在一轮训练结束后还缺少“把答得好的内容立刻沉淀下来”的出口。普通题库通常停留在题目和答案层，本项目要继续往“免费智能训练闭环”推进：每次练习都自动沉淀可复用表达资产。

## 目标

在本轮模拟面试战报中新增“本轮高分素材”快照：

- 只基于当前练习队列内的模拟面试尝试，避免全局素材库污染本轮战报。
- 复用既有高分素材提取规则，优先沉淀 80 分以上回答中的风险边界、项目场景和结论表达。
- Markdown 战报可导出本轮素材清单，方便复制到简历、复盘笔记或面试前清单。
- 战报面板展示最多 3 条本轮高分素材，并保留“沉淀素材/继续训练”的主行动入口。

## 非目标

- 不新增后端表，不做云端同步。
- 不修改全局高分素材库算法的阈值与排序规则。
- 不引入 AI 或外部服务，保持完全免费和本地可用。
- 不打开浏览器做视觉验证，遵守当前“NO web browser”约束。

## 方案

采用“战报派生上下文 + 复用素材库”的方案。`practiceSessionReport.ts` 已经有 `buildPracticeSessionProgressContext`，能把临时队列题目补进快照、状态和今日计划上下文。新增 `buildPracticeSessionMaterialVault(queue, progress)`，先基于该上下文调用 `buildInterviewMaterialVault`，再过滤出当前队列题目对应的素材。

这样做的好处是：

- 复用既有高分素材能力，不复制句子提取、阈值和排序规则。
- 战报只展示本轮素材，语义更清晰。
- 对全局学习进度零写入，不改变用户本地数据。

## Markdown 呈现

`buildPracticeSessionReportMarkdown` 在“今日闭环快照”和“下一轮训练建议”之间新增：

```markdown
## 本轮高分素材
- 状态：...
- 摘要：...
- 主行动：...
1. 题目标题
   - 类型：项目场景
   - 得分：86 分
   - 片段：...
   - 原因：...
   - 入口：/question/1
```

没有高分素材时输出明确的空态文案，提示先完成 80 分以上模拟回答。

## 面板呈现

`PracticeSessionReportPanel` 在“今日闭环”和“下一轮训练”之间增加一块紧凑区域：

- 标题：本轮高分素材
- 摘要：素材库状态和本轮素材数量
- 按钮：沿用素材库主行动
- 列表：最多 3 条素材，展示题目、类型、分数和片段

样式延续战报面板的 8px 圆角、紧凑信息密度和单行截断，不引入大卡片或营销式布局。

## 验收标准

- `practiceSessionReport.test.ts` 覆盖 Markdown 导出本轮高分素材和空态。
- `PracticeSessionReportPanel.test.tsx` 覆盖面板展示“本轮高分素材”、素材片段和点击导航。
- `npm run test -- practiceSessionReport PracticeSessionReportPanel` 通过。
- `npm run test` 通过。
- `npm run build` 通过。
- `git diff --check` 无空白错误（CRLF 提示可接受）。
