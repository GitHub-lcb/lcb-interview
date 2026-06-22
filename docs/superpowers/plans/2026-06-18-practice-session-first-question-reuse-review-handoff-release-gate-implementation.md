# Practice Session First Question Reuse Review Handoff Release Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-question reuse review handoff release gate so users get a clear decision before entering the next training round.

**Architecture:** Derive a compact release gate from `buildPracticeSessionFirstQuestionReuseReviewHandoffAcceptance`. Render it in Markdown and the report panel after the handoff acceptance card and before the next training queue.

**Tech Stack:** React 18, TypeScript, Ant Design 5, Vitest, Vite.

---

## Scope

Only frontend report derivation, Markdown export, UI rendering, styling, and tests change. No backend API, database, route, account, payment, or persistence change is required.

## Files

- Modify `frontend/src/types.ts`: add first-question reuse-review handoff release gate interfaces.
- Modify `frontend/src/utils/practiceSessionReport.ts`: add release gate builder, Markdown renderer, and acceptance-item lookup helper.
- Modify `frontend/src/utils/practiceSessionReport.test.ts`: add Markdown order and empty-state assertions.
- Modify `frontend/src/components/PracticeSessionReportPanel.tsx`: render the release gate after the handoff acceptance card.
- Modify `frontend/src/components/PracticeSessionReportPanel.test.tsx`: assert UI rendering and navigation.
- Modify `frontend/src/styles/global.css`: add release gate styles and mobile fallback.

## Steps

1. Add a failing Markdown test for `## 首题复用复盘回流放行门禁`, `回流暂缓放行`, `分数放行`, `证据放行`, `阻断放行`, `入口放行`, `放行规则`, `处理动作`, and `未放行`.
2. Add a failing empty-session Markdown assertion for `## 首题复用复盘回流放行门禁` and `等待首题复用复盘回流放行裁决`.
3. Add a failing component test for the `首题复用复盘回流放行门禁` region, including 4 gate items and the primary action click.
4. Add `PracticeSessionFirstQuestionReuseReviewHandoffReleaseGate` types with `empty | blocked | ready` status.
5. Implement `buildPracticeSessionFirstQuestionReuseReviewHandoffReleaseGate` from the reuse-review handoff acceptance builder.
6. Insert `renderSessionFirstQuestionReuseReviewHandoffReleaseGate` after `renderSessionFirstQuestionReuseReviewHandoffAcceptance`.
7. Render the panel block after the handoff acceptance card and before next training.
8. Add CSS for blocked and ready states, reusing the compact report-panel gate language.
9. Run `npm run test -- practiceSessionReport PracticeSessionReportPanel`, `npm run build`, `git diff --check`, and `npm run test`.
10. Commit documentation and implementation separately with Chinese commit messages.

## Risk Controls

- Do not claim that handoff actions were executed; this gate only decides readiness from local report context.
- Keep exactly 4 gate items so the section remains scan-friendly.
- Reuse the handoff acceptance navigation target so the CTA always points to a known route.
- Preserve report order: handoff checklist, handoff acceptance, handoff release gate, next training.
