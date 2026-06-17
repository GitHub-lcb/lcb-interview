# 备考健康雷达导出 Implementation Plan

**Goal:** 让首页备考健康雷达支持 Markdown 导出，用户可以免费保存健康分、风险维度、四项诊断和主行动。

**Architecture:** 复用 `buildPrepHealthReport` 的结构化结果新增 `buildPrepHealthMarkdown`。面板只负责复制和下载降级，不改变健康评分和主行动选择算法。

## Task 1: 文档提交

新增设计文档和实施计划。

```bash
git add docs/superpowers/specs/2026-06-18-prep-health-export-design.md docs/superpowers/plans/2026-06-18-prep-health-export-implementation.md
git diff --cached --check
git commit -m "文档：设计备考健康雷达导出"
```

## Task 2: TDD 增加 Markdown 导出测试

在 `frontend/src/utils/prepHealth.test.ts` 中加入：

- 风险状态导出：
  - 标题包含目标岗位和“备考健康雷达”。
  - 包含生成日期、健康概览、维度诊断、主行动。
  - 包含主行动入口 `/study`。
  - 不包含 `undefined`。
- 空状态导出：
  - 包含“建立学习轨迹”。
  - 包含 `/study`。
  - 不包含 `undefined`。

先运行：

```bash
npm run test -- prepHealth
```

预期失败：`buildPrepHealthMarkdown` 尚未导出。

## Task 3: 实现 Markdown 导出函数

在 `frontend/src/utils/prepHealth.ts` 中新增：

- `buildPrepHealthMarkdown(routes, progress, now)`
- `renderPrepHealthOverview(report)`
- `renderPrepHealthDimensions(report.dimensions)`
- `renderPrepHealthPrimaryAction(report.primaryAction)`
- `labelForHealthLevel(level)`
- `labelForDimensionStatus(status)`
- `formatMarkdownDate(value)`

导出函数只消费 `buildPrepHealthReport` 输出，保证页面和 Markdown 诊断一致。

再次运行：

```bash
npm run test -- prepHealth
```

预期通过。

## Task 4: 面板接入复制和下载降级

修改 `frontend/src/components/PrepHealthRadarPanel.tsx`：

- 引入 `CopyOutlined`、`message`、`buildPrepHealthMarkdown`
- 主行动区域增加“复制雷达”按钮
- 剪贴板成功提示复制成功，失败下载 Markdown

修改 `frontend/src/styles/global.css`：

- 为健康雷达行动按钮组增加横向/换行布局。
- 保持移动端左对齐。

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
git add frontend/src/utils/prepHealth.test.ts frontend/src/utils/prepHealth.ts frontend/src/components/PrepHealthRadarPanel.tsx frontend/src/styles/global.css
git diff --cached --check
git commit -m "功能：新增备考健康雷达导出"
```
