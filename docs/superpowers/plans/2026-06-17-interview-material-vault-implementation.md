# 高分表达素材库 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在学习计划页新增高分表达素材库，把用户 80 分以上的模拟面试回答自动沉淀成可复述话术。

**Architecture:** 新增纯前端工具函数从 `StudyProgress` 派生素材库数据；新增 React 面板消费该数据；学习计划页只负责渲染面板和导航。无后端、存储和路由结构变更。

**Tech Stack:** React 18、TypeScript、Vitest、Testing Library、Ant Design 5。

---

### Task 1: 文档提交

**Files:**
- Create: `docs/superpowers/specs/2026-06-17-interview-material-vault-design.md`
- Create: `docs/superpowers/plans/2026-06-17-interview-material-vault-implementation.md`

- [ ] **Step 1: Add docs**

写入设计文档和实施计划，明确素材来源、筛选阈值、抽取策略、页面位置和测试范围。

- [ ] **Step 2: Commit**

Run:

```bash
git add docs/superpowers/specs/2026-06-17-interview-material-vault-design.md docs/superpowers/plans/2026-06-17-interview-material-vault-implementation.md
git commit -m "文档：设计高分表达素材库"
```

### Task 2: 工具函数 TDD

**Files:**
- Create: `frontend/src/utils/interviewMaterialVault.test.ts`
- Create: `frontend/src/utils/interviewMaterialVault.ts`
- Modify: `frontend/src/types.ts`

- [ ] **Step 1: Write failing tests**

覆盖空进度、低分过滤、高分场景/风险抽取、多分类 ready 状态。

- [ ] **Step 2: Verify RED**

Run:

```bash
cd frontend
npm run test -- interviewMaterialVault
```

Expected: fail because `./interviewMaterialVault` cannot be resolved.

- [ ] **Step 3: Add types and implementation**

在 `types.ts` 新增 `InterviewMaterialVault` 相关类型，实现 `buildInterviewMaterialVault(progress)`。函数只沉淀 80 分及以上回答，并限制最多 6 条素材。

- [ ] **Step 4: Verify GREEN**

Run:

```bash
cd frontend
npm run test -- interviewMaterialVault
```

Expected: all tests pass.

### Task 3: 组件与学习计划页接入 TDD

**Files:**
- Create: `frontend/src/components/InterviewMaterialVaultPanel.test.tsx`
- Create: `frontend/src/components/InterviewMaterialVaultPanel.tsx`
- Modify: `frontend/src/pages/StudyPlan/index.tsx`
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Write failing component test**

测试面板展示素材库标题、指标、素材卡片，并在点击主行动时调用导航回调。

- [ ] **Step 2: Verify RED**

Run:

```bash
cd frontend
npm run test -- InterviewMaterialVaultPanel
```

Expected: fail because component does not exist.

- [ ] **Step 3: Implement panel and wire StudyPlan**

新增素材库面板，接入学习计划页面试复盘区域。主行动和素材卡片点击使用 `onNavigate(to)`。

- [ ] **Step 4: Verify GREEN**

Run:

```bash
cd frontend
npm run test -- InterviewMaterialVaultPanel
```

Expected: all tests pass.

### Task 4: 全量验证与提交

**Files:**
- All changed frontend/docs files.

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

- [ ] **Step 2: Commit implementation**

Run:

```bash
git add frontend/src/types.ts frontend/src/utils/interviewMaterialVault.test.ts frontend/src/utils/interviewMaterialVault.ts frontend/src/components/InterviewMaterialVaultPanel.test.tsx frontend/src/components/InterviewMaterialVaultPanel.tsx frontend/src/pages/StudyPlan/index.tsx frontend/src/styles/global.css
git commit -m "功能：新增高分表达素材库"
```
