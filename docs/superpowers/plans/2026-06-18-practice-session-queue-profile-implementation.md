# 本轮战报队列画像实施计划

## Goal

增强本轮模拟面试战报导出，让用户复制到外部文档后能直接看到当前训练队列的来源构成、下一题和队列入口。

## Architecture

只修改 `practiceSessionReport.ts` 的 Markdown 渲染层：新增 `renderSessionQueueProfile(queue, progress, report)`。该函数读取现有队列、最新评分和报告里的弱题列表，不改变报告核心判断。

## Task 1: RED tests

Modify `frontend/src/utils/practiceSessionReport.test.ts`:

- 在有题导出测试中断言：
  - `## 队列画像`
  - `来源构成：今日计划`
  - `下一题：Java 面试题 3`
  - `队列入口：/practice?queue=1,2,3`
- 在空队列导出测试中断言：
  - `暂无队列画像`

Command:

```bash
cd frontend
npm run test -- practiceSessionReport
```

Expected: FAIL，原因是当前战报没有队列画像章节。

## Task 2: Implementation

Modify `frontend/src/utils/practiceSessionReport.ts`:

- Add source/status/difficulty label maps.
- Add `renderSessionQueueProfile`.
- Insert it after `renderSessionMetrics` and before `renderSessionRepairActions`.
- Use helper functions for source summary, next unanswered question, unanswered ids, queue path and latest score formatting.

## Task 3: Verification

Commands:

```bash
cd frontend
npm run test -- practiceSessionReport
npm run test
npm run build
cd ..
git diff --check
git add frontend/src/utils/practiceSessionReport.test.ts frontend/src/utils/practiceSessionReport.ts docs/superpowers/specs/2026-06-18-practice-session-queue-profile-design.md docs/superpowers/plans/2026-06-18-practice-session-queue-profile-implementation.md
git commit -m "功能：战报增加队列画像"
```
