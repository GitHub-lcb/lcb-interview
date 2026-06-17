# 本轮战报面板队列画像实施计划

## Goal

把本轮战报队列画像从 Markdown 导出前移到练习页侧栏战报面板，让用户训练过程中就能看到队列来源、下一题和回到队列的入口。

## Architecture

新增 `PracticeSessionQueueProfile` 类型，并让 `buildPracticeSessionReport(queue, progress)` 返回 `queueProfile`。Markdown 和 `PracticeSessionReportPanel` 都消费这个对象。

## Task 1: RED tests

Modify `frontend/src/utils/practiceSessionReport.test.ts`:

- 断言 `report.queueProfile.sourceSummary`、`nextQuestionTitle`、`queuePath`。

Modify `frontend/src/components/PracticeSessionReportPanel.test.tsx`:

- 断言面板显示 `队列画像`、`今日计划 2 道`、`Java 面试题 2`。
- 点击 `进入队列` 后 `onNavigate('/practice?queue=1,2')`。

Command:

```bash
cd frontend
npm run test -- practiceSessionReport PracticeSessionReportPanel
```

Expected: FAIL，原因是 `queueProfile` 和面板区块还不存在。

## Task 2: Implementation

Modify `frontend/src/types.ts`:

- Add `PracticeSessionQueueProfile`.
- Add `queueProfile` to `PracticeSessionReport`.

Modify `frontend/src/utils/practiceSessionReport.ts`:

- Extract queue profile construction into `buildQueueProfile`.
- Use `report.queueProfile` in Markdown rendering.

Modify `frontend/src/components/PracticeSessionReportPanel.tsx`:

- Render queue profile below metrics.
- Add “进入队列” button.

Modify `frontend/src/styles/global.css`:

- Add compact profile styles under session report panel.

## Task 3: Verification

Commands:

```bash
cd frontend
npm run test -- practiceSessionReport PracticeSessionReportPanel
npm run test
npm run build
cd ..
git diff --check
git add frontend/src/types.ts frontend/src/utils/practiceSessionReport.test.ts frontend/src/utils/practiceSessionReport.ts frontend/src/components/PracticeSessionReportPanel.test.tsx frontend/src/components/PracticeSessionReportPanel.tsx frontend/src/styles/global.css docs/superpowers/specs/2026-06-18-practice-session-queue-profile-panel-design.md docs/superpowers/plans/2026-06-18-practice-session-queue-profile-panel-implementation.md
git commit -m "功能：战报面板显示队列画像"
```
