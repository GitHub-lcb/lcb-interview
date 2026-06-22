# 模拟面试回答实时结构检查 Implementation Plan

**Goal:** 让 `/practice` 页面在用户提交评分之前实时提示回答草稿是否覆盖结论、机制、场景和边界，减少空泛答案进入评分链路。

**Architecture:** 新增 `frontend/src/utils/practiceAnswerReadiness.ts` 纯函数模块分析当前题和回答草稿。新增 `PracticeAnswerReadinessPanel` 展示总分、下一步动作和四段命中状态。`Practice` 页面把 `current` 与 `answerDraft` 传入面板。

## Task 1: 文档提交

新增设计文档和实施计划，明确实时检查规则、等级、UI 位置和测试范围。

```bash
git add docs/superpowers/specs/2026-06-18-practice-answer-readiness-design.md docs/superpowers/plans/2026-06-18-practice-answer-readiness-implementation.md
git diff --cached --check
git commit -m "文档：设计模拟面试回答实时结构检查"
```

## Task 2: TDD 增加纯函数测试

新增 `frontend/src/utils/practiceAnswerReadiness.test.ts`：

- 空回答：
  - `level` 为 `empty`
  - `score` 为 0
  - 下一步提示先写结论
- 结构完整回答：
  - `level` 为 `sharp`
  - `score` 为 100
  - 四段全部命中
- 部分回答：
  - 未命中场景和边界
  - 下一步提示补场景
  - 输出不包含 `undefined`

先运行：

```bash
npm run test -- practiceAnswerReadiness
```

预期失败：模块或 `analyzePracticeAnswerReadiness` 尚不存在。

## Task 3: 实现实时结构检查纯函数

新增 `frontend/src/utils/practiceAnswerReadiness.ts`：

- `analyzePracticeAnswerReadiness(question, answer)`
- `buildReadinessItem(key, answer, keywords)`
- `extractQuestionSignals(question)`
- `normalize(value)`
- `resolveReadinessLevel(score, answer)`
- `resolveNextAction(items)`

再次运行：

```bash
npm run test -- practiceAnswerReadiness
```

预期通过。

## Task 4: TDD 增加面板测试

新增 `frontend/src/components/PracticeAnswerReadinessPanel.test.tsx`：

- 空回答渲染标题和优先动作。
- 完整回答渲染 100 分和“可以提交评分”。

先运行：

```bash
npm run test -- PracticeAnswerReadinessPanel
```

预期失败：组件尚不存在。

## Task 5: 实现面板并接入 Practice 页

新增 `frontend/src/components/PracticeAnswerReadinessPanel.tsx`：

- 使用 `Progress`、`CheckCircleOutlined`、`ExclamationCircleOutlined`。
- 展示总分、等级标题、下一步动作和四个维度。

修改 `frontend/src/pages/Practice/index.tsx`：

- 引入 `PracticeAnswerReadinessPanel`。
- 放在 `Input.TextArea` 和提交按钮之间。

修改 `frontend/src/styles/global.css`：

- 新增实时检查面板、维度条目、移动端样式。

再次运行：

```bash
npm run test -- PracticeAnswerReadinessPanel
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
git add frontend/src/utils/practiceAnswerReadiness.test.ts frontend/src/utils/practiceAnswerReadiness.ts frontend/src/components/PracticeAnswerReadinessPanel.test.tsx frontend/src/components/PracticeAnswerReadinessPanel.tsx frontend/src/pages/Practice/index.tsx frontend/src/styles/global.css
git diff --cached --check
git commit -m "功能：新增模拟面试回答实时结构检查"
```
