# 模拟面试本题脚本进度复盘导出实施计划

## 现状

- `practiceInterviewerScriptProgress.ts` 已能计算脚本、逐问状态、通过数、修复中数、进度百分比和下一问。
- `PracticeInterviewerScriptPanel` 已展示进度条和逐问状态。
- 面板已有复制脚本和 Markdown 下载降级函数，可复用到进度导出。

## 实施步骤

1. 在 `practiceInterviewerScriptProgress.ts` 增加 `buildPracticeInterviewerScriptProgressMarkdown`。
   - 输入：题目、历史记录、生成时间。
   - 输出：稳定 Markdown 文本。
   - 逐问状态映射为中文：待练、修复中、已通过。

2. 为进度导出补单元测试。
   - 覆盖无进度、已通过、修复中、最近练习时间。
   - 校验 Markdown 不包含 `undefined`。

3. 在 `PracticeInterviewerScriptPanel` 接入“复制进度”。
   - 进度条区域增加按钮。
   - 复制成功提示“本题脚本进度已复制”。
   - 复制失败下载 `{题目}-本题脚本进度.md`。

4. 为面板补交互测试。
   - mock 剪贴板。
   - 点击“复制进度”后断言 Markdown 包含脚本进度和题目标题。

5. 验证。
   - 目标测试：`npm run test -- practiceInterviewerScriptProgress PracticeInterviewerScriptPanel`
   - 构建：`npm run build`

## 风险与处理

- 风险：脚本和进度导出文案重复，页面按钮含义混淆。
  - 处理：按钮命名明确区分“复制脚本”和“复制进度”。
- 风险：追问记录改变脚本阶段。
  - 处理：继续复用进度工具内的正式回答 / 追问回答拆分逻辑。
