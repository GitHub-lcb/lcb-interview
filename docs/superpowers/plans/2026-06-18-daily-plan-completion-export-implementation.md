# 今日闭环验收导出 Implementation Plan

**Goal:** 让今日闭环验收支持 Markdown 导出，用户可以免费保存当天完成率、风险项、待办验收和主行动。

**Architecture:** 复用 `buildDailyPlanCompletion` 的结构化结果新增 `buildDailyPlanCompletionMarkdown`。面板只负责复制和下载降级，不重新计算业务状态。

## Task 1: 文档提交

新增设计文档和实施计划，明确导出字段、按钮位置、降级策略和测试范围。

```bash
git add docs/superpowers/specs/2026-06-18-daily-plan-completion-export-design.md docs/superpowers/plans/2026-06-18-daily-plan-completion-export-implementation.md
git diff --cached --check
git commit -m "文档：设计今日闭环验收导出"
```

## Task 2: TDD 增加纯函数导出测试

在 `frontend/src/utils/dailyPlanCompletion.test.ts` 中加入：

- 风险状态导出 Markdown：
  - 标题包含目标岗位和“今日闭环验收”。
  - 包含生成日期、验收概览、指标、待办验收、主行动。
  - 包含待办入口。
  - 不包含 `undefined`。
- 空状态导出 Markdown：
  - 包含“今日计划待验收”。
  - 包含“今日计划还没生成”。
  - 不包含 `undefined`。

先运行：

```bash
npm run test -- dailyPlanCompletion
```

预期失败：`buildDailyPlanCompletionMarkdown` 尚未导出。

## Task 3: 实现 Markdown 导出函数

在 `frontend/src/utils/dailyPlanCompletion.ts` 中新增：

- `buildDailyPlanCompletionMarkdown(progress, now)`
- `renderDailyCompletionOverview(completion)`
- `renderDailyCompletionMetrics(completion.metrics)`
- `renderDailyCompletionTodos(completion.todos)`
- `renderDailyCompletionPrimaryAction(completion.primaryAction)`
- `formatMarkdownDate(value)`

导出内容只使用 `buildDailyPlanCompletion` 返回结构，避免与页面计算产生分叉。

再次运行：

```bash
npm run test -- dailyPlanCompletion
```

预期通过。

## Task 4: TDD 增加面板复制测试

在 `frontend/src/components/DailyPlanCompletionPanel.test.tsx` 中加入：

- mock `navigator.clipboard.writeText`
- 渲染完成状态面板
- 点击“复制验收”
- 断言写入内容包含“# Java 后端 今日闭环验收”和当前状态标题

先运行：

```bash
npm run test -- DailyPlanCompletionPanel
```

预期失败：按钮尚不存在。

## Task 5: 面板接入复制和下载降级

修改 `frontend/src/components/DailyPlanCompletionPanel.tsx`：

- 引入 `CopyOutlined`、`message`、`buildDailyPlanCompletionMarkdown`
- 增加 `handleCopyCompletion`
- 分数区增加小按钮“复制验收”
- 剪贴板成功提示复制成功，失败下载 Markdown

修改 `frontend/src/styles/global.css`：

- 为分数区动作按钮增加紧凑布局。
- 移动端保持左对齐，不挤压完成率。

再次运行：

```bash
npm run test -- DailyPlanCompletionPanel
```

预期通过。

## Task 6: 全量校验和提交

运行：

```bash
npm run test
npm run build
mvn test
git diff --check
```

提交：

```bash
git add frontend/src/utils/dailyPlanCompletion.test.ts frontend/src/utils/dailyPlanCompletion.ts frontend/src/components/DailyPlanCompletionPanel.test.tsx frontend/src/components/DailyPlanCompletionPanel.tsx frontend/src/styles/global.css
git diff --cached --check
git commit -m "功能：新增今日闭环验收导出"
```
