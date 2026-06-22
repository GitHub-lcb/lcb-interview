# 今日冲刺任务导出 Implementation Plan

**Goal:** 让首页今日冲刺任务支持 Markdown 导出，用户可以免费保存当天最该执行的复习、短板、面试和计划任务。

**Architecture:** 复用 `buildDailyMissionPlan` 的结构化结果新增 `buildDailyMissionMarkdown`。面板只负责复制和下载降级，不改变任务排序算法。

## Task 1: 文档提交

新增设计文档和实施计划。

```bash
git add docs/superpowers/specs/2026-06-18-daily-mission-export-design.md docs/superpowers/plans/2026-06-18-daily-mission-export-implementation.md
git diff --cached --check
git commit -m "文档：设计今日冲刺任务导出"
```

## Task 2: TDD 增加 Markdown 导出测试

在 `frontend/src/utils/dailyMission.test.ts` 中加入：

- 有复习债的进度导出：
  - 标题包含目标岗位和“今日冲刺任务”。
  - 包含生成日期、任务概览、任务清单和 `/study` 入口。
  - 不包含 `undefined`。
- 空进度导出：
  - 包含“生成今日计划”或“首次模拟面试”启动任务。
  - 不包含 `undefined`。

先运行：

```bash
npm run test -- dailyMission
```

预期失败：`buildDailyMissionMarkdown` 尚未导出。

## Task 3: 实现 Markdown 导出函数

在 `frontend/src/utils/dailyMission.ts` 中新增：

- `buildDailyMissionMarkdown(routes, progress, now)`
- `renderDailyMissionOverview(plan)`
- `renderDailyMissionItems(plan.missions)`
- `labelForMissionKind(kind)`
- `formatMarkdownDate(value)`

导出函数只消费 `buildDailyMissionPlan` 输出，保证页面和 Markdown 的任务一致。

再次运行：

```bash
npm run test -- dailyMission
```

预期通过。

## Task 4: 面板接入复制和下载降级

修改 `frontend/src/components/DailyMissionPanel.tsx`：

- 引入 `CopyOutlined`、`message`、`buildDailyMissionMarkdown`
- 任务数量区域增加“复制任务”按钮
- 剪贴板成功提示复制成功，失败下载 Markdown

修改 `frontend/src/styles/global.css`：

- 为任务标题右侧动作区增加紧凑布局。
- 移动端按钮左对齐。

## Task 5: 全量校验和提交

运行：

```bash
npm run test
npm run build
mvn test
git diff --check
```

提交：

```bash
git add frontend/src/utils/dailyMission.test.ts frontend/src/utils/dailyMission.ts frontend/src/components/DailyMissionPanel.tsx frontend/src/styles/global.css
git diff --cached --check
git commit -m "功能：新增今日冲刺任务导出"
```
