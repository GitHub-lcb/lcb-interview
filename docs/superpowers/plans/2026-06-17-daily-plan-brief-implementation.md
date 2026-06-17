# 今日作战简报 Implementation Plan

> **For agentic workers:** Use test-driven-development for the brief utility and verification-before-completion before commit. Do not open a browser.

**Goal:** 让学习计划页能解释今日计划中每道题的入选原因，形成“题目队列 + 为什么做 + 怎么做”的免费备考闭环。

**Architecture:** 新增 `dailyPlanBrief` 纯函数和类型；新增 `DailyPlanBriefPanel` 组件；`StudyPlan` 将本地进度和热门题传入组件。

**Tech Stack:** React 18、TypeScript、Vitest、Ant Design 5、现有本地学习进度。

---

### Task 1: 简报数据模型和生成器

**Files:**
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/utils/dailyPlanBrief.test.ts`
- Create: `frontend/src/utils/dailyPlanBrief.ts`

- [ ] **Step 1: Write failing tests**

覆盖空计划、复习债优先、状态分类、快照兜底和保持计划顺序。

- [ ] **Step 2: Verify RED**

Run: `cd frontend; npm run test -- dailyPlanBrief`

Expected: FAIL because `./dailyPlanBrief` does not exist.

- [ ] **Step 3: Implement utility**

实现 `buildDailyPlanBrief(progress, candidates, now)`，返回简报标题、摘要、指标和题目条目。

- [ ] **Step 4: Verify GREEN**

Run: `cd frontend; npm run test -- dailyPlanBrief`

Expected: PASS.

### Task 2: 页面展示

**Files:**
- Create: `frontend/src/components/DailyPlanBriefPanel.tsx`
- Modify: `frontend/src/pages/StudyPlan/index.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Add panel component**

展示计划概览指标和最多 6 条题目级行动理由。

- [ ] **Step 2: Wire StudyPlan**

将 `progress` 和 `hotQuestions` 传入 `DailyPlanBriefPanel`，位置放在配速教练后。

- [ ] **Step 3: Add responsive styles**

使用紧凑栅格和列表，移动端单列展示，避免与现有卡片嵌套冲突。

### Task 3: Verification and commit

- [ ] **Step 1: Run frontend tests**

Run: `cd frontend; npm run test`

Expected: all tests pass.

- [ ] **Step 2: Run frontend build**

Run: `cd frontend; npm run build`

Expected: build succeeds.

- [ ] **Step 3: Run backend tests**

Run: `cd backend; mvn test`

Expected: all backend tests pass.

- [ ] **Step 4: Run whitespace check**

Run: `git diff --check`

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-06-17-daily-plan-brief-design.md docs/superpowers/plans/2026-06-17-daily-plan-brief-implementation.md frontend/src/types.ts frontend/src/utils/dailyPlanBrief.test.ts frontend/src/utils/dailyPlanBrief.ts frontend/src/components/DailyPlanBriefPanel.tsx frontend/src/pages/StudyPlan/index.tsx frontend/src/styles/global.css
git commit -m "功能：新增今日作战简报"
```
