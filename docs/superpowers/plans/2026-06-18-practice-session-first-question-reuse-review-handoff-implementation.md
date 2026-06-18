# Practice Session First Question Reuse Review Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-question reuse review handoff checklist to the practice session report so archived reuse-review material becomes executable next-round actions.

**Architecture:** Derive a compact handoff checklist from `buildPracticeSessionFirstQuestionReuseReviewArchive`. Render it in Markdown and the report panel after the reuse-review archive package and before the next training queue.

**Tech Stack:** React 18, TypeScript, Ant Design 5, Vitest, Vite.

---

## Scope

Only frontend report derivation, Markdown export, UI rendering, styling, and tests change. No backend API, database, route, account, payment, or persistence change is required.

## Files

- Modify `frontend/src/types.ts`: add first-question reuse-review handoff interfaces.
- Modify `frontend/src/utils/practiceSessionReport.ts`: add handoff builder, Markdown renderer, and archive-item lookup helper.
- Modify `frontend/src/utils/practiceSessionReport.test.ts`: add Markdown order and empty-state assertions.
- Modify `frontend/src/components/PracticeSessionReportPanel.tsx`: render the handoff checklist after the reuse-review archive package.
- Modify `frontend/src/components/PracticeSessionReportPanel.test.tsx`: assert UI rendering and navigation.
- Modify `frontend/src/styles/global.css`: add handoff checklist styles and mobile fallback.

## Steps

1. Add a failing Markdown test for `## 首题复用复盘回流清单`, `回修复用复盘回流清单`, `分数回流`, `证据带入`, `阻断处置`, `下一题启动`, `开场提示`, and `回退动作`.
2. Add a failing empty-session Markdown assertion for `## 首题复用复盘回流清单` and `等待首题复用复盘回流`.
3. Add a failing component test for the `首题复用复盘回流清单` region, including 4 handoff items and the primary action click.
4. Add `PracticeSessionFirstQuestionReuseReviewHandoff` types with `empty | repair | ready` status.
5. Implement `buildPracticeSessionFirstQuestionReuseReviewHandoff` from the reuse-review archive builder.
6. Insert `renderSessionFirstQuestionReuseReviewHandoff` after `renderSessionFirstQuestionReuseReviewArchive`.
7. Render the panel block after the reuse-review archive package and before next training.
8. Add CSS for repair and ready states, reusing the compact report-panel language with a distinct action color.
9. Run `npm run test -- practiceSessionReport PracticeSessionReportPanel`, `npm run build`, `git diff --check`, and `npm run test`.
10. Commit documentation and implementation separately with Chinese commit messages.

## Risk Controls

- Do not claim that archive content has been persisted; this checklist is generated from local report context.
- Keep exactly 4 handoff actions so the section stays scan-friendly.
- Reuse the archive package navigation target so the CTA always points to a known route.
- Preserve the existing report order so users can read release, review, archive, handoff, and next-training sections as a single flow.
