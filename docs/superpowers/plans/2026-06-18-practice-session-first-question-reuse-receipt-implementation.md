# Practice Session First Question Reuse Receipt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-question reuse receipt template to the practice session report so archived evidence reuse becomes explicit next-round evidence.

**Architecture:** Derive a compact receipt template from `buildPracticeSessionFirstQuestionArchiveReuse`. Render it in Markdown and the report panel after the archive reuse checklist and before the next training queue.

**Tech Stack:** React 18, TypeScript, Ant Design 5, Vitest, Vite.

---

## Scope

Only frontend report derivation, Markdown export, UI rendering, styling, and tests change. No backend API, database, route, or persistence change is required.

## Files

- Modify `frontend/src/types.ts`: add first-question reuse receipt interfaces.
- Modify `frontend/src/utils/practiceSessionReport.ts`: add reuse receipt builder, Markdown renderer, and item helper.
- Modify `frontend/src/utils/practiceSessionReport.test.ts`: add Markdown and empty-state assertions.
- Modify `frontend/src/components/PracticeSessionReportPanel.tsx`: render the reuse receipt template after the archive reuse checklist.
- Modify `frontend/src/components/PracticeSessionReportPanel.test.tsx`: assert UI rendering and navigation.
- Modify `frontend/src/styles/global.css`: add reuse-receipt styles and mobile fallback.

## Steps

1. Add failing Markdown test for `## 首题复用回执模板`, `回修复用回执模板`, `分数已读`, `证据已带`, `阻断已认`, and `下一题已开`.
2. Add failing component test for the `首题复用回执模板` region, including 4 receipt fields and the primary action click.
3. Add `PracticeSessionFirstQuestionReuseReceipt` types with `empty | repair | ready` status.
4. Implement `buildPracticeSessionFirstQuestionReuseReceipt` from the archive reuse builder.
5. Insert `renderSessionFirstQuestionReuseReceipt` after `renderSessionFirstQuestionArchiveReuse`.
6. Render the panel block after the archive reuse checklist and before next training.
7. Add CSS for repair and ready states, reusing the compact report-panel card language.
8. Run `npm run test -- practiceSessionReport PracticeSessionReportPanel`, `npm run build`, `npm run test`, and `git diff --check`.
9. Commit docs and implementation separately with Chinese commit messages.

## Risk Controls

- Do not claim the receipt is persisted; this is a local report template for the user to fill or copy.
- Keep exactly 4 receipt fields so the section remains scan-friendly.
- Reuse existing archive-reuse navigation targets so the CTA always points to a known route.
