# Practice Session First Question Reuse Review Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-question reuse review template to the practice session report so reuse release decisions produce a follow-up feedback sample before the next training round.

**Architecture:** Derive the review template from `buildPracticeSessionFirstQuestionReuseReleaseGate`. Render it in Markdown and the report panel after the reuse release gate and before the next training queue.

**Tech Stack:** React 18, TypeScript, Ant Design 5, Vitest, Vite.

---

## Scope

Only frontend report derivation, Markdown export, UI rendering, styling, and tests change. No backend API, database, route, or persistence change is required.

## Files

- Modify `frontend/src/types.ts`: add first-question reuse review template interfaces.
- Modify `frontend/src/utils/practiceSessionReport.ts`: add review template builder, Markdown renderer, and item helper.
- Modify `frontend/src/utils/practiceSessionReport.test.ts`: add Markdown and empty-state assertions.
- Modify `frontend/src/components/PracticeSessionReportPanel.tsx`: render the review template after the reuse release gate.
- Modify `frontend/src/components/PracticeSessionReportPanel.test.tsx`: assert UI rendering and navigation.
- Modify `frontend/src/styles/global.css`: add review-template styles and mobile fallback.

## Steps

1. Add failing Markdown test for `## 首题复用复盘模板`, `回修复用复盘模板`, `分数回看`, `证据命中`, `阻断回收`, and `下一题回流`.
2. Add failing component test for the `首题复用复盘模板` region, including 4 review fields and the primary action click.
3. Add `PracticeSessionFirstQuestionReuseReviewTemplate` types with `empty | repair | ready` status.
4. Implement `buildPracticeSessionFirstQuestionReuseReviewTemplate` from the reuse release gate builder.
5. Insert `renderSessionFirstQuestionReuseReviewTemplate` after `renderSessionFirstQuestionReuseReleaseGate`.
6. Render the panel block after the reuse release gate and before next training.
7. Add CSS for repair and ready states, reusing the compact report-panel card language.
8. Run `npm run test -- practiceSessionReport PracticeSessionReportPanel`, `npm run build`, `npm run test`, and `git diff --check`.
9. Commit docs and implementation separately with Chinese commit messages.

## Risk Controls

- Do not claim the review result is persisted; it is a local report template for the user to copy or act on.
- Keep exactly 4 review fields so the section remains scan-friendly.
- Reuse existing release gate navigation targets so the CTA always points to a known route.
