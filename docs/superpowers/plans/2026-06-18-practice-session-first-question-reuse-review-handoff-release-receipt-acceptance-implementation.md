# Practice Session First Question Reuse Review Handoff Release Receipt Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-question reuse review handoff release receipt acceptance card so users can verify the release receipt before entering the next training round.

**Architecture:** Derive a compact acceptance card from `buildPracticeSessionFirstQuestionReuseReviewHandoffReleaseReceipt`. Render it in Markdown and the report panel after the release receipt and before the next training queue.

**Tech Stack:** React 18, TypeScript, Ant Design 5, Vitest, Vite.

---

## Scope

Only frontend report derivation, Markdown export, UI rendering, styling, and tests change. No backend API, database, route, account, payment, or persistence change is required.

## Files

- Modify `frontend/src/types.ts`: add first-question reuse-review handoff release receipt acceptance interfaces.
- Modify `frontend/src/utils/practiceSessionReport.ts`: add release receipt acceptance builder and Markdown renderer.
- Modify `frontend/src/utils/practiceSessionReport.test.ts`: add Markdown order and empty-state assertions.
- Modify `frontend/src/components/PracticeSessionReportPanel.tsx`: render the acceptance card after the release receipt.
- Modify `frontend/src/components/PracticeSessionReportPanel.test.tsx`: assert UI rendering and navigation.
- Modify `frontend/src/styles/global.css`: add acceptance card styles and mobile fallback.

## Steps

1. Add a failing Markdown test for `## 首题复用复盘回流放行回执验收卡`, `回流放行回执待验收`, `结论可判`, `证据可带`, `阻断可控`, `入口可执行`, `通过信号`, `缺失风险`, and `补救动作`.
2. Add a failing empty-session Markdown assertion for `## 首题复用复盘回流放行回执验收卡` and `等待验收首题复用复盘回流放行回执`.
3. Add a failing component test for the `首题复用复盘回流放行回执验收卡` region, including 4 acceptance items and the primary action click.
4. Add `PracticeSessionFirstQuestionReuseReviewHandoffReleaseReceiptAcceptance` types with `empty | repair | ready` status.
5. Implement `buildPracticeSessionFirstQuestionReuseReviewHandoffReleaseReceiptAcceptance` from the release receipt builder.
6. Insert `renderSessionFirstQuestionReuseReviewHandoffReleaseReceiptAcceptance` after `renderSessionFirstQuestionReuseReviewHandoffReleaseReceipt`.
7. Render the panel block after the release receipt and before next training.
8. Add CSS for repair and ready states, reusing compact report-panel acceptance language.
9. Run `npm run test -- practiceSessionReport PracticeSessionReportPanel`, `npm run build`, `git diff --check`, and `npm run test`.
10. Commit documentation and implementation separately with Chinese commit messages.

## Risk Controls

- Do not claim the next round has started; the card only verifies whether the receipt is safe to carry forward.
- Keep exactly 4 acceptance items so the section remains scan-friendly.
- Reuse release receipt navigation targets so the CTA always points to a known route.
- Preserve report order: handoff release gate, handoff release receipt, handoff release receipt acceptance, next training.
