# 备考配速教练 Implementation Plan

> **For agentic workers:** Use test-driven-development for the pace utility and verification-before-completion before commit. Do not open a browser.

**Goal:** 在学习计划页新增本地配速教练，把冲刺周期、计划量、复习债和模拟面试样本转成当天最该执行的动作。

**Architecture:** 新增 `studyPaceCoach` 纯函数；扩展类型；新增 `StudyPaceCoachPanel`；在 `StudyPlan` 目标设置后插入；样式放入全局 CSS。

**Tech Stack:** React 18、TypeScript、Vitest、Ant Design 5、现有 `StudyProgress` 和复习排期工具。

---

### Task 1: 配速生成器

**Files:**
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/utils/studyPaceCoach.test.ts`
- Create: `frontend/src/utils/studyPaceCoach.ts`

- [ ] **Step 1: Write failing tests**

覆盖空状态、复习债优先、计划不足、缺少模拟面试、节奏稳定和超前。

- [ ] **Step 2: Verify RED**

Run: `cd frontend; npm run test -- studyPaceCoach`

Expected: FAIL because `./studyPaceCoach` does not exist.

- [ ] **Step 3: Implement utility**

实现 `buildStudyPaceCoach(progress, now)`，输出状态、指标、首要行动和行动列表。

- [ ] **Step 4: Verify GREEN**

Run: `cd frontend; npm run test -- studyPaceCoach`

Expected: PASS.

### Task 2: 学习计划页接入

**Files:**
- Create: `frontend/src/components/StudyPaceCoachPanel.tsx`
- Modify: `frontend/src/pages/StudyPlan/index.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Render panel**

展示状态、摘要、首要行动和 4 个指标。

- [ ] **Step 2: Insert into StudyPlan**

放在备考目标设置后，面试简报前。

- [ ] **Step 3: Add responsive CSS**

桌面四列指标，移动端单列。

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
git add docs/superpowers/specs/2026-06-17-study-pace-coach-design.md docs/superpowers/plans/2026-06-17-study-pace-coach-implementation.md frontend/src/types.ts frontend/src/utils/studyPaceCoach.test.ts frontend/src/utils/studyPaceCoach.ts frontend/src/components/StudyPaceCoachPanel.tsx frontend/src/pages/StudyPlan/index.tsx frontend/src/styles/global.css
git commit -m "功能：新增备考配速教练"
```
