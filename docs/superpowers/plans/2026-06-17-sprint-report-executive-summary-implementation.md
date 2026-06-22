# 冲刺报告一页作战摘要 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use test-driven-development for Markdown behavior changes and verification-before-completion before commit. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在冲刺报告顶部增加可快速扫描的一页作战摘要。

**Architecture:** 在 `sprintReport` 中新增一个 Markdown 渲染函数，复用同一函数内已经生成的健康报告、今日闭环、错题账本和恢复计划。无需新增文件、状态或接口。

**Tech Stack:** React 18、TypeScript、Vitest、现有本地学习进度模型。

---

### Task 1: 文档提交

**Files:**
- Create: `docs/superpowers/specs/2026-06-17-sprint-report-executive-summary-design.md`
- Create: `docs/superpowers/plans/2026-06-17-sprint-report-executive-summary-implementation.md`

- [ ] **Step 1: 写设计文档**

说明摘要位置、摘要字段、行为规则和测试策略。

- [ ] **Step 2: 写实现计划**

明确只改 `frontend/src/utils/sprintReport.ts` 和 `frontend/src/utils/sprintReport.test.ts`。

- [ ] **Step 3: 提交文档**

```bash
git add docs/superpowers/specs/2026-06-17-sprint-report-executive-summary-design.md docs/superpowers/plans/2026-06-17-sprint-report-executive-summary-implementation.md
git commit -m "文档：设计冲刺报告作战摘要"
```

### Task 2: TDD 新增摘要章节

**Files:**
- Modify: `frontend/src/utils/sprintReport.test.ts`
- Modify: `frontend/src/utils/sprintReport.ts`

- [ ] **Step 1: Write failing tests**

在非空报告用例中增加断言：

```ts
expect(markdown).toContain('## 一页作战摘要')
expect(markdown).toContain('总分：')
expect(markdown).toContain('今日闭环：今日闭环还有风险')
expect(markdown).toContain('错题恢复：')
expect(markdown).toContain('先做健康动作：')
```

在空报告用例中增加断言：

```ts
expect(markdown).toContain('## 一页作战摘要')
expect(markdown).toContain('今日闭环：今日计划待验收')
expect(markdown).toContain('先建立面试样本')
```

- [ ] **Step 2: Verify RED**

Run: `cd frontend; npm run test -- sprintReport`

Expected: FAIL because the Markdown report does not contain the executive summary section.

- [ ] **Step 3: Implement minimal production code**

新增 `renderExecutiveSummarySection(health, completion, mistakeLedger, recoveryPlan)` 并在基础信息后插入。

- [ ] **Step 4: Verify GREEN**

Run: `cd frontend; npm run test -- sprintReport`

Expected: PASS.

### Task 3: 全量验证和提交

**Files:**
- Modify: `frontend/src/utils/sprintReport.test.ts`
- Modify: `frontend/src/utils/sprintReport.ts`

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
git add frontend/src/utils/sprintReport.test.ts frontend/src/utils/sprintReport.ts
git commit -m "功能：新增冲刺报告作战摘要"
```
