# 冲刺报告今日任务导出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use test-driven-development for Markdown behavior changes and verification-before-completion before commit. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让冲刺报告包含首页“今日冲刺任务”，把诊断报告升级成可以直接执行的任务清单。

**Architecture:** 在 `sprintReport` 中复用 `buildDailyMissionPlan(routes, progress, now)`，新增 Markdown 渲染段落，并把首个任务加入下一步行动。无 UI、后端和存储变更。

**Tech Stack:** TypeScript、Vitest、现有本地学习进度模型。

---

### Task 1: 文档提交

**Files:**
- Create: `docs/superpowers/specs/2026-06-17-sprint-report-daily-mission-design.md`
- Create: `docs/superpowers/plans/2026-06-17-sprint-report-daily-mission-implementation.md`

- [ ] **Step 1: Add docs**

写入设计文档和实施计划，明确复用函数、章节位置、空状态和测试范围。

- [ ] **Step 2: Commit docs**

```bash
git add docs/superpowers/specs/2026-06-17-sprint-report-daily-mission-design.md docs/superpowers/plans/2026-06-17-sprint-report-daily-mission-implementation.md
git diff --cached --check
git commit -m "文档：设计冲刺报告今日任务导出"
```

### Task 2: TDD 扩展冲刺报告导出

**Files:**
- Modify: `frontend/src/utils/sprintReport.test.ts`
- Modify: `frontend/src/utils/sprintReport.ts`

- [ ] **Step 1: Write failing tests**

非空报告断言：

```ts
expect(markdown).toContain('## 今日冲刺任务')
expect(markdown).toContain('来自智能复习排期')
expect(markdown).toContain('今日任务：')
```

空报告断言：

```ts
expect(markdown).toContain('完成首次模拟面试')
expect(markdown).toContain('生成今日计划')
```

- [ ] **Step 2: Verify RED**

```bash
cd frontend
npm run test -- sprintReport
```

Expected: FAIL because Markdown does not include daily missions yet.

- [ ] **Step 3: Implement report rendering**

在 `sprintReport.ts` 导入 `DailyMissionPlan` 和 `buildDailyMissionPlan`，新增 `renderDailyMissionSection`，并扩展 `renderActionSection`。

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
git commit -m "功能：扩展冲刺报告今日任务导出"
```
