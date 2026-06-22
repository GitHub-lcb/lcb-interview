# 岗位能力地图导出 Implementation Plan

**Goal:** 让首页岗位能力地图支持 Markdown 导出，用户可以免费保存每条岗位路线的准备度、短板指标和下一步训练入口。

**Architecture:** 复用 `buildAbilityMap` 的结构化结果新增 `buildAbilityMapMarkdown`。面板只负责复制和下载降级，不改变能力地图评分、排序和队列生成算法。

## Task 1: 文档提交

新增设计文档和实施计划。

```bash
git add docs/superpowers/specs/2026-06-18-ability-map-export-design.md docs/superpowers/plans/2026-06-18-ability-map-export-implementation.md
git diff --cached --check
git commit -m "文档：设计岗位能力地图导出"
```

## Task 2: TDD 增加 Markdown 导出测试

在 `frontend/src/utils/abilityMap.test.ts` 中加入：

- 有本地题目轨迹时导出：
  - 标题包含目标岗位和“岗位能力地图”。
  - 包含生成日期、总览、岗位画像、准备度和 `/practice?queue=2`。
  - 不包含 `undefined`。
- 空画像导出：
  - 包含“待建立”。
  - 包含 `/routes` 下一步入口。
  - 不包含 `undefined`。

先运行：

```bash
npm run test -- abilityMap
```

预期失败：`buildAbilityMapMarkdown` 尚未导出。

## Task 3: 实现 Markdown 导出函数

在 `frontend/src/utils/abilityMap.ts` 中新增：

- `buildAbilityMapMarkdown(routes, progress, now)`
- `renderAbilityMapOverview(items)`
- `renderAbilityMapItems(items)`
- `labelForAbilityLevel(level)`
- `buildAbilityNextStep(item)`
- `formatMarkdownDate(value)`

导出函数只消费 `buildAbilityMap` 输出，保证页面和 Markdown 的能力画像一致。

再次运行：

```bash
npm run test -- abilityMap
```

预期通过。

## Task 4: 面板接入复制和下载降级

修改 `frontend/src/components/AbilityMapPanel.tsx`：

- 引入 `CopyOutlined`、`message`、`buildAbilityMapMarkdown`
- 标题右侧增加“复制地图”按钮
- 剪贴板成功提示复制成功，失败下载 Markdown

修改 `frontend/src/styles/global.css`：

- 为 `ability-map-heading-actions` 增加紧凑布局。
- 移动端保持左对齐。

## Task 5: 全量校验和提交

运行：

```bash
npm run test
npm run build
mvn test
git diff --check
```

提交：

```bash
git add frontend/src/utils/abilityMap.test.ts frontend/src/utils/abilityMap.ts frontend/src/components/AbilityMapPanel.tsx frontend/src/styles/global.css
git diff --cached --check
git commit -m "功能：新增岗位能力地图导出"
```
