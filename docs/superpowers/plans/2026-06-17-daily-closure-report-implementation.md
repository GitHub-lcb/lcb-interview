# 今日闭环报告导出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use test-driven-development for Markdown behavior changes and verification-before-completion before commit. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让复制出去的冲刺报告包含今日计划闭环、今日作战队列和今日闭环下一步行动。

**Architecture:** 复用现有 `dailyPlanCompletion` 与 `dailyPlanBrief` 纯函数，在 `sprintReport` 中增加两个 Markdown 渲染段落，并扩展下一步行动。复制按钮无需改动，因为它已经统一调用 `buildSprintReportMarkdown`。

**Tech Stack:** React 18、TypeScript、Vitest、现有本地学习进度模型。

---

### Task 1: 文档提交

**Files:**
- Create: `docs/superpowers/specs/2026-06-17-daily-closure-report-design.md`
- Create: `docs/superpowers/plans/2026-06-17-daily-closure-report-implementation.md`

- [ ] **Step 1: 写设计文档**

记录背景、目标、非目标、报告章节、行为规则和测试策略。

- [ ] **Step 2: 写实现计划**

明确只改 `sprintReport` 工具和对应测试，不改 UI 交互。

- [ ] **Step 3: 提交文档**

```bash
git add docs/superpowers/specs/2026-06-17-daily-closure-report-design.md docs/superpowers/plans/2026-06-17-daily-closure-report-implementation.md
git commit -m "文档：设计今日闭环报告导出"
```

### Task 2: TDD 扩展报告内容

**Files:**
- Modify: `frontend/src/utils/sprintReport.test.ts`
- Modify: `frontend/src/utils/sprintReport.ts`

- [ ] **Step 1: Write failing tests**

在 `generates a portable markdown report with health, risks and warmups` 用例中增加断言：

```ts
expect(markdown).toContain('## 今日计划闭环')
expect(markdown).toContain('今日闭环还有风险')
expect(markdown).toContain('完成率：0%')
expect(markdown).toContain('复习债：1 道')
expect(markdown).toContain('薄弱题：1 道')
expect(markdown).toContain('## 今日作战简报')
expect(markdown).toContain('Java 并发 题目 1')
expect(markdown).toContain('今日闭环：')
```

在空报告用例中增加断言：

```ts
expect(markdown).toContain('## 今日计划闭环')
expect(markdown).toContain('今日计划待验收')
expect(markdown).toContain('## 今日作战简报')
expect(markdown).toContain('先生成今日计划')
```

- [ ] **Step 2: Verify RED**

Run: `cd frontend; npm run test -- sprintReport`

Expected: FAIL because the Markdown report does not contain the new daily closure sections.

- [ ] **Step 3: Implement minimal production code**

修改 `frontend/src/utils/sprintReport.ts`：

```ts
import type { DailyPlanBrief, DailyPlanCompletion } from '../types'
import { buildDailyPlanBrief } from './dailyPlanBrief'
import { buildDailyPlanCompletion } from './dailyPlanCompletion'
```

在主函数中生成 `completion` 和 `dailyBrief`，并加入：

```ts
renderDailyCompletionSection(completion),
renderDailyPlanBriefSection(dailyBrief),
renderActionSection(health, brief, completion),
```

新增 `renderDailyCompletionSection` 与 `renderDailyPlanBriefSection`，确保空数据也输出可行动文案。

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
git commit -m "功能：扩展今日闭环报告导出"
```
