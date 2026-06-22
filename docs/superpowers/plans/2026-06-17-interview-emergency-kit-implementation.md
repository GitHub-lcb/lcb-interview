# 面试前急救包 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use test-driven-development for the utility and component behavior, then verification-before-completion before commit. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在学习计划页新增一个完全免费的 30 分钟临场急救包，按本地进度给出最后一轮高优先级行动。

**Architecture:** 新增 `interviewEmergencyKit` 纯函数复用现有复习排期、今日闭环、错因账本和恢复计划；新增 `InterviewEmergencyKitPanel` 负责展示和跳转；`StudyPlan` 只负责插入组件。所有逻辑在前端本地计算。

**Tech Stack:** React 18、TypeScript、Vitest、Testing Library、Ant Design 5。

---

### Task 1: 文档提交

**Files:**
- Create: `docs/superpowers/specs/2026-06-17-interview-emergency-kit-design.md`
- Create: `docs/superpowers/plans/2026-06-17-interview-emergency-kit-implementation.md`

- [ ] **Step 1: 写设计文档**

记录背景、目标、非目标、生成规则、页面位置和测试策略。

- [ ] **Step 2: 写实现计划**

明确类型、工具函数、组件、页面接入和验证命令。

- [ ] **Step 3: 提交文档**

```bash
git add docs/superpowers/specs/2026-06-17-interview-emergency-kit-design.md docs/superpowers/plans/2026-06-17-interview-emergency-kit-implementation.md
git commit -m "文档：设计面试前急救包"
```

### Task 2: TDD 实现急救包生成器

**Files:**
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/utils/interviewEmergencyKit.test.ts`
- Create: `frontend/src/utils/interviewEmergencyKit.ts`

- [ ] **Step 1: Write failing tests**

覆盖空进度、复习债优先、错因恢复入口、30 分钟预算和 ready 状态。

- [ ] **Step 2: Verify RED**

Run: `cd frontend; npm run test -- interviewEmergencyKit`

Expected: FAIL because `./interviewEmergencyKit` does not exist.

- [ ] **Step 3: Add types**

在 `frontend/src/types.ts` 新增急救包相关类型。

- [ ] **Step 4: Implement utility**

实现 `buildInterviewEmergencyKit(progress, now)`，复用 `buildScheduledReviewQueue`、`buildInterviewMistakeLedger`、`buildInterviewRecoveryPlan`、`buildDailyPlanCompletion` 和 `buildDailyPracticePath`。

- [ ] **Step 5: Verify GREEN**

Run: `cd frontend; npm run test -- interviewEmergencyKit`

Expected: PASS.

### Task 3: 组件和页面接入

**Files:**
- Create: `frontend/src/components/InterviewEmergencyKitPanel.test.tsx`
- Create: `frontend/src/components/InterviewEmergencyKitPanel.tsx`
- Modify: `frontend/src/pages/StudyPlan/index.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Write failing component test**

验证组件渲染标题、总耗时、主按钮和行动列表。

- [ ] **Step 2: Implement component**

组件使用 `buildInterviewEmergencyKit`，按钮用 `useNavigate` 跳转。

- [ ] **Step 3: Wire StudyPlan**

在 `DailyPlanCompletionPanel` 后插入 `InterviewEmergencyKitPanel`。

- [ ] **Step 4: Add styles**

复用现有白底、8px 圆角、指标网格和紧凑行动列表风格，移动端单列。

### Task 4: 全量验证和提交

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

- [ ] **Step 5: Commit implementation**

```bash
git add frontend/src/types.ts frontend/src/utils/interviewEmergencyKit.test.ts frontend/src/utils/interviewEmergencyKit.ts frontend/src/components/InterviewEmergencyKitPanel.test.tsx frontend/src/components/InterviewEmergencyKitPanel.tsx frontend/src/pages/StudyPlan/index.tsx frontend/src/styles/global.css
git commit -m "功能：新增面试前急救包"
```
