# Practice Session First Question Review Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-question review acceptance card to the practice session report so users can judge whether their first-question review is usable.

**Architecture:** Derive a compact acceptance card from `buildPracticeSessionFirstQuestionReviewTemplate`. Render it in Markdown and the report panel after the review template and before the next training queue.

**Tech Stack:** React 18, TypeScript, Ant Design 5, Vitest, Vite.

---

## Scope

Only frontend report derivation, Markdown export, UI rendering, styling, and tests change. No backend API, database, route, or persistence change is required.

## Files

- Modify `frontend/src/types.ts`: add first-question review acceptance interfaces.
- Modify `frontend/src/utils/practiceSessionReport.ts`: add builder, Markdown renderer, and fixed acceptance helper.
- Modify `frontend/src/utils/practiceSessionReport.test.ts`: add Markdown and empty-state assertions.
- Modify `frontend/src/components/PracticeSessionReportPanel.tsx`: render the acceptance card after the review template.
- Modify `frontend/src/components/PracticeSessionReportPanel.test.tsx`: assert UI rendering and navigation.
- Modify `frontend/src/styles/global.css`: add compact acceptance-card styles and mobile fallback.

## Steps

1. Add failing Markdown test for `## 首题复盘验收卡`, `回修复盘验收卡`, `评分可比`, `证据可追溯`, `阻断可判定`, and `下一题可执行`.
2. Add failing component test for the `首题复盘验收卡` region, including 4 acceptance items and the primary action click.
3. Add `PracticeSessionFirstQuestionReviewAcceptance` types with `empty | repair | ready` status.
4. Implement `buildPracticeSessionFirstQuestionReviewAcceptance` from the review template builder.
5. Insert `renderSessionFirstQuestionReviewAcceptance` after `renderSessionFirstQuestionReviewTemplate`.
6. Render the panel block after the review template and before next training.
7. Add CSS for repair and ready states, reusing the compact report-panel card language.
8. Run `npm run test -- practiceSessionReport PracticeSessionReportPanel`, `npm run test`, `npm run build`, and `git diff --check`.
9. Commit docs and implementation separately with Chinese commit messages.

## Risk Controls

- Do not infer real复盘完成状态; this is an acceptance checklist generated from current local context.
- Keep exactly 4 acceptance points so the report stays usable.
- Reuse existing review-template navigation targets so the CTA always points to a known route.
