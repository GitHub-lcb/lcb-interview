# 备考指挥中心下一轮训练实施计划

## Goal

让首页备考指挥中心直接展示下一轮训练队列摘要，并把队列写入指挥中心 Markdown 导出，强化“进站即训练”的免费闭环。

## Architecture

`buildStudyCommandMarkdown` 构建一个 `NextTrainingQueue` 并渲染独立章节；`StudyCommandCenter` 使用 `buildNextTrainingQueue(progress, now, 3)` 展示轻量摘要和主行动。所有排序、去重和主行动规则都继续由 `nextTrainingQueue.ts` 负责。

## Task 1: RED tests

Modify `frontend/src/utils/studyStrategy.test.ts`:

- 在现有导出测试中断言 Markdown 包含 `## 下一轮训练队列`、`来源：`、`主行动：`。
- 在空状态导出测试中断言包含 `暂无下一轮训练题`。

Modify `frontend/src/components/StudyCommandCenter.test.tsx`:

- 断言页面出现“下一轮训练”和主行动按钮。
- 断言复制的 Markdown 包含 `## 下一轮训练队列`。

Command:

```bash
cd frontend
npm run test -- studyStrategy StudyCommandCenter
```

Expected: FAIL，原因是当前指挥中心尚未渲染或导出下一轮训练队列。

## Task 2: Utility implementation

Modify `frontend/src/utils/studyStrategy.ts`:

- Import `NextTrainingQueue` and `buildNextTrainingQueue`.
- In `buildStudyCommandMarkdown`, build `nextTrainingQueue`.
- Add `renderCommandNextTrainingQueue(queue)`.
- Place the new section between `renderCommandFactors` and `renderCommandActions`.

## Task 3: Component implementation

Modify `frontend/src/components/StudyCommandCenter.tsx`:

- Import `buildNextTrainingQueue` and `formatNextTrainingQueueItemMeta`.
- Use `useMemo` to build queue with limit 3.
- Add a summary block above `.command-action-row`.
- Main action button navigates to `queue.primaryAction.to`.
- Item rows navigate to each `item.to`.

Modify `frontend/src/styles/global.css`:

- Add `.command-next-training` styles.
- Ensure mobile layout wraps without text overflow.

## Task 4: Verification

Commands:

```bash
cd frontend
npm run test -- studyStrategy StudyCommandCenter
npm run test
npm run build
cd ..
git diff --check
git add frontend/src/utils/studyStrategy.test.ts frontend/src/utils/studyStrategy.ts frontend/src/components/StudyCommandCenter.test.tsx frontend/src/components/StudyCommandCenter.tsx frontend/src/styles/global.css docs/superpowers/specs/2026-06-18-study-command-next-training-design.md docs/superpowers/plans/2026-06-18-study-command-next-training-implementation.md
git commit -m "功能：指挥中心增加下一轮训练"
```
