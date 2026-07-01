# 沉浸式闯关刷题第一版设计

## 背景

当前前台功能覆盖了题库、学习计划、复盘、能力图、模拟练习和面经材料，但普通访问者的核心诉求更直接：选一个方向，持续刷题，提取知识，学到东西。第一版改造目标是把前台主体验从“学习驾驶舱”收敛为“沉浸式闯关刷题”。

本设计采用已确认的视觉方向：高级学习副本。大类是技术副本，章节是线性关卡地图，普通题是快速 battle，章节末尾是 Boss 综合表达战。

## 目标

- 用户选择某个大类后，可以直接进入游戏闯关式刷题体验。
- 刷题过程只围绕当前题目、解析、自评、下一题，不再被计划、复盘、能力面板打断。
- 游戏化服务学习目标：推进感、连击、星级、奖励都必须和题目掌握、复刷、Boss 表达能力挂钩。
- 第一版优先复用现有公开 API、题目数据、前端学习进度本地存储和面试评分接口，不新增后端表。

## 非目标

- 第一版不做账号云端进度同步。
- 第一版不做排行榜、装备、角色养成、赛季系统。
- 第一版不重做后台管理、AI 生成、草稿审核。
- 第一版不要求每道普通题都提交 AI 评分，避免破坏刷题节奏。
- 第一版不删除原有页面，但主入口和导航会弱化旧学习驾驶舱。

## 核心体验

用户路径：

1. 进入首页或题库页。
2. 选择一个大类，例如 Java 基础。
3. 进入该大类的“技术副本”页。
4. 在章节地图中点击“继续闯关”。
5. 普通题 battle：先看题，心里作答或写草稿，再展开解析。
6. 用户自评：击破、模糊、重练。
7. 系统记录状态、连击、XP、星级进度，自动进入下一题。
8. 普通题完成后进入 Boss 战。
9. Boss 战必须输入答案并评分；达到通过阈值后完成章节结算。
10. 结算页展示星级、薄弱题、奖励和下一章入口。

## 第一版页面范围

### 1. 技术副本入口

位置建议：替换或重构现有 `/banks` 的主体验。

展示内容：

- 大类卡片：名称、描述、总题数、当前进度、星级摘要。
- 推荐继续副本：优先显示最近进行中的分类。
- 操作入口：继续闯关、查看副本地图。

视觉规则：

- 主卡片使用清透蓝绿渐变和轻阴影。
- 蓝色表示当前推进，青绿色表示掌握，金色表示奖励，深色只用于 Boss 状态。

### 2. 章节地图页

路由建议：`/challenge/category/:id`

数据来源：

- 分类详情：复用 `GET /api/categories/{id}`。
- 题目列表：复用 `GET /api/questions?category=:id&page=...&size=...`。
- 本地进度：复用并扩展 `useStudyProgress` 对题目状态、快照和练习记录的管理。

章节生成规则：

- 第一版不新增后端章节表。
- 按当前分类下题目顺序切分章节，每章 8-12 道普通题。
- 每章最后追加一个 Boss 战。Boss 题可以取本章难度最高或浏览量最高题，也可以复用最后一道题作为综合表达题。
- 章节名称第一版可用固定模板：入门关、核心关、进阶关、综合关。后续再按标签生成更精细标题。

地图状态：

- locked：未解锁。
- current：当前章节或当前题。
- passed：已通过。
- weak：章节内存在重练题。
- boss：Boss 战节点。

### 3. 普通题 battle 页

路由建议：`/challenge/category/:id/play?chapter=:chapterIndex&question=:questionIndex`

主区域：

- 当前关卡信息：Battle 08、章节名、进度。
- 当前题目标题和题干。
- 可选提示：从标签、难度、结构化答案字段中提取 2-3 个提示。
- 展开解析按钮。

解析展开后展示：

- 核心击破点：来自 `summary`、`principle` 或 `content` 的摘要。
- 面试口径：优先展示 `answer`、`scenario`、`projectExp`。
- 容易扣分点：优先展示 `risk`。

自评按钮：

- 击破：标记为 mastered，连击 +1，XP 增加。
- 模糊：标记为 learning，加入复刷队列，连击不断但星级扣分。
- 重练：标记为 weak，加入复刷队列，连击清零或增加风险提示。

交互原则：

- 普通题不强制输入答案。
- 支持快捷键：空格展开解析，1/2/3 自评，Enter 下一题。
- 自评后给轻量反馈：节点闪动、XP 上浮、连击徽章闪烁；不做长动画。

### 4. Boss 战页

路由建议：`/challenge/category/:id/boss?chapter=:chapterIndex`

视觉：

- 使用局部暗色竞技场风格，形成章节高潮。
- 不把全站改成暗黑，避免阅读疲劳。

规则：

- 必须输入答案。
- 复用现有 `POST /api/interview/evaluate`。
- AI 不可用时保留本地规则评分降级。
- 评分维度展示为：结论、机制、场景、风险。前端可映射现有 `InterviewFeedback.criteria`。

通过阈值：

- 60 分及以上：章节通过。
- 80 分及以上：Boss 优秀，章节星级可提升。
- 低于 60 分：章节可结算为未完全通关，提示重练 Boss 或复刷薄弱题。

### 5. 章节结算页

路由建议：`/challenge/category/:id/result?chapter=:chapterIndex`

展示内容：

- 星级：1-3 星。
- 本章普通题统计：击破、模糊、重练。
- Boss 分数和最弱评分项。
- 奖励：XP、知识碎片、徽章。
- 下一步：进入下一章、复刷薄弱题、回到地图。

