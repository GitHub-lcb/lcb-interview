# 备考路线战术包导出 Implementation Plan

**Goal:** 让 `/routes` 页面支持 Markdown 导出，把免费路线、个人化进度和下一步训练入口变成可复制的战术包。

**Architecture:** 在 `routeProgress` 中新增 `buildRoutePlaybookMarkdown` 纯函数，复用 `buildRouteProgressList`。`PrepRoutes` 页面只负责复制和下载降级，不重新拼装业务数据。

## Task 1: 文档提交

新增设计文档和实施计划，明确导出字段、按钮位置、空状态和测试范围。

```bash
git add docs/superpowers/specs/2026-06-18-route-playbook-export-design.md docs/superpowers/plans/2026-06-18-route-playbook-export-implementation.md
git diff --cached --check
git commit -m "文档：设计备考路线战术包导出"
```

## Task 2: TDD 增加纯函数导出测试

在 `frontend/src/utils/routeProgress.test.ts` 中加入：

- 有路线轨迹的导出：
  - 标题包含目标岗位和“备考路线战术包”。
  - 包含生成日期、路线总览、路线战术、阶段、覆盖方向、训练入口。
  - 不包含 `undefined`。
- 空路线轨迹导出：
  - 包含“先搜索并打开几道题建立本地轨迹”。
  - 包含路线 action 的兜底入口。
  - 不包含 `undefined`。

先运行：

```bash
npm run test -- routeProgress
```

预期失败：`buildRoutePlaybookMarkdown` 尚未导出。

## Task 3: 实现 Markdown 导出函数

在 `frontend/src/utils/routeProgress.ts` 中新增：

- `buildRoutePlaybookMarkdown(routes, progress, now)`
- `renderRoutePlaybookOverview(routeProgressList)`
- `renderRoutePlaybookItems(routeProgressList)`
- `renderRouteNextStep(routeProgress)`
- `formatMarkdownDate(value)`
- `sanitizeMarkdownValue(value)`

再次运行：

```bash
npm run test -- routeProgress
```

预期通过。

## Task 4: TDD 增加页面复制测试

新增 `frontend/src/pages/PrepRoutes/index.test.tsx`：

- 向 `localStorage` 写入能匹配 Java 路线的题目快照和状态。
- mock `navigator.clipboard.writeText`。
- 渲染 `/routes` 页面并点击“复制路线包”。
- 断言写入 Markdown 包含“备考路线战术包”“路线战术”和 `/practice?queue=`。

先运行：

```bash
npm run test -- PrepRoutes
```

预期失败：按钮尚不存在。

## Task 5: 页面接入复制和下载降级

修改 `frontend/src/pages/PrepRoutes/index.tsx`：

- 引入 `CopyOutlined`、`message` 和 `buildRoutePlaybookMarkdown`。
- 增加 `handleCopyRoutePlaybook`。
- 在头部说明下增加“复制路线包”按钮。
- 剪贴板成功提示复制成功，失败下载 Markdown。

修改 `frontend/src/styles/global.css`：

- 增加 `prep-hero-actions` 紧凑按钮布局。
- 移动端保持按钮左对齐，不挤压统计区。

再次运行：

```bash
npm run test -- PrepRoutes
```

预期通过。

## Task 6: 全量校验和提交

运行：

```bash
npm run test
npm run build
mvn test
git diff --check
```

提交：

```bash
git add frontend/src/utils/routeProgress.test.ts frontend/src/utils/routeProgress.ts frontend/src/pages/PrepRoutes/index.tsx frontend/src/pages/PrepRoutes/index.test.tsx frontend/src/styles/global.css
git diff --cached --check
git commit -m "功能：新增备考路线战术包导出"
```
