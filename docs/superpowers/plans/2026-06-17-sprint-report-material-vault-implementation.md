# 冲刺报告高分素材导出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use test-driven-development for Markdown behavior changes and verification-before-completion before commit. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让复制出去的冲刺报告包含高分表达素材库，用户离线也能复盘可复述话术。

**Architecture:** 在 `sprintReport` 中复用 `buildInterviewMaterialVault(progress)` 生成素材库数据，新增 Markdown 渲染段落，并把素材库主行动加入下一步行动。无 UI、后端和存储变更。

**Tech Stack:** TypeScript、Vitest、现有本地学习进度模型。

---

### Task 1: 文档提交

**Files:**
- Create: `docs/superpowers/specs/2026-06-17-sprint-report-material-vault-design.md`
- Create: `docs/superpowers/plans/2026-06-17-sprint-report-material-vault-implementation.md`

- [ ] **Step 1: Add docs**

写入设计文档和实施计划，明确导出章节、复用函数、空状态和测试范围。

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-06-17-sprint-report-material-vault-design.md docs/superpowers/plans/2026-06-17-sprint-report-material-vault-implementation.md
git commit -m "文档：设计冲刺报告高分素材导出"
```

### Task 2: TDD 扩展冲刺报告

**Files:**
- Modify: `frontend/src/utils/sprintReport.test.ts`
- Modify: `frontend/src/utils/sprintReport.ts`

- [ ] **Step 1: Write failing tests**

在非空报告测试中断言：

```ts
expect(markdown).toContain('## 高分表达素材库')
expect(markdown).toContain('项目场景')
expect(markdown).toContain('订单高峰期并发扣库存')
expect(markdown).toContain('高分素材：')
```

在空报告测试中断言：

```ts
expect(markdown).toContain('高分表达素材待沉淀')
expect(markdown).toContain('先做一题模拟')
```

- [ ] **Step 2: Verify RED**

Run:

```bash
cd frontend
npm run test -- sprintReport
```

Expected: FAIL because Markdown does not yet include material vault section.

- [ ] **Step 3: Implement report rendering**

Import `InterviewMaterialVault` and `buildInterviewMaterialVault` in `sprintReport.ts`; render material vault section and add material action to `renderActionSection`.

- [ ] **Step 4: Verify GREEN**

Run:

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
git commit -m "功能：扩展冲刺报告高分素材导出"
```
