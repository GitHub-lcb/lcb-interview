# 冲刺报告岗位能力地图导出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use test-driven-development for Markdown behavior changes and verification-before-completion before commit. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让冲刺报告导出路线级岗位能力画像，用户离线查看报告时也能知道最该补哪个能力域和从哪个训练队列进入。

**Architecture:** 复用 `buildAbilityMap(routes, progress)` 生成能力项，在 `sprintReport.ts` 中新增 Markdown 渲染函数和下一步行动行。无需新增 UI、后端接口或存储结构。

**Tech Stack:** TypeScript、Vitest、现有本地学习进度模型、现有岗位能力地图算法。

---

### Task 1: 文档提交

**Files:**
- Create: `docs/superpowers/specs/2026-06-17-sprint-report-ability-map-export-design.md`
- Create: `docs/superpowers/plans/2026-06-17-sprint-report-ability-map-export-implementation.md`

- [ ] **Step 1: Add design and plan docs**

写入设计文档和实施计划，明确导出章节、复用函数、空状态、下一步行动和测试范围。

- [ ] **Step 2: Verify docs diff**

Run:

```bash
git diff -- docs/superpowers/specs/2026-06-17-sprint-report-ability-map-export-design.md docs/superpowers/plans/2026-06-17-sprint-report-ability-map-export-implementation.md
```

Expected: two new docs only.

- [ ] **Step 3: Commit docs**

Run:

```bash
git add docs/superpowers/specs/2026-06-17-sprint-report-ability-map-export-design.md docs/superpowers/plans/2026-06-17-sprint-report-ability-map-export-implementation.md
git diff --cached --check
git commit -m "文档：设计冲刺报告能力地图导出"
```

Expected: commit succeeds with only docs staged.

### Task 2: TDD 扩展报告断言

**Files:**
- Modify: `frontend/src/utils/sprintReport.test.ts`

- [ ] **Step 1: Add failing assertions to non-empty report test**

Add after the existing follow-up defense assertions:

```ts
expect(markdown).toContain('## 岗位能力地图')
expect(markdown).toContain('Java 后端冲刺路线｜Java 后端')
expect(markdown).toContain('准备度')
expect(markdown).toContain('薄弱 1 道')
expect(markdown).toContain('/practice?queue=1,3')
expect(markdown).toContain('能力地图：训练 Java 后端冲刺路线')
```

- [ ] **Step 2: Add failing assertions to empty report test**

Add near the existing route/trajectory assertions:

```ts
expect(markdown).toContain('## 岗位能力地图')
expect(markdown).toContain('还没有岗位能力轨迹')
expect(markdown).toContain('能力地图：打开备考路线')
expect(markdown).toContain('/routes')
```

- [ ] **Step 3: Verify RED**

Run:

```bash
cd frontend
npm run test -- sprintReport
```

Expected: FAIL because `## 岗位能力地图` is not exported yet.

### Task 3: 实现能力地图导出

**Files:**
- Modify: `frontend/src/utils/sprintReport.ts`

- [ ] **Step 1: Import ability map dependencies**

Add `AbilityMapItem` to the type import and import the builder:

```ts
import type { AbilityMapItem, ... } from '../types'
import { buildAbilityMap } from './abilityMap'
```

- [ ] **Step 2: Build and render ability map**

Inside `buildSprintReportMarkdown`, add:

```ts
const abilityMap = buildAbilityMap(routes, progress)
```

Insert after `renderFollowUpDefenseSection(followUpDefense)`:

```ts
renderAbilityMapSection(abilityMap),
```

Pass `abilityMap` into `renderActionSection`.

- [ ] **Step 3: Add section renderer**

Add:

```ts
function renderAbilityMapSection(items: AbilityMapItem[]): string {
  const focus = items.find(item => item.nextQuestionIds.length > 0)
  const summary = focus
    ? `当前最需要补强 ${focus.title}，准备度 ${focus.readinessScore} 分。`
    : '还没有岗位能力轨迹，先从目标路线进入题目建立样本。'
  const lines = items.length > 0
    ? items.slice(0, 5).map(item => {
      const to = item.nextQuestionIds.length > 0
        ? `/practice?queue=${item.nextQuestionIds.join(',')}`
        : '/routes'
      return `- ${item.title}｜${item.role}：准备度 ${item.readinessScore} 分，薄弱 ${item.weak} 道，学习中 ${item.learning} 道，已掌握 ${item.mastered} 道，已记录 ${item.remembered} 道；${item.summary}；入口：${to}`
    })
    : ['- 暂无路线配置，先进入备考路线确认目标岗位。']

  return [
    '## 岗位能力地图',
    `- 总览：${summary}`,
    ...lines,
    '',
  ].join('\n')
}
```

- [ ] **Step 4: Add action line**

Extend `renderActionSection` signature with `abilityMap: AbilityMapItem[]` and insert:

```ts
buildAbilityActionLine(abilityMap),
```

Add:

```ts
function buildAbilityActionLine(items: AbilityMapItem[]): string {
  const focus = items.find(item => item.nextQuestionIds.length > 0)
  if (focus) {
    return `- 能力地图：训练 ${focus.title} - 先补 ${focus.nextQuestionIds.length} 道未掌握题，把岗位能力短板拉回学习中。（/practice?queue=${focus.nextQuestionIds.join(',')}）`
  }
  return '- 能力地图：打开备考路线 - 先建立岗位能力样本，系统才会生成路线级短板。（/routes）'
}
```

- [ ] **Step 5: Verify GREEN**

Run:

```bash
cd frontend
npm run test -- sprintReport
```

Expected: PASS.

### Task 4: 全量验证与实现提交

**Files:**
- Modify: `frontend/src/utils/sprintReport.test.ts`
- Modify: `frontend/src/utils/sprintReport.ts`

- [ ] **Step 1: Run full verification**

Run:

```bash
cd frontend
npm run test
npm run build
cd ../backend
mvn test
cd ..
git diff --check
```

Expected: frontend tests, production build, backend tests and diff check all succeed.

- [ ] **Step 2: Commit implementation**

Run:

```bash
git add frontend/src/utils/sprintReport.test.ts frontend/src/utils/sprintReport.ts
git diff --cached --check
git commit -m "功能：扩展冲刺报告能力地图导出"
```

Expected: commit succeeds with only implementation and tests staged.
