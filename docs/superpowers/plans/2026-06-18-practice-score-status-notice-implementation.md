# 模拟面试评分状态同步提示实施计划

## 范围

- `frontend/src/utils/studyProgress.ts`
- `frontend/src/utils/studyProgress.test.ts`
- `frontend/src/pages/Practice/index.tsx`
- `frontend/src/styles/global.css`

## 步骤

1. 在 `studyProgress.test.ts` 新增状态提示测试：
   - 55 分返回 `weak` 和“加入今日计划”。
   - 72 分返回 `learning` 和“学习中”。
   - 86 分返回 `mastered` 和“已掌握”。
2. 运行聚焦测试确认红测失败。
3. 在 `studyProgress.ts` 导出 `describeInterviewStatusSync(score)`。
4. 让 `recordInterviewAttempt` 复用同一分数到状态映射，避免规则分叉。
5. 在练习页 `feedback` 分数卡下展示提示文案。
6. 为提示添加轻量 CSS，不引入新视觉体系。
7. 运行聚焦测试、全量测试和构建。
8. 中文提交。

## 风险控制

- 提示文案由工具层统一生成，页面只渲染。
- 保留手动标记按钮，自动状态不是不可逆操作。
- 不新增复杂组件，降低样式回归面。
