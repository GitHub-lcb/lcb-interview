# Practice Session First Question Reuse Review Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-question reuse review acceptance card to the practice session report so reuse review fields are checked before the next training round.

**Architecture:** Derive the acceptance card from `buildPracticeSessionFirstQuestionReuseReviewTemplate`. Render it in Markdown and the report panel after the reuse review template and before the next training queue.

**Tech Stack:** React 18, TypeScript, Ant Design 5, Vitest, Vite.

---

## Scope

Only frontend report derivation, Markdown export, UI rendering, styling, and tests change. No backend API, database, route, storage, or paid-service integration is required.

## Files

- Modify `frontend/src/types.ts`: add first-question reuse review acceptance interfaces.
- Modify `frontend/src/utils/practiceSessionReport.ts`: add acceptance builder, Markdown renderer, item helper, and finder helper.
- Modify `frontend/src/utils/practiceSessionReport.test.ts`: add Markdown and empty-state assertions.
- Modify `frontend/src/components/PracticeSessionReportPanel.tsx`: render the acceptance card after the reuse review template.
- Modify `frontend/src/components/PracticeSessionReportPanel.test.tsx`: assert UI rendering and navigation.
- Modify `frontend/src/styles/global.css`: add acceptance-card styles and mobile fallback.

## Steps

1. Add failing Markdown test for `## 首题复用复盘验收卡`, `回修复用复盘待验收`, `分数验收`, `证据验收`, `阻断验收`, and `回流验收`.
2. Add failing component test for the `首题复用复盘验收卡` region, including 4 acceptance items and the primary action click.
3. Add `PracticeSessionFirstQuestionReuseReviewAcceptance` types with `empty | repair | ready` status.
4. Implement `buildPracticeSessionFirstQuestionReuseReviewAcceptance` from the reuse review template builder.
5. Insert `renderSessionFirstQuestionReuseReviewAcceptance` after `renderSessionFirstQuestionReuseReviewTemplate`.
6. Render the panel block after the reuse review template and before next training.
7. Add CSS for repair and ready states, reusing the compact report-panel card language.
8. Run `npm run test -- practiceSessionReport PracticeSessionReportPanel`, `npm run build`, `git diff --check`, and `npm run test`.
9. Commit docs and implementation separately with Chinese commit messages.

## Risk Controls

- Do not imply the user’s filled review is persisted; this is a local report acceptance card.
- Keep exactly 4 acceptance items so the section remains scan-friendly.
- Reuse existing review-template navigation targets so the CTA always points to a known route.
