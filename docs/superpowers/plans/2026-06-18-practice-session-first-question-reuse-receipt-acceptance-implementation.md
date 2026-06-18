# Practice Session First Question Reuse Receipt Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-question reuse receipt acceptance card to the practice session report so reuse receipts are checked before the next training round.

**Architecture:** Derive the acceptance card from `buildPracticeSessionFirstQuestionReuseReceipt`. Render it in Markdown and the report panel after the reuse receipt template and before the next training queue.

**Tech Stack:** React 18, TypeScript, Ant Design 5, Vitest, Vite.

---

## Scope

Only frontend report derivation, Markdown export, UI rendering, styling, and tests change. No backend API, database, route, or persistence change is required.

## Files

- Modify `frontend/src/types.ts`: add first-question reuse receipt acceptance interfaces.
- Modify `frontend/src/utils/practiceSessionReport.ts`: add acceptance builder, Markdown renderer, and item helper.
- Modify `frontend/src/utils/practiceSessionReport.test.ts`: add Markdown and empty-state assertions.
- Modify `frontend/src/components/PracticeSessionReportPanel.tsx`: render the acceptance card after the reuse receipt template.
- Modify `frontend/src/components/PracticeSessionReportPanel.test.tsx`: assert UI rendering and navigation.
- Modify `frontend/src/styles/global.css`: add acceptance-card styles and mobile fallback.

## Steps

1. Add failing Markdown test for `## 首题复用回执验收卡`, `回修复用回执待验收`, `分数对齐`, `证据引用`, `阻断判断`, and `下一题接续`.
2. Add failing component test for the `首题复用回执验收卡` region, including 4 acceptance items and the primary action click.
3. Add `PracticeSessionFirstQuestionReuseReceiptAcceptance` types with `empty | repair | ready` status.
4. Implement `buildPracticeSessionFirstQuestionReuseReceiptAcceptance` from the reuse receipt builder.
5. Insert `renderSessionFirstQuestionReuseReceiptAcceptance` after `renderSessionFirstQuestionReuseReceipt`.
6. Render the panel block after the reuse receipt template and before next training.
7. Add CSS for repair and ready states, reusing the compact report-panel card language.
8. Run `npm run test -- practiceSessionReport PracticeSessionReportPanel`, `npm run build`, `npm run test`, and `git diff --check`.
9. Commit docs and implementation separately with Chinese commit messages.

## Risk Controls

- Do not claim the acceptance result is persisted; it is a local report card for the user to copy or act on.
- Keep exactly 4 acceptance items so the section remains scan-friendly.
- Reuse existing receipt navigation targets so the CTA always points to a known route.
