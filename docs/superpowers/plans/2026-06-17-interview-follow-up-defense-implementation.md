# 面试追问防线 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use test-driven-development for behavior changes and verification-before-completion before commit. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在学习计划页聚合最近模拟面试的高风险追问，让用户免费获得一份跨题“追问防线”。

**Architecture:** 新增 `interviewFollowUpDefense` utility 复用现有 `buildFollowUpDrillPack`，将每题最新回答转成防线条目。新增 React 面板读取该报告并接入 `StudyPlan`，样式沿用现有学习页卡片体系。

**Tech Stack:** TypeScript、React 18、Ant Design 5、Vitest、Testing Library。

---

### Task 1: 文档提交

**Files:**
- Create: `docs/superpowers/specs/2026-06-17-interview-follow-up-defense-design.md`
- Create: `docs/superpowers/plans/2026-06-17-interview-follow-up-defense-implementation.md`

- [ ] **Step 1: Add docs**

写入设计和实施计划，明确复用追问生成器、学习页位置、状态、测试范围。

- [ ] **Step 2: Commit docs**

```bash
git add docs/superpowers/specs/2026-06-17-interview-follow-up-defense-design.md docs/superpowers/plans/2026-06-17-interview-follow-up-defense-implementation.md
git diff --cached --check
git commit -m "文档：设计面试追问防线"
```

### Task 2: TDD 新增追问防线报告

**Files:**
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/utils/interviewFollowUpDefense.test.ts`
- Create: `frontend/src/utils/interviewFollowUpDefense.ts`

- [ ] **Step 1: Write failing utility tests**

测试应断言：

```ts
expect(report.level).toBe('empty')
expect(report.primaryAction).toMatchObject({ label: '先做一题模拟', to: '/practice' })
expect(report.items[0].prompt).toContain('线上')
expect(report.items[0].questionId).toBe(2)
expect(report.items).toHaveLength(5)
```

- [ ] **Step 2: Verify RED**

```bash
cd frontend
npm run test -- interviewFollowUpDefense
```

Expected: FAIL because `interviewFollowUpDefense` does not exist yet.

- [ ] **Step 3: Add types and implementation**

新增类型：

```ts
export type InterviewFollowUpDefenseLevel = 'empty' | 'risk' | 'pressure' | 'ready'
```

实现 `buildInterviewFollowUpDefense(progress)`，每题取最新 attempt，调用 `buildFollowUpDrillPack(snapshot, answer, feedback)`，最多输出 5 条防线。

- [ ] **Step 4: Verify GREEN**

```bash
cd frontend
npm run test -- interviewFollowUpDefense
```

Expected: PASS.

### Task 3: TDD 新增学习页面板

**Files:**
- Create: `frontend/src/components/InterviewFollowUpDefensePanel.test.tsx`
- Create: `frontend/src/components/InterviewFollowUpDefensePanel.tsx`
- Modify: `frontend/src/pages/StudyPlan/index.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Write failing component test**

测试面板应渲染标题、指标、追问 prompt，并在点击主行动时调用 `onNavigate(report.primaryAction.to)`。

- [ ] **Step 2: Verify RED**

```bash
cd frontend
npm run test -- InterviewFollowUpDefensePanel
```

Expected: FAIL because component does not exist yet.

- [ ] **Step 3: Implement panel and styles**

面板使用 `QuestionCircleOutlined`、`ThunderboltOutlined`、`ArrowRightOutlined`，展示指标网格和追问条目。CSS 使用 `.interview-follow-up-defense-*` 前缀。

- [ ] **Step 4: Wire into StudyPlan**

在 `InterviewMaterialVaultPanel` 后、`InterviewBriefPanel` 前插入：

```tsx
<InterviewFollowUpDefensePanel progress={progress} onNavigate={navigate} />
```

- [ ] **Step 5: Verify component**

```bash
cd frontend
npm run test -- InterviewFollowUpDefensePanel
```

Expected: PASS.

### Task 4: 全量验证与提交

**Files:**
- Modified files from Tasks 2-3.

- [ ] **Step 1: Run verification**

```bash
cd frontend
npm run test
npm run build
cd ../backend
mvn test
cd ..
git diff --check
```

- [ ] **Step 2: Commit implementation**

```bash
git add frontend/src/types.ts frontend/src/utils/interviewFollowUpDefense.ts frontend/src/utils/interviewFollowUpDefense.test.ts frontend/src/components/InterviewFollowUpDefensePanel.tsx frontend/src/components/InterviewFollowUpDefensePanel.test.tsx frontend/src/pages/StudyPlan/index.tsx frontend/src/styles/global.css
git diff --cached --check
git commit -m "功能：新增面试追问防线"
```
