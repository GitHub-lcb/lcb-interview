# Practice Session First Question Review Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-question review template to the practice session report so users know how to复盘 the first question after release.

**Architecture:** Reuse `buildPracticeSessionFirstQuestionReleaseGate` and derive a compact template with four fixed fields. Render it in Markdown and the report panel after the release gate and before next training.

**Tech Stack:** React 18, TypeScript, Ant Design 5, Vitest, Vite.

---

## Scope

Only frontend report derivation, Markdown export, UI rendering, styling, and tests change. No backend API, database, route, or persistence change is required.

## Files

- Modify `frontend/src/types.ts`: add first-question review template interfaces.
- Modify `frontend/src/utils/practiceSessionReport.ts`: add builder, Markdown renderer, and fixed field helper.
- Modify `frontend/src/utils/practiceSessionReport.test.ts`: add Markdown and empty-state assertions.
- Modify `frontend/src/components/PracticeSessionReportPanel.tsx`: render the template after the release gate.
- Modify `frontend/src/components/PracticeSessionReportPanel.test.tsx`: assert UI rendering and navigation.
- Modify `frontend/src/styles/global.css`: add compact template styles and mobile fallback.

## Steps

1. Add failing Markdown test for `## 首题复盘模板`, `回修首题复盘模板`, `评分变化`, `证据变化`, `阻断变化`, and `下一题动作`.
2. Add failing component test for the `首题复盘模板` region, including 4 fields and the primary action click.
3. Add `PracticeSessionFirstQuestionReviewTemplate` types with `empty | repair | ready` status.
4. Implement `buildPracticeSessionFirstQuestionReviewTemplate` from the release gate builder.
5. Insert `renderSessionFirstQuestionReviewTemplate` after `renderSessionFirstQuestionReleaseGate`.
6. Render the panel block after the release gate and before next training.
7. Add CSS for repair and ready states, reusing the report panel's compact card language.
8. Run `npm run test -- practiceSessionReport PracticeSessionReportPanel`, `npm run test`, `npm run build`, and `git diff --check`.
9. Commit docs and implementation separately with Chinese commit messages.

## Risk Controls

- Do not pretend the user has completed the next-round first answer; this is a复盘模板, not a persisted result.
- Keep exactly 4 fields to prevent战报膨胀.
- Use existing release-gate navigation targets so the CTA always points to a known route.
