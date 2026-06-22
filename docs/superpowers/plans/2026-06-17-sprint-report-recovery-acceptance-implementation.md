# 冲刺报告错题恢复验收导出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use test-driven-development for Markdown behavior changes and verification-before-completion before commit. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让冲刺报告导出错题恢复是否通过复测，形成“错因 -> 计划 -> 验收”的闭环。

**Architecture:** 在 `sprintReport` 中复用 `buildInterviewRecoveryAcceptance(progress, mistakeLedger)`，新增 Markdown 章节，并把验收主行动加入下一步行动。无 UI、后端和存储变更。

**Tech Stack:** TypeScript、Vitest、现有本地学习进度模型。

---

### Task 1: 文档提交

**Files:**
- Create: `docs/superpowers/specs/2026-06-17-sprint-report-recovery-acceptance-design.md`
- Create: `docs/superpowers/plans/2026-06-17-sprint-report-recovery-acceptance-implementation.md`

- [ ] **Step 1: Add docs**

写入设计文档和实施计划，明确导出章节、复用函数、空状态和测试范围。

- [ ] **Step 2: Commit docs**

```bash
git add docs/superpowers/specs/2026-06-17-sprint-report-recovery-acceptance-design.md docs/superpowers/plans/2026-06-17-sprint-report-recovery-acceptance-implementation.md
git diff --cached --check
git commit -m "文档：设计冲刺报告错题验收导出"
```

### Task 2: TDD 扩展冲刺报告导出

**Files:**
- Modify: `frontend/src/utils/sprintReport.test.ts`
- Modify: `frontend/src/utils/sprintReport.ts`

- [ ] **Step 1: Write failing tests**

非空报告断言：

```ts
expect(markdown).toContain('## 错题恢复验收')
expect(markdown).toContain('最新复测仍未过线')
expect(markdown).toContain('已验收：0/1')
expect(markdown).toContain('错题验收：')
```

空报告断言：

```ts
expect(markdown).toContain('等待建立验收样本')
expect(markdown).toContain('先完成一次模拟面试，系统才能判断错因修复是否真的过线')
```

- [ ] **Step 2: Verify RED**

```bash
cd frontend
npm run test -- sprintReport
```

Expected: FAIL because Markdown does not include recovery acceptance yet.

- [ ] **Step 3: Implement report rendering**

在 `sprintReport.ts` 导入 `InterviewRecoveryAcceptance` 和 `buildInterviewRecoveryAcceptance`，新增 `renderRecoveryAcceptanceSection`，并扩展 `renderActionSection`。

- [ ] **Step 4: Verify GREEN**

```bash
cd frontend
npm run test -- sprintReport
```

Expected: PASS.

### Task 3: 全量验证与提交

**Files:**
- Modify: `frontend/src/utils/sprintReport.test.ts`
- Modify: `frontend/src/utils/sprintReport.ts`

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
git add frontend/src/utils/sprintReport.test.ts frontend/src/utils/sprintReport.ts
git diff --cached --check
git commit -m "功能：扩展冲刺报告错题验收导出"
```
