# 冲刺报告错题恢复增强 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use test-driven-development for Markdown behavior changes and verification-before-completion before commit. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让复制出去的冲刺报告同时包含错题账本、错因恢复计划和错题恢复下一步行动。

**Architecture:** 在 `sprintReport` 中复用现有 `buildInterviewMistakeLedger` 与 `buildInterviewRecoveryPlan`，新增两个 Markdown 渲染段落，并扩展下一步行动。现有 UI 和独立恢复报告不变。

**Tech Stack:** React 18、TypeScript、Vitest、现有本地面试评分与学习进度模型。

---

### Task 1: 文档提交

**Files:**
- Create: `docs/superpowers/specs/2026-06-17-sprint-report-recovery-design.md`
- Create: `docs/superpowers/plans/2026-06-17-sprint-report-recovery-implementation.md`

- [ ] **Step 1: 写设计文档**

记录目标、非目标、章节顺序、渲染规则和测试策略。

- [ ] **Step 2: 写实现计划**

明确只改 `frontend/src/utils/sprintReport.ts` 和 `frontend/src/utils/sprintReport.test.ts`。

- [ ] **Step 3: 提交文档**

```bash
git add docs/superpowers/specs/2026-06-17-sprint-report-recovery-design.md docs/superpowers/plans/2026-06-17-sprint-report-recovery-implementation.md
git commit -m "文档：设计冲刺报告错题恢复"
```

### Task 2: TDD 扩展报告章节

**Files:**
- Modify: `frontend/src/utils/sprintReport.test.ts`
- Modify: `frontend/src/utils/sprintReport.ts`

- [ ] **Step 1: Write failing tests**

在非空报告用例中把题目 1 的模拟面试改成低分，并增加断言：

```ts
expect(markdown).toContain('## 面试错题账本')
expect(markdown).toContain('覆盖度反复失分')
expect(markdown).toContain('## 错题恢复计划')
expect(markdown).toContain('三步修复首要错因')
expect(markdown).toContain('/practice?queue=1')
expect(markdown).toContain('错题恢复：')
```

在空报告用例中增加断言：

```ts
expect(markdown).toContain('## 面试错题账本')
expect(markdown).toContain('面试错题本待建立')
expect(markdown).toContain('## 错题恢复计划')
expect(markdown).toContain('先建立面试样本')
```

- [ ] **Step 2: Verify RED**

Run: `cd frontend; npm run test -- sprintReport`

Expected: FAIL because the Markdown report does not contain mistake ledger or recovery plan sections.

- [ ] **Step 3: Implement minimal production code**

修改 `frontend/src/utils/sprintReport.ts`：

```ts
import type { InterviewMistakeLedger, InterviewRecoveryPlan } from '../types'
import { buildInterviewMistakeLedger } from './interviewMistakeLedger'
import { buildInterviewRecoveryPlan } from './interviewRecoveryPlan'
```

在主函数中生成 `mistakeLedger` 和 `recoveryPlan`，加入：

```ts
renderMistakeLedgerSection(mistakeLedger),
renderRecoveryPlanSection(recoveryPlan),
renderActionSection(health, brief, completion, recoveryPlan),
```

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
git commit -m "功能：扩展冲刺报告错题恢复"
```
