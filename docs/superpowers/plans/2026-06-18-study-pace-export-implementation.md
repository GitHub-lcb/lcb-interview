# 备考配速教练导出 Implementation Plan

**Goal:** 让学习计划页的备考配速教练支持 Markdown 导出，用户可以免费保存每日目标、节奏缺口、复习债、模拟样本和主行动。

**Architecture:** 复用 `buildStudyPaceCoach` 的结构化结果新增 `buildStudyPaceMarkdown`。面板只负责复制和下载降级，不改变配速判断算法。

## Task 1: 文档提交

新增设计文档和实施计划。

```bash
git add docs/superpowers/specs/2026-06-18-study-pace-export-design.md docs/superpowers/plans/2026-06-18-study-pace-export-implementation.md
git diff --cached --check
git commit -m "文档：设计备考配速教练导出"
```

## Task 2: TDD 增加 Markdown 导出测试

在 `frontend/src/utils/studyPaceCoach.test.ts` 中加入：

- 落后状态导出：
  - 标题包含目标岗位和“备考配速报告”。
  - 包含生成日期、配速概览、指标明细、行动队列。
  - 包含主行动入口 `/study`。
  - 不包含 `undefined`。
- 空状态导出：
  - 包含“建立轨迹”或进入题库动作。
  - 包含 `/banks`。
  - 不包含 `undefined`。

先运行：

```bash
npm run test -- studyPaceCoach
```

预期失败：`buildStudyPaceMarkdown` 尚未导出。

## Task 3: 实现 Markdown 导出函数

在 `frontend/src/utils/studyPaceCoach.ts` 中新增：

- `buildStudyPaceMarkdown(progress, now)`
- `renderPaceOverview(coach)`
- `renderPaceMetrics(metrics)`
- `renderPaceActions(actions)`
- `labelForPaceLevel(level)`
- `formatMarkdownDate(value)`

导出函数只消费 `buildStudyPaceCoach` 输出，保证页面和 Markdown 判断一致。

再次运行：

```bash
npm run test -- studyPaceCoach
```

预期通过。

## Task 4: 面板接入复制和下载降级

修改 `frontend/src/components/StudyPaceCoachPanel.tsx`：

- 引入 `CopyOutlined`、`message`、`buildStudyPaceMarkdown`。
- 主行动区增加“复制配速”按钮。
- 剪贴板成功时提示复制成功，失败时下载 Markdown。
- 保留原主行动按钮的补计划和跳转行为。

修改 `frontend/src/styles/global.css`：

- 为配速教练动作区增加按钮组布局。
- 保持移动端换行和左对齐。

修改 `frontend/src/components/StudyPaceCoachPanel.test.tsx`：

- 增加“复制配速”按钮测试。

## Task 5: 全量校验和提交

运行：

```bash
npm run test -- studyPaceCoach StudyPaceCoachPanel
npm run test
npm run build
mvn test
git diff --check
```

提交：

```bash
git add docs/superpowers/specs/2026-06-18-study-pace-export-design.md docs/superpowers/plans/2026-06-18-study-pace-export-implementation.md
git commit -m "文档：设计备考配速教练导出"
git add frontend/src/utils/studyPaceCoach.test.ts frontend/src/utils/studyPaceCoach.ts frontend/src/components/StudyPaceCoachPanel.tsx frontend/src/components/StudyPaceCoachPanel.test.tsx frontend/src/styles/global.css
git diff --cached --check
git commit -m "功能：新增备考配速教练导出"
```
