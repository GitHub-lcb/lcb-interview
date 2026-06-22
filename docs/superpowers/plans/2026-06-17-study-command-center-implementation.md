# 备考指挥中心实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在首页新增一个基于本地学习进度的备考指挥中心，输出就绪度、最大短板和下一步动作。

**Architecture:** 先新增纯函数 `studyStrategy.ts` 计算策略，保证核心逻辑可测试；再新增 `StudyCommandCenter.tsx` 渲染结果；最后接入首页和样式。整个功能只读 `StudyProgress`，不新增后端接口和数据库表。

**Tech Stack:** React 18, Vite, TypeScript, Ant Design 5, Vitest.

---

## File Structure

- Modify `frontend/src/types.ts`: add `StudyStrategy`, `StudyStrategyFactor`, `StudyStrategyAction`.
- Create `frontend/src/utils/studyStrategy.test.ts`: cover new user, weak-heavy user, mature user, and action routes.
- Create `frontend/src/utils/studyStrategy.ts`: calculate readiness score, risk, factors, and next actions.
- Create `frontend/src/components/StudyCommandCenter.tsx`: render strategy panel on home.
- Modify `frontend/src/pages/Home/index.tsx`: insert command center after `StudyDashboard`.
- Modify `frontend/src/styles/global.css`: add responsive command center styles.

## Task 1: Strategy Types And Tests

**Files:**
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/utils/studyStrategy.test.ts`

- [ ] Add strategy types to `frontend/src/types.ts`.
- [ ] Write tests for:
  - empty progress returns low readiness and a start action;
  - weak-heavy progress returns weak review as primary risk;
  - progress with plan, mastered questions, and attempts gets a higher score;
  - generated action routes are valid existing app routes.
- [ ] Run `npm run test -- studyStrategy` and confirm it fails because implementation is missing.

## Task 2: Strategy Implementation

**Files:**
- Create: `frontend/src/utils/studyStrategy.ts`

- [ ] Implement `buildStudyStrategy(progress: StudyProgress): StudyStrategy`.
- [ ] Add Chinese comments around score weighting and risk priority.
- [ ] Run `npm run test -- studyStrategy` and confirm it passes.

## Task 3: Command Center UI

**Files:**
- Create: `frontend/src/components/StudyCommandCenter.tsx`
- Modify: `frontend/src/pages/Home/index.tsx`

- [ ] Render readiness score, title, explanation, primary risk, factors, and action buttons.
- [ ] Use `useStudyProgress()` and `useNavigate()`.
- [ ] Insert component below `StudyDashboard`.
- [ ] Run `npm run build` and confirm TypeScript passes.

## Task 4: Responsive Styles

**Files:**
- Modify: `frontend/src/styles/global.css`

- [ ] Add `.study-command-center`, `.command-score-card`, `.command-risk-card`, `.command-factor-grid`, and `.command-action-row`.
- [ ] Make desktop layout 280px score column + flexible detail column.
- [ ] Make mobile layout single-column under 760px.
- [ ] Run `npm run build`.

## Task 5: Final Verification And Commit

**Files:**
- All modified frontend files.

- [ ] Run `npm run test -- studyStrategy`.
- [ ] Run `npm run test`.
- [ ] Run `npm run build`.
- [ ] Run `mvn test`.
- [ ] Run `git diff --check`.
- [ ] Commit with Chinese message: `功能：新增备考指挥中心`.

## Self-Review

- Spec coverage: readiness score, biggest risk, next actions, home integration, Chinese comments, and verification are covered.
- Placeholder scan: no placeholders remain.
- Type consistency: strategy types are defined before utility and component usage.

