# Practice Session First Question Review Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-question review archive package to the practice session report so accepted review evidence becomes reusable input for the next training round.

**Architecture:** Derive a compact archive package from `buildPracticeSessionFirstQuestionReviewAcceptance` and the next-training queue. Render it in Markdown and the report panel after the review acceptance card and before the next training queue.

**Tech Stack:** React 18, TypeScript, Ant Design 5, Vitest, Vite.

---

## Scope

Only frontend report derivation, Markdown export, UI rendering, styling, and tests change. No backend API, database, route, or persistence change is required.

## Files

- Modify `frontend/src/types.ts`: add first-question review archive interfaces.
- Modify `frontend/src/utils/practiceSessionReport.ts`: add archive builder, Markdown renderer, and archive item helper.
- Modify `frontend/src/utils/practiceSessionReport.test.ts`: add Markdown and empty-state assertions.
- Modify `frontend/src/components/PracticeSessionReportPanel.tsx`: render the archive package after the review acceptance card.
- Modify `frontend/src/components/PracticeSessionReportPanel.test.tsx`: assert UI rendering and navigation.
- Modify `frontend/src/styles/global.css`: add archive-package styles and mobile fallback.

## Steps

1. Add failing Markdown test for `## 首题复盘归档包`, `回修复盘归档包`, `分数快照`, `证据归档`, `阻断结论`, and `下一题种子`.
2. Add failing component test for the `首题复盘归档包` region, including 4 archive items and the primary action click.
3. Add `PracticeSessionFirstQuestionReviewArchive` types with `empty | repair | ready` status.
4. Implement `buildPracticeSessionFirstQuestionReviewArchive` from the review acceptance builder and next-training queue.
5. Insert `renderSessionFirstQuestionReviewArchive` after `renderSessionFirstQuestionReviewAcceptance`.
6. Render the panel block after the review acceptance card and before next training.
7. Add CSS for repair and ready states, reusing the compact report-panel card language.
8. Run `npm run test -- practiceSessionReport PracticeSessionReportPanel`, `npm run test`, `npm run build`, and `git diff --check`.
9. Commit docs and implementation separately with Chinese commit messages.

## Risk Controls

- Do not claim that user-written复盘 has been persisted; this package is generated from local report context.
- Keep exactly 4 archive items so the section stays scan-friendly.
- Reuse existing review-acceptance navigation targets so the CTA always points to a known route.
