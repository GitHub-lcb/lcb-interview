# 模拟面试脚本追问回答修复动作设计

## 背景

`/practice` 已经具备本题面试官脚本和追问回答验收：用户可以从脚本带入追问，并实时看到回答是否正面回应、是否有证据、是否覆盖压力点、是否命中维度要求。当前缺口是：系统只告诉用户缺什么，但没有把缺口转换成可编辑的补答模板。

本阶段新增“追问回答修复动作”。当追问回答验收发现缺口时，用户可以一键把当前追问和原回答改写成带结构提示的补答草稿。该能力完全前端本地完成，不调用 AI，也不增加付费依赖。

## 目标

- 为追问回答验收结果生成一个最优先修复动作。
- 在 `PracticeScriptAnswerAcceptancePanel` 中展示修复按钮。
- 点击修复按钮后，把模板回填到 `/practice` 回答框。
- 模板保留当前 `追问：...` 上下文，避免用户丢失面试官问题。
- 修复方向覆盖：
  - 缺正面回应：补第一句结论。
  - 缺证据：补项目动作、指标和验证方式。
  - 缺压力点：补面试官压力点回应。
  - 缺维度要求：补当前脚本维度要求。
  - 全部通过：生成 45 秒口述压缩版。

## 非目标

- 不修改评分提交接口。
- 不修改 `InterviewAttempt` 存储结构。
- 不新增后端服务或 AI 调用。
- 不替换现有主答案修复动作；主答案结构修复和追问修复并存。

## 规则

### 动作选择

- 调用 `analyzePracticeScriptAnswerAcceptance(question, attempts, answer)` 获取验收结果。
- 取第一个未覆盖验收项作为修复方向。
- 若四项全部覆盖，则返回 `compress` 动作，用于压缩成 45 秒追问回答。

### 动作文案

- `direct`：按钮文案“补正面回应”。
- `evidence`：按钮文案“补项目证据”。
- `pressure`：按钮文案“补压力点”。
- `criterion`：按钮文案“补维度要求”。
- `compress`：按钮文案“压缩 45 秒版”。

### 模板结构

模板始终输出为回答框可直接编辑的完整内容：

```text
追问：<当前追问>

我的回答：
原回答保留：
<原回答或暂无原回答>

请按下面结构补齐：
正面回应：
...

项目证据：
...

压力点：
...

维度补强：
...
```

如果当前草稿不是追问格式，则模板引导用户先从本题面试官脚本带入追问。

## UI 设计

- 在 `PracticeScriptAnswerAcceptancePanel` 的下一步动作右侧加入一个小按钮。
- 使用 `ToolOutlined` 图标，按钮文案来自修复动作。
- 按钮只依赖父组件回调 `onUseRepairTemplate(template)`。
- 保持和 `PracticeAnswerReadinessPanel` 的修复按钮一致，减少学习成本。

## 测试策略

- 新增 `practiceScriptAnswerRepairAction.test.ts`：
  - 非追问回答返回“先带入追问”动作。
  - 缺证据时返回 `evidence`，模板保留追问和原回答。
  - 缺压力点时返回 `pressure`，模板包含压力点补强提示。
  - 四项通过时返回 `compress`，模板包含 45 秒压缩要求。
  - 输出不包含 `undefined`。
- 扩展 `PracticeScriptAnswerAcceptancePanel.test.tsx`：
  - 点击修复按钮后回调收到包含当前追问的模板。
- 页面接入后运行相关定向测试和全量验证。

## 验收标准

- `npm run test -- practiceScriptAnswerRepairAction PracticeScriptAnswerAcceptancePanel`
- `npm run test`
- `npm run build`
- `mvn test`
- `git diff --check`
