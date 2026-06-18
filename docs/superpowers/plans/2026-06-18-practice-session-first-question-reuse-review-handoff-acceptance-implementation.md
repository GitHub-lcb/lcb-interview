# Practice Session First Question Reuse Review Handoff Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-question reuse review handoff acceptance card so users can verify whether reuse-review handoff actions are ready for the next training round.

**Architecture:** Derive a compact acceptance card from `buildPracticeSessionFirstQuestionReuseReviewHandoff`. Render it in Markdown and the report panel after the handoff checklist and before the next training queue.

**Tech Stack:** React 18, TypeScript, Ant Design 5, Vitest, Vite.

---

## Scope

Only frontend report derivation, Markdown export, UI rendering, styling, and tests change. No backend API, database, route, account, payment, or persistence change is required.

## Files

- Modify `frontend/src/types.ts`: add first-question reuse-review handoff acceptance interfaces.
- Modify `frontend/src/utils/practiceSessionReport.ts`: add acceptance builder, Markdown renderer, and handoff-item lookup helper.
- Modify `frontend/src/utils/practiceSessionReport.test.ts`: add Markdown order and empty-state assertions.
- Modify `frontend/src/components/PracticeSessionReportPanel.tsx`: render the acceptance card after the handoff checklist.
- Modify `frontend/src/components/PracticeSessionReportPanel.test.tsx`: assert UI rendering and navigation.
- Modify `frontend/src/styles/global.css`: add acceptance card styles and mobile fallback.

## Steps

1. Add a failing Markdown test for `## 首题复用复盘回流验收卡`, `回修复用复盘回流待验收`, `分数可核验`, `证据可带入`, `阻断可处置`, `入口可执行`, `通过信号`, and `补救动作`.
2. Add a failing empty-session Markdown assertion for `## 首题复用复盘回流验收卡` and `等待验收首题复用复盘回流`.
3. Add a failing component test for the `首题复用复盘回流验收卡` region, including 4 acceptance items and the primary action click.
4. Add `PracticeSessionFirstQuestionReuseReviewHandoffAcceptance` types with `empty | repair | ready` status.
5. Implement `buildPracticeSessionFirstQuestionReuseReviewHandoffAcceptance` from the reuse-review handoff builder.
6. Insert `renderSessionFirstQuestionReuseReviewHandoffAcceptance` after `renderSessionFirstQuestionReuseReviewHandoff`.
7. Render the panel block after the handoff checklist and before next training.
8. Add CSS for repair and ready states, reusing the compact report-panel language.
9. Run `npm run test -- practiceSessionReport PracticeSessionReportPanel`, `npm run build`, `git diff --check`, and `npm run test`.
10. Commit documentation and implementation separately with Chinese commit messages.

## Risk Controls

- Do not claim that handoff actions were executed; this card only validates readiness from local report context.
- Keep exactly 4 acceptance items so the section remains scan-friendly.
- Reuse the handoff checklist navigation target so the CTA always points to a known route.
- Preserve report order: archive package, handoff checklist, handoff acceptance, next training.
