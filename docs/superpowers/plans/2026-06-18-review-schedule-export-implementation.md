# 智能复习队列导出 Implementation Plan

**Goal:** 让学习计划页的智能复习队列支持 Markdown 导出，用户可以免费保存复习债、到期原因和题目入口。

**Architecture:** 在 `reviewSchedule` 中新增 `buildReviewScheduleMarkdown` 纯函数，复用 `buildScheduledReviewQueue` 和 `summarizeReviewSchedule` 的结果。`StudyPlan` 页面只接入复制和下载降级，不重复计算业务规则。

## Task 1: 文档提交

新增设计文档和实施计划，明确导出结构、按钮位置、降级策略和测试范围。

```bash
git add docs/superpowers/specs/2026-06-18-review-schedule-export-design.md docs/superpowers/plans/2026-06-18-review-schedule-export-implementation.md
git diff --cached --check
git commit -m "文档：设计智能复习队列导出"
```

## Task 2: TDD 增加纯函数导出测试

在 `frontend/src/utils/reviewSchedule.test.ts` 中加入：

- 非空队列导出：
  - 标题包含目标岗位和“智能复习队列”。
  - 包含生成日期、排期概览、复习队列、题目、到期状态、调度原因和入口。
  - 不包含 `undefined`。
- 空队列导出：
  - 包含“暂无到期复习题”。
  - 包含去题库补充或标记薄弱题的下一步。
  - 不包含 `undefined`。

先运行：

```bash
npm run test -- reviewSchedule
```

预期失败：`buildReviewScheduleMarkdown` 尚未导出。

## Task 3: 实现 Markdown 导出函数

在 `frontend/src/utils/reviewSchedule.ts` 中新增：

- `buildReviewScheduleMarkdown(progress, now)`
- `renderScheduleOverview(summary)`
- `renderReviewQueue(items)`
- `formatMarkdownDate(value)`
- `sanitizeMarkdownValue(value)`

导出内容只使用现有排期队列，避免与页面逻辑产生分叉。

再次运行：

```bash
npm run test -- reviewSchedule
```

预期通过。

## Task 4: TDD 增加页面复制测试

新增 `frontend/src/pages/StudyPlan/index.test.tsx`：

- mock 热门题 API，避免真实网络请求。
- 向 `localStorage` 写入含薄弱题的学习进度。
- mock `navigator.clipboard.writeText`。
- 点击“复制队列”。
- 断言写入 Markdown 包含标题、概览和题目入口。

先运行：

```bash
npm run test -- StudyPlan
```

预期失败：按钮尚不存在。

## Task 5: 页面接入复制和下载降级

修改 `frontend/src/pages/StudyPlan/index.tsx`：

- 引入 `CopyOutlined` 和 `buildReviewScheduleMarkdown`。
- 增加 `handleCopyReviewSchedule`。
- 在智能复习队列标题行增加“复制队列”按钮。
- 剪贴板成功提示复制成功，失败下载 Markdown。

修改 `frontend/src/styles/global.css`：

- 让标题行支持右侧操作按钮和题量并排。
- 移动端保持按钮不挤压标题。

再次运行：

```bash
npm run test -- StudyPlan
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
git add frontend/src/utils/reviewSchedule.test.ts frontend/src/utils/reviewSchedule.ts frontend/src/pages/StudyPlan/index.tsx frontend/src/pages/StudyPlan/index.test.tsx frontend/src/styles/global.css
git diff --cached --check
git commit -m "功能：新增智能复习队列导出"
```
