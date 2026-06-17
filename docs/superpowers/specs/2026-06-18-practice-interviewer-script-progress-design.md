# 模拟面试本题面试官脚本进度设计

## 背景

`/practice` 已经支持本题面试官脚本、脚本导出、追问回答验收和追问回答修复动作。用户可以选中脚本追问、回答、评分、再修复。但当前脚本面板仍然是静态的三问列表：它不知道用户已经练过哪一问、哪一问通过、下一问应该从哪里继续。

真实面试训练需要“多轮追问闭环”。本阶段新增“脚本进度”，从当前题历史模拟面试记录中识别脚本追问作答情况，在本题面试官脚本面板内显示每一步的状态、完成度和下一问。

## 目标

- 在本题面试官脚本面板顶部展示脚本完成度。
- 每个脚本步骤显示状态：
  - `pending`：还未回答这一问。
  - `attempted`：已经回答这一问，但追问验收未通过。
  - `passed`：已经回答并通过追问验收。
- 自动识别下一问：第一个未通过的步骤。
- 脚本步骤按钮文案根据状态变化：
  - pending：`带入回答框`
  - attempted：`继续修复`
  - passed：`重练这一问`
- 不新增后端存储，不修改 `InterviewAttempt` 结构。
- 所有判断前端本地完成，完全免费。

## 非目标

- 不引入计时器、语音、录音或复杂多轮聊天状态。
- 不把脚本进度写入 localStorage；进度从已有历史作答推导。
- 不改变提交评分逻辑。
- 不让脚本进度覆盖通用评分分数；它只反映脚本追问完成情况。

## 规则

### 数据来源

- 使用当前题 `InterviewAttempt[]`。
- 每条 attempt 的 `answer` 若包含 `追问：...`，则视为可能的脚本追问回答。
- 将解析出的 prompt 与当前脚本步骤 prompt 做归一化匹配。

### 状态判定

- 无匹配 attempt：`pending`。
- 有匹配 attempt，但 `analyzePracticeScriptAnswerAcceptance(...).level !== 'passed'`：`attempted`。
- 有匹配 attempt，且追问验收为 `passed`：`passed`。
- 一个步骤有多次 attempt 时，按 `createdAt` 取最新一次作为状态依据。

### 汇总

- `passedCount`：通过步骤数。
- `attemptedCount`：有作答记录但未通过步骤数。
- `progressPercent`：`passedCount / totalSteps * 100`，四舍五入。
- `nextStep`：第一个非 passed 步骤；若全部通过则为空。
- `summary`：
  - 无作答：提示从第一问开始。
  - 部分作答：提示继续下一问或修复未过步骤。
  - 全部通过：提示进入重练或导出。

## UI 设计

- 在 `PracticeInterviewerScriptPanel` 标题区下方新增一条紧凑进度条。
- 每个脚本步骤顶部显示状态标签：
  - 待练
  - 修复中
  - 已通过
- 步骤卡片增加状态 class，用边框和背景轻量区分。
- 右侧栏空间有限，避免新增大卡片；进度信息嵌入现有脚本面板。

## 测试策略

- 新增 `practiceInterviewerScriptProgress.test.ts`：
  - 无追问回答时三个步骤均为 `pending`。
  - 当前脚本第一问回答通过后，该步骤为 `passed`，下一问为第二问。
  - 当前脚本第一问回答未过验收时，该步骤为 `attempted`，下一问仍为第一问。
  - 多次回答同一问时，以最新 attempt 为准。
  - 输出不包含 `undefined`。
- 扩展 `PracticeInterviewerScriptPanel.test.tsx`：
  - 渲染完成度文本。
  - 已通过步骤显示 `已通过`。
  - 未过步骤按钮显示 `继续修复`。

## 验收标准

- `npm run test -- practiceInterviewerScriptProgress PracticeInterviewerScriptPanel`
- `npm run test`
- `npm run build`
- `mvn test`
- `git diff --check`
