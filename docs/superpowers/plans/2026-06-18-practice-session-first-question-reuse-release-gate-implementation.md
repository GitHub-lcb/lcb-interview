# Practice Session First Question Reuse Release Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-question reuse release gate to the practice session report so reuse receipt acceptance becomes a clear go/no-go decision before the next training round.

**Architecture:** Derive the release gate from `buildPracticeSessionFirstQuestionReuseReceiptAcceptance`. Render it in Markdown and the report panel after the reuse receipt acceptance card and before the next training queue.

**Tech Stack:** React 18, TypeScript, Ant Design 5, Vitest, Vite.

---

## Scope

Only frontend report derivation, Markdown export, UI rendering, styling, and tests change. No backend API, database, route, or persistence change is required.

## Files

- Modify `frontend/src/types.ts`: add first-question reuse release gate interfaces.
- Modify `frontend/src/utils/practiceSessionReport.ts`: add release gate builder, Markdown renderer, and item helper.
- Modify `frontend/src/utils/practiceSessionReport.test.ts`: add Markdown and empty-state assertions.
- Modify `frontend/src/components/PracticeSessionReportPanel.tsx`: render the release gate after the reuse receipt acceptance card.
- Modify `frontend/src/components/PracticeSessionReportPanel.test.tsx`: assert UI rendering and navigation.
- Modify `frontend/src/styles/global.css`: add release-gate styles and mobile fallback.

## Steps

1. Add failing Markdown test for `## 首题复用放行门禁`, `复用暂缓放行`, `分数放行`, `证据放行`, `阻断放行`, and `下一题放行`.
2. Add failing component test for the `首题复用放行门禁` region, including 4 release items and the primary action click.
3. Add `PracticeSessionFirstQuestionReuseReleaseGate` types with `empty | blocked | ready` status and per-item state `waiting | blocked | passed`.
4. Implement `buildPracticeSessionFirstQuestionReuseReleaseGate` from the reuse receipt acceptance builder.
5. Insert `renderSessionFirstQuestionReuseReleaseGate` after `renderSessionFirstQuestionReuseReceiptAcceptance`.
6. Render the panel block after the reuse receipt acceptance card and before next training.
7. Add CSS for blocked and ready states, reusing the compact report-panel card language.
8. Run `npm run test -- practiceSessionReport PracticeSessionReportPanel`, `npm run build`, `npm run test`, and `git diff --check`.
9. Commit docs and implementation separately with Chinese commit messages.

## Risk Controls

- Do not claim the release decision is persisted; it is a local report gate for the user to copy or act on.
- Keep exactly 4 release items so the section remains scan-friendly.
- Reuse existing acceptance navigation targets so the CTA always points to a known route.
