# 本轮战报面板队列画像设计

## 背景

本轮战报导出已经新增队列画像，但练习页侧栏的战报面板仍只显示指标和补弱动作。用户在训练时需要先知道本轮题目来自哪里、下一题是谁、还有哪些题没答。队列画像应该前移到页面内，而不是只存在于复制后的 Markdown。

## 目标

- `buildPracticeSessionReport` 输出结构化 `queueProfile`。
- `PracticeSessionReportPanel` 在指标后展示队列画像：来源构成、下一题、未答数、薄弱数和队列入口。
- Markdown 导出复用 `queueProfile`，避免页面和导出分叉。
- 空队列时仍展示可执行提示。

## 非目标

- 不改变本轮战报等级判断。
- 不改变练习页主队列排序。
- 不新增接口或持久化字段。

## 页面呈现

在战报指标下方新增 `practice-session-report-profile`：

- 标题：队列画像
- 来源构成：例如 `今日计划 2 道、复习优先 1 道`
- 下一题：例如 `Java 面试题 3`
- 指标：未答、薄弱
- 按钮：进入队列，跳转 `queueProfile.queuePath`

## 验收标准

- 面板测试能看到“队列画像”“今日计划 2 道”“Java 面试题 2”。
- 点击“进入队列”会调用 `onNavigate('/practice?queue=1,2')`。
- 空队列面板显示“暂无队列画像”。
- `npm run test -- practiceSessionReport PracticeSessionReportPanel` 通过。
