# Practice Session First Question Reuse Review Handoff Release Receipt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-question reuse review handoff release receipt so users can carry the release decision and evidence into the next training round.

**Architecture:** Derive a compact receipt from `buildPracticeSessionFirstQuestionReuseReviewHandoffReleaseGate`. Render it in Markdown and the report panel after the release gate and before the next training queue.

**Tech Stack:** React 18, TypeScript, Ant Design 5, Vitest, Vite.

---

## Scope

Only frontend report derivation, Markdown export, UI rendering, styling, and tests change. No backend API, database, route, account, payment, or persistence change is required.

## Files

- Modify `frontend/src/types.ts`: add first-question reuse-review handoff release receipt interfaces.
- Modify `frontend/src/utils/practiceSessionReport.ts`: add release receipt builder and Markdown renderer.
- Modify `frontend/src/utils/practiceSessionReport.test.ts`: add Markdown order and empty-state assertions.
- Modify `frontend/src/components/PracticeSessionReportPanel.tsx`: render the release receipt after the release gate.
- Modify `frontend/src/components/PracticeSessionReportPanel.test.tsx`: assert UI rendering and navigation.
- Modify `frontend/src/styles/global.css`: add release receipt styles and mobile fallback.

## Steps

1. Add a failing Markdown test for `## 首题复用复盘回流放行回执`, `回流回执待修复`, `放行结论`, `随身证据`, `阻断处理`, `下一轮入口`, `交接证据`, `下一步动作`, and `未交接`.
2. Add a failing empty-session Markdown assertion for `## 首题复用复盘回流放行回执` and `等待首题复用复盘回流放行回执`.
3. Add a failing component test for the `首题复用复盘回流放行回执` region, including 4 receipt items and the primary action click.
4. Add `PracticeSessionFirstQuestionReuseReviewHandoffReleaseReceipt` types with `empty | blocked | ready` status.
5. Implement `buildPracticeSessionFirstQuestionReuseReviewHandoffReleaseReceipt` from the handoff release gate builder.
6. Insert `renderSessionFirstQuestionReuseReviewHandoffReleaseReceipt` after `renderSessionFirstQuestionReuseReviewHandoffReleaseGate`.
7. Render the panel block after the release gate and before next training.
8. Add CSS for blocked and ready states, reusing compact report-panel receipt language.
9. Run `npm run test -- practiceSessionReport PracticeSessionReportPanel`, `npm run build`, `git diff --check`, and `npm run test`.
10. Commit documentation and implementation separately with Chinese commit messages.

## Risk Controls

- Do not claim the next round has started; the receipt only records what should be carried forward.
- Keep exactly 4 receipt items so the section remains scan-friendly.
- Reuse release gate navigation targets so the CTA always points to a known route.
- Preserve report order: handoff checklist, handoff acceptance, handoff release gate, handoff release receipt, next training.
