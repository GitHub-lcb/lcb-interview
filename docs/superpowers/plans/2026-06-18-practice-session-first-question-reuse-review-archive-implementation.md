# Practice Session First Question Reuse Review Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-question reuse review archive package to the practice session report so accepted reuse review results become explicit next-round inputs.

**Architecture:** Derive the archive package from `buildPracticeSessionFirstQuestionReuseReviewAcceptance`. Render it in Markdown and the report panel after the reuse review acceptance card and before the next training queue.

**Tech Stack:** React 18, TypeScript, Ant Design 5, Vitest, Vite.

---

## Scope

Only frontend report derivation, Markdown export, UI rendering, styling, and tests change. No backend API, database, route, storage, or paid-service integration is required.

## Files

- Modify `frontend/src/types.ts`: add first-question reuse review archive interfaces.
- Modify `frontend/src/utils/practiceSessionReport.ts`: add archive builder, Markdown renderer, item helper, and finder helper.
- Modify `frontend/src/utils/practiceSessionReport.test.ts`: add Markdown order and empty-state assertions.
- Modify `frontend/src/components/PracticeSessionReportPanel.tsx`: render the archive package after the reuse review acceptance card.
- Modify `frontend/src/components/PracticeSessionReportPanel.test.tsx`: assert UI rendering and navigation.
- Modify `frontend/src/styles/global.css`: add archive-package styles and mobile fallback.

## Steps

1. Add failing Markdown test for `## 首题复用复盘归档包`, `回修复用复盘归档包`, `复用分数快照`, `复用证据归档`, `阻断回收结论`, and `下一轮回流种子`.
2. Add failing component test for the `首题复用复盘归档包` region, including 4 archive items and the primary action click.
3. Add `PracticeSessionFirstQuestionReuseReviewArchive` types with `empty | repair | ready` status.
4. Implement `buildPracticeSessionFirstQuestionReuseReviewArchive` from the reuse review acceptance builder.
5. Insert `renderSessionFirstQuestionReuseReviewArchive` after `renderSessionFirstQuestionReuseReviewAcceptance`.
6. Render the panel block after the reuse review acceptance card and before next training.
7. Add CSS for repair and ready states, reusing the compact report-panel card language.
8. Run `npm run test -- practiceSessionReport PracticeSessionReportPanel`, `npm run build`, `git diff --check`, and `npm run test`.
9. Commit docs and implementation separately with Chinese commit messages.

## Risk Controls

- Do not claim the archive is persisted; it is a local report package for copy/export/action.
- Keep exactly 4 archive items so the section remains scan-friendly.
- Reuse existing acceptance navigation targets so the CTA always points to a known route.
