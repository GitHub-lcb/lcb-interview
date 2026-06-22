# Practice Session First Question Release Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-question release gate to the practice session report so users can see whether the first-question chain is ready to enter the next round.

**Architecture:** Reuse the existing first-question rehearsal, rubric, receipt, and receipt acceptance builders. Add one derived data type, one Markdown renderer, one panel block, focused tests, and CSS that follows the current report-panel pattern.

**Tech Stack:** React 18, TypeScript, Ant Design 5, Vitest, Vite.

---

## Scope

Only frontend report derivation, Markdown export, UI rendering, styling, and tests change. No backend API, database, route, or persistence change is required.

## Files

- Modify `frontend/src/types.ts`: add first-question release gate interfaces.
- Modify `frontend/src/utils/practiceSessionReport.ts`: add builder, Markdown renderer, and item derivation helpers.
- Modify `frontend/src/utils/practiceSessionReport.test.ts`: add Markdown and empty-state assertions.
- Modify `frontend/src/components/PracticeSessionReportPanel.tsx`: render the new gate after receipt acceptance.
- Modify `frontend/src/components/PracticeSessionReportPanel.test.tsx`: assert UI rendering and navigation.
- Modify `frontend/src/styles/global.css`: add compact release-gate styles and mobile fallback.

## Steps

1. Add failing Markdown test for `## 首题放行门禁`, `首题暂缓放行`, `预演动作`, `放行结论`, and the empty-state text `等待首题放行裁决`.
2. Add failing component test for the `首题放行门禁` region, including 4 condition labels and the primary action click.
3. Add `PracticeSessionFirstQuestionReleaseGate` types with `empty | blocked | ready` status and per-item state `waiting | blocked | passed`.
4. Implement `buildPracticeSessionFirstQuestionReleaseGate` from existing first-question builders.
5. Insert `renderSessionFirstQuestionReleaseGate` after `renderSessionFirstQuestionReceiptAcceptance`.
6. Render the panel block after the receipt acceptance card and before next training.
7. Add CSS for blocked, ready, and waiting states without introducing a new visual system.
8. Run `npm run test -- practiceSessionReport PracticeSessionReportPanel`, `npm run test`, `npm run build`, and `git diff --check`.
9. Commit docs and implementation separately with Chinese commit messages.

## Risk Controls

- Do not infer real user completion beyond current local progress data; this gate is a planning裁决, not persistent completion state.
- Keep all wording local-rule based and free-use aligned.
- Avoid adding more than 4 conditions so the战报 does not become noisy.
- Reuse existing navigation targets from upstream builders to prevent broken routes.