星级规则：

- 3 星：普通题无重练，模糊不超过 1 道，Boss >= 80。
- 2 星：章节通过，Boss >= 60，允许少量模糊或重练。
- 1 星：完成普通题但 Boss 未达标，或重练题较多。

## 状态模型

第一版只扩展前端本地状态，避免引入后端迁移。

建议新增前端类型：

```ts
export type ChallengeQuestionResult = 'cleared' | 'uncertain' | 'failed'

export interface ChallengeQuestionState {
  questionId: number
  result: ChallengeQuestionResult
  answeredAt: string
}

export interface ChallengeBossAttempt {
  chapterIndex: number
  questionId: number
  score: number
  passed: boolean
  createdAt: string
}

export interface ChallengeChapterState {
  categoryId: number
  chapterIndex: number
  currentQuestionIndex: number
  results: Record<number, ChallengeQuestionState>
  bossAttempts: ChallengeBossAttempt[]
  stars: number
  completedAt?: string
}

export interface ChallengeProgress {
  activeCategoryId?: number
  combo: number
  xp: number
  chapters: Record<string, ChallengeChapterState>
}
```

存储方式：

- 复用本地存储思路，新增 `lcb-challenge-progress`。
- 同步写入现有 `StudyProgress.questionStates`，保证旧页面仍能识别掌握、学习中和薄弱。
- `cleared` 对应 `mastered`。
- `uncertain` 对应 `learning`。
- `failed` 对应 `weak`。

## 边界和降级

### 空分类

如果分类下没有可用题目：

- 技术副本卡片显示“暂无可挑战题目”。
- 地图页不生成关卡，提供返回题库入口。
- 不展示 Boss 战入口。

### 题量不足

如果分类题量不足 8 道：

- 第一版仍生成一个短章节。
- 普通题数量按实际题量展示。
- Boss 题复用浏览量最高或难度最高的题目。
- 结算页说明“短章节”，不影响星级规则。

### 分页数据

现有题目接口强制分页。第一版不一次性拉取全分类所有题目，避免分类题量过大时拖慢入口。

- 地图页优先加载前 40 道题生成前 3-4 个章节。
- 用户进入后续章节时再按需加载下一页题目。
- 如果加载失败，保留已加载章节，当前章节显示重试按钮。

### Boss 评分失败

Boss 战复用现有面试评分接口。失败时按以下顺序降级：

1. 如果后端返回本地规则评分，使用本地规则评分。
2. 如果请求失败但用户已输入答案，允许保存草稿并提示稍后重试。
3. 不把接口失败记为用户战败，不清空连击和章节进度。

### 本地存储不可用

如果 `localStorage` 不可用：

- 当前会话使用内存状态继续闯关。
- 页面提示“进度仅本次有效”。
- 不阻断刷题主流程。

## 组件拆分

建议新增目录：`frontend/src/pages/Challenge/`

文件职责：

- `index.tsx`：挑战路由入口，根据 URL 显示地图、普通题、Boss 或结算。
- `ChallengeMap.tsx`：技术副本和章节地图。
- `ChallengePlay.tsx`：普通题 battle。
- `ChallengeBoss.tsx`：Boss 战。
- `ChallengeResult.tsx`：章节结算。
- `challengeProgress.ts`：状态读写、章节切分、星级计算、奖励计算。
- `challengeTheme.ts`：高级学习副本视觉 token。

第一版可以先不拆太细，但不能再把所有逻辑塞进 `Practice/index.tsx`。

## 导航调整

顶部导航第一版收敛为：

- 题库
- 闯关
- 搜索
- 更多

旧页面处理：

- `/study`、`/practice`、`/routes`、`/experiences` 保留，但放入“更多”。
- 首页优先展示“继续闯关”和“选择副本”，不再堆叠多个学习驾驶舱面板。

## 视觉规范

主风格：高级学习副本。

色彩：

- 推进蓝：`#2563EB`
- 掌握青绿：`#14B8A6` / `#10B981`
- 奖励金：`#F59E0B`
- Boss 深色：`#0F172A`
- 背景浅灰：`#F8FAFC`

形态：

- 主卡片圆角 22-30px。
- 小节点圆角 16-26px。
- 主容器可以有轻阴影；普通列表和密集内容减少阴影。
- Boss 页允许暗色、发光边和更强对比。

动效：

- 节点完成：轻微放大后回弹。
- XP：数字上浮 600ms 内结束。
- 连击：徽章闪烁一次。
- 页面切换不做复杂转场，避免影响刷题效率。

## 测试策略

前端测试已经瘦身，第一版不恢复大规模 UI 测试。

必须保留的验证：

- `npm run build`
- `npm run test`
- `challengeProgress.ts` 纯逻辑测试：章节切分、星级计算、状态同步。

可选手工 QA：

- 从 `/banks` 进入某个分类副本。
- 完成普通题三种自评。
- 进入 Boss 并提交答案。
- 结算页星级和下一章解锁正确。
- 刷新后进度仍在。

## 第一版验收标准

- 用户能从分类进入闯关地图。
- 用户能完成一个章节的普通题 battle。
- 用户能进入 Boss 战并得到评分。
- 章节结算能展示星级、奖励、薄弱题和下一步。
- 旧题库、搜索、题目详情仍可访问。
- 前端构建和保留测试通过。

## 后续增强

- 后端持久化闯关进度。
- 按标签自动生成更准确的章节地图。
- 知识卡片收藏和成就墙。
- 限时挑战或排位冲刺支线。
- 更完整的动画和音效开关。
