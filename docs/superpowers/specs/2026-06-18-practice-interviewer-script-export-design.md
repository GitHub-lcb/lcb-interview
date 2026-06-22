# 模拟面试本题面试官脚本导出设计

## 背景

`/practice` 已新增“本题面试官脚本”，能根据当前题和最近评分生成连续三步追问。但当前脚本只能在页面内查看，用户如果想把本题追问流程保存到个人笔记、发给学习搭子或后续离线复盘，需要手动复制每个步骤。

本阶段增加 Markdown 导出，让脚本从页面能力变成可携带的训练资产，继续强化“完全免费、可离线沉淀、可长期复盘”的差异化体验。

## 目标

- 为 `practiceInterviewerScript` 增加 Markdown 构建函数。
- Markdown 内容包含：
  - 标题和生成日期
  - 题目上下文
  - 脚本状态、摘要和总时长
  - 三个追问步骤的 prompt、压力点、回答提示和时长
- 在 `PracticeInterviewerScriptPanel` 顶部增加“复制脚本”按钮。
- 剪贴板可用时复制 Markdown。
- 剪贴板不可用或失败时下载 Markdown 文件。
- 所有逻辑前端本地完成，完全免费，不调用外部接口。

## 非目标

- 不新增后端接口。
- 不改变追问脚本生成规则。
- 不引入第三方 Markdown 导出库。
- 不把导出内容写入浏览器存储。

## UI 设计

- 按钮放在面板头部状态区域，文案“复制脚本”。
- 使用现有 Ant Design `CopyOutlined` 图标。
- 复制成功提示“本题面试官脚本已复制”。
- 复制失败降级下载，提示“剪贴板不可用，已下载 Markdown 脚本”。
- 文件名格式：`<题目标题>-本题面试官脚本.md`，非法字符替换为 `-`。

## Markdown 结构

```markdown
# <题目标题> 本题面试官脚本

生成时间：2026-06-18
分类：Java 集合
难度：HARD

## 脚本概览
- 状态：进阶面试官脚本
- 总时长：3 分钟
- 说明：...

## 追问步骤
1. 方案对比
   - 问题：...
   - 维度：进阶追问
   - 时长：75 秒
   - 压力点：...
   - 回答提示：...
```

## 测试策略

- 扩展 `practiceInterviewerScript.test.ts`：
  - `buildPracticeInterviewerScriptMarkdown` 输出标题、日期、脚本概览和追问步骤。
  - 空状态导出不包含 `undefined`。
- 扩展 `PracticeInterviewerScriptPanel.test.tsx`：
  - mock `navigator.clipboard.writeText`。
  - 点击“复制脚本”后写入 Markdown。
  - 断言 Markdown 包含“本题面试官脚本”和题目标题。

## 验收标准

- `npm run test -- practiceInterviewerScript PracticeInterviewerScriptPanel`
- `npm run test`
- `npm run build`
- `mvn test`
- `git diff --check`
