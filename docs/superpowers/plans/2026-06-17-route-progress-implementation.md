# 路线进度增强实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将路线页从静态介绍升级为基于本地学习进度的个人路线面板。

**Architecture:** 新增纯函数 `routeProgress.ts` 负责路线归属、统计和排序；路线页只负责渲染和调用 `addDailyPlanQuestions`。不新增后端接口，避免路线页加载时触发大量查询。

**Tech Stack:** React 18, Vite, TypeScript, Ant Design 5, Vitest.

---

## File Structure

- Create `frontend/src/utils/routeProgress.test.ts`: 路线进度规则测试。
- Create `frontend/src/utils/routeProgress.ts`: 路线进度计算纯函数。
- Modify `frontend/src/pages/PrepRoutes/index.tsx`: 接入本地进度和路线行动按钮。
- Modify `frontend/src/styles/global.css`: 增加路线进度条、指标和按钮布局样式。

## Task 1: Route Progress TDD

- [ ] 写 `routeProgress.test.ts`，覆盖分类命中、标签命中、完成度、排序和空状态。
- [ ] 运行 `npm run test -- routeProgress`，确认因为缺少实现而失败。
- [ ] 实现 `routeProgress.ts`，添加中文注释说明匹配与排序原因。
- [ ] 再次运行 `npm run test -- routeProgress`，确认通过。

## Task 2: PrepRoutes UI Integration

- [ ] 在 `PrepRoutes` 中读取 `useStudyProgress()`。
- [ ] 使用 `buildRouteProgressList(prepRoutes, progress)` 渲染路线。
- [ ] 每张路线卡展示完成度、已跟踪、计划内、薄弱题。
- [ ] 有候选题时提供“加入今日计划”和“路线训练”按钮。
- [ ] 无候选题时保留搜索和路线浏览动作。
- [ ] 运行 `npm run build`。

## Task 3: Styles

- [ ] 增加 `.prep-route-progress`、`.prep-route-metrics`、`.prep-route-card-alert` 样式。
- [ ] 保证 760px 以下单列，按钮不溢出。
- [ ] 运行 `npm run build`。

## Task 4: Verification And Commit

- [ ] 运行 `npm run test -- routeProgress`。
- [ ] 运行 `npm run test`。
- [ ] 运行 `npm run build`。
- [ ] 运行 `mvn test`。
- [ ] 运行 `git diff --check`。
- [ ] 中文提交：`功能：增强路线页个人进度`。

## Self-Review

- 覆盖设计文档全部验收标准。
- 没有新增后端接口，保持本期范围可控。
- 复杂规则会在代码中用中文解释原因。

