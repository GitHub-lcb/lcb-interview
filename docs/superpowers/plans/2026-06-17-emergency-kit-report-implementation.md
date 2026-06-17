# 面试前急救包报告导出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use test-driven-development for Markdown behavior changes and verification-before-completion before commit. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让复制出去的冲刺报告包含面试前急救包，支持离线临场复盘。

**Architecture:** 在 `sprintReport` 中复用 `buildInterviewEmergencyKit`，新增 Markdown 渲染段落。复制按钮、页面组件和急救包生成器不变。

**Tech Stack:** React 18、TypeScript、Vitest、现有本地学习进度模型。

---

### Task 1: 文档提交

**Files:**
- Create: `docs/superpowers/specs/2026-06-17-emergency-kit-report-design.md`
- Create: `docs/superpowers/plans/2026-06-17-emergency-kit-report-implementation.md`

- [ ] **Step 1: 写设计文档**

记录章节位置、渲染字段、行为规则和测试策略。

- [ ] **Step 2: 写实现计划**

明确只改 `frontend/src/utils/sprintReport.ts` 和 `frontend/src/utils/sprintReport.test.ts`。

- [ ] **Step 3: 提交文档**

```bash
git add docs/superpowers/specs/2026-06-17-emergency-kit-report-design.md docs/superpowers/plans/2026-06-17-emergency-kit-report-implementation.md
git commit -m "文档：设计急救包报告导出"
```

### Task 2: TDD 接入报告

**Files:**
- Modify: `frontend/src/utils/sprintReport.test.ts`
- Modify: `frontend/src/utils/sprintReport.ts`

- [ ] **Step 1: Write failing tests**

非空报告新增断言：

```ts
expect(markdown).toContain('## 面试前急救包')
expect(markdown).toContain('面试前先压最高风险')
expect(markdown).toContain('预计耗时：24 分钟')
expect(markdown).toContain('先清复习债')
```

空报告新增断言：

```ts
expect(markdown).toContain('## 面试前急救包')
expect(markdown).toContain('先建立临场样本')
expect(markdown).toContain('/practice')
```

- [ ] **Step 2: Verify RED**

Run: `cd frontend; npm run test -- sprintReport`

Expected: FAIL because the report does not contain the emergency kit section.

- [ ] **Step 3: Implement minimal production code**

在 `sprintReport.ts` 引入 `buildInterviewEmergencyKit`，生成 `emergencyKit` 并新增 `renderEmergencyKitSection(emergencyKit)`。

- [ ] **Step 4: Verify GREEN**

Run: `cd frontend; npm run test -- sprintReport`

Expected: PASS.

### Task 3: 全量验证和提交

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
git commit -m "功能：扩展急救包报告导出"
```
