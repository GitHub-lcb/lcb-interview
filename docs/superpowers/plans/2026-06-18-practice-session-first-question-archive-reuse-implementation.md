# Practice Session First Question Archive Reuse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-question archive reuse checklist to the practice session report so archived review evidence turns into concrete next-round opening actions.

**Architecture:** Derive a compact reuse checklist from `buildPracticeSessionFirstQuestionReviewArchive`. Render it in Markdown and the report panel after the archive package and before the next training queue.

**Tech Stack:** React 18, TypeScript, Ant Design 5, Vitest, Vite.

---

## Scope

Only frontend report derivation, Markdown export, UI rendering, styling, and tests change. No backend API, database, route, or persistence change is required.

## Files

- Modify `frontend/src/types.ts`: add first-question archive reuse checklist interfaces.
- Modify `frontend/src/utils/practiceSessionReport.ts`: add reuse checklist builder, Markdown renderer, and item helper.
- Modify `frontend/src/utils/practiceSessionReport.test.ts`: add Markdown and empty-state assertions.
- Modify `frontend/src/components/PracticeSessionReportPanel.tsx`: render the reuse checklist after the archive package.
- Modify `frontend/src/components/PracticeSessionReportPanel.test.tsx`: assert UI rendering and navigation.
- Modify `frontend/src/styles/global.css`: add reuse-checklist styles and mobile fallback.

## Steps

1. Add failing Markdown test for `## 首题归档复用清单`, `回修归档复用清单`, `读分数`, `带证据`, `认阻断`, and `开下一题`.
2. Add failing component test for the `首题归档复用清单` region, including 4 reuse items and the primary action click.
3. Add `PracticeSessionFirstQuestionArchiveReuse` types with `empty | repair | ready` status.
4. Implement `buildPracticeSessionFirstQuestionArchiveReuse` from the archive builder.
5. Insert `renderSessionFirstQuestionArchiveReuse` after `renderSessionFirstQuestionReviewArchive`.
6. Render the panel block after the archive package and before next training.
7. Add CSS for repair and ready states, reusing the compact report-panel card language.
8. Run `npm run test -- practiceSessionReport PracticeSessionReportPanel`, `npm run build`, `npm run test`, and `git diff --check`.
9. Commit docs and implementation separately with Chinese commit messages.

## Risk Controls

- Do not claim that archive items have been persisted; this checklist is generated from local report context.
- Keep exactly 4 reuse actions so the section stays scan-friendly.
- Reuse existing archive navigation targets so the CTA always points to a known route.
