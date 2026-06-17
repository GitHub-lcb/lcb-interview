# 冲刺报告追问防线导出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use test-driven-development for Markdown behavior changes and verification-before-completion before commit. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让复制出去的冲刺报告包含面试追问防线，用户离线也能复盘最该防守的追问。

**Architecture:** 在 `sprintReport` 中复用 `buildInterviewFollowUpDefense(progress)`，新增 Markdown 渲染段落，并把追问防线主行动加入下一步行动。无 UI、后端和存储变更。

**Tech Stack:** TypeScript、Vitest、现有本地学习进度模型。

---

### Task 1: 文档提交

**Files:**
- Create: `docs/superpowers/specs/2026-06-17-sprint-report-follow-up-defense-design.md`
- Create: `docs/superpowers/plans/2026-06-17-sprint-report-follow-up-defense-implementation.md`

- [ ] **Step 1: Add docs**

写入设计文档和实施计划，明确导出章节、复用函数、空状态和测试范围。

- [ ] **Step 2: Commit docs**

```bash
git add docs/superpowers/specs/2026-06-17-sprint-report-follow-up-defense-design.md docs/superpowers/plans/2026-06-17-sprint-report-follow-up-defense-implementation.md
git diff --cached --check
git commit -m "文档：设计冲刺报告追问防线导出"
```

### Task 2: TDD 扩展冲刺报告导出

**Files:**
- Modify: `frontend/src/utils/sprintReport.test.ts`
- Modify: `frontend/src/utils/sprintReport.ts`

- [ ] **Step 1: Write failing tests**

非空报告断言：

```ts
expect(markdown).toContain('## 面试追问防线')
expect(markdown).toContain('先补高风险追问')
expect(markdown).toContain('防线追问')
expect(markdown).toContain('追问防线：')
```

空报告断言：

```ts
expect(markdown).toContain('追问防线待建立')
expect(markdown).toContain('用一次开口回答生成第一份追问防线')
```

- [ ] **Step 2: Verify RED**

```bash
cd frontend
npm run test -- sprintReport
```

Expected: FAIL because Markdown does not include follow-up defense yet.

- [ ] **Step 3: Implement report rendering**

在 `sprintReport.ts` 导入 `InterviewFollowUpDefense` 和 `buildInterviewFollowUpDefense`，新增 `renderFollowUpDefenseSection`，并扩展 `renderActionSection`。

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
git commit -m "功能：扩展冲刺报告追问防线导出"
```
