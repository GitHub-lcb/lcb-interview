# 快乐8 Jev 决策模型接入说明

> 对应实现：`backend/src/main/java/com/lcbinterview/service/LotteryKl8Jev*`、`JevRuntimeConfig*`、`JevProbabilityScorer`
> 依赖评估：见 `2026-09-20-kl8-decision-model-assessment.md`

## 1. 定位：Jev 是决策层，不是预言机

Jev（TypeSafe AI 的 System One 模型）与生成式 LLM 有本质区别：

| 维度 | 生成式 LLM（现有 `LotteryKl8AiRecommendationService`） | Jev |
|---|---|---|
| 输入 | 提示词 | 状态 + 类型化问题 |
| 输出 | 自由文本（需要解析 JSON、容错重试） | 类型化答案 + 校准概率（无格式错误） |
| 原语 | 无 | `Noul`（是/否概率）、`Choice`（多选一 + 全分布）、`Score`（有序量表） |
| 并行度 | 单轮生成 | 同一状态下的多个问题并行求解 |
| 端点 | OpenAI 兼容 `/chat/completions` | `POST /v1/systemone` |

**必须写在前面的边界：** 快乐8 每期从 80 个号码中开出 20 个，单号真实概率恒为 0.25。
Jev 返回的概率是**校准过的模型信念**，不是对随机开奖的预测能力，不会改变任何号码的实际开出概率。
所以本接入的设计目标不是"提高命中率"，而是：

1. 用类型化接口替掉文本解析，拿到一份**结构稳定、成本极低**的概率分布；
2. 用 **Brier 分数 + 配对 t 检验**把"模型有没有判别力"这件事变成可证伪的数字；
3. 在证据出现之前，**不允许概率影响推荐号码**。

## 2. 环境变量

密钥只走环境变量，不落库——避免在生产库中堆积第三方密钥。

| 变量 | 默认值 | 说明 |
|---|---|---|
| `JEV_ENABLED` | `false` | Jev 决策层总开关 |
| `TYPESAFE_API_KEY` | 空 | API Key，缺失时所有 Jev 接口返回配置错误 |
| `JEV_MODEL` | `jev-latest` | 模型标识，用别名而非固定版本号，避免版本滚动后失效 |
| `JEV_URL` | `https://api.typesafe.ai/v1/systemone` | System One 单端点 |
| `JEV_TIMEOUT_MS` | `15000` | 单次调用超时 |
| `JEV_ALLOW_SCORING` | `false` | **人工闸门**：是否允许 Jev 概率参与推荐排序 |
| `JEV_PROMPT_LOCALE` | `zh` | 送模型的提示词语言（`zh` / `en`）。只切换 `state` 文案与问题文本，不影响面向用户的中文解读 |

`JEV_ALLOW_SCORING` 默认关闭是刻意的。概率先能看、能算、能校准，但不能影响推荐结果；
只有在 `/jev/calibration` 明确判定"显著优于随机基线"之后，才由人显式打开。

### 2.1 为什么有 `JEV_PROMPT_LOCALE`

Jev 不生成语言（官方口径是放弃字符串生成），因此「语言友好度」在这里不等于文采，
而是两件事：**指令理解的准确度**与 **RLCD 校准概率的质量**。

TypeSafe 未发布语言支持声明，可查到的间接证据是：训练数据全为内部合成；
官方文档、SDK 示例与 4 个已发布的工作流评测清一色英文；容量规格按「约 15 万字符的**英文**文本」表述。
因此英文大概率是它更熟悉的分布，但这是推断而非厂商保证。

该开关的设计边界：

- **只作用于送模型的部分**：`state` 文案、81 条问题指令、Score 档位文字、标签词映射。
- **不作用于给人看的部分**：`interpretation`、`warnings` 与 `overallRiskLabel` 固定取中文
  （由 `JevPromptRenderer#userFacingRiskLabel` 提供），切换语言不会让接口文案漂移。
- 英文模式下会丢弃中文散文（`backtest.summary`），因为其信息已由数值字段承载，留下只会让语言混杂。

要判断该不该用 `en`，做法是同一份 `state` 跑双语对照，比较 walk-forward 的 Brier delta
与平均绝对偏移。输入 token 定价 $0.042/百万，这个实验基本免费。

### 2.2 与语言无关的一条修正：规则必须显式声明

`game` 与 `play_mode` 原先只有品牌名（`中国福利彩票快乐8`、`选4`）。
通用模型的语料里没有中文彩票术语，只给名称它无从判断号码范围与每期开出数量。
现改为完整规则句：

```json
"game": "中国福利彩票快乐8（基诺型开奖）：号码范围 1 到 80，每期固定开出 20 个号码，各期开奖相互独立。",
"play_mode": "选4：每注从 80 个号码中选 4 个，命中 2 个及以上即有奖。"
```

这条**中英双语都做了**，换语言救不了它，补规则才行。

### 2.3 state 字段的两处变化

- **移除 `history_summary`**：原 `deepSummary` 把 `number_profiles` 的数字用中文散文复述了一遍（80 行），
  是 `state` 里最大的一块自由文本，信息高度冗余。移除同时降低 token 成本与非中文模型的理解风险。
- **号码问题带 `criteria`**：80 个 Noul 问题补上 true/false 边界定义，
  并把理论基率 0.25 / 0.75 写进 `criteria` 作为锚点，避免先验被冷热判断整体抬离基线。

## 3. 接口

基础路径 `/api/tools/lottery/kl8`，与其它快乐8工具接口一致（需登录）。

### 3.1 `GET /jev/status`

返回配置状态，密钥脱敏。

```json
{
  "code": 200,
  "data": {
    "enabled": true,
    "available": true,
    "scoringAllowed": false,
    "apiKeyConfigured": true,
    "maskedApiKey": "sk-1****abcd",
    "model": "jev-latest",
    "endpointHost": "api.typesafe.ai",
    "timeoutMs": 15000,
    "message": "Jev 决策层已配置，可用于号码概率推算；概率尚未获准影响推荐排序，需先通过校准接口确认无显著优势后再设置 JEV_ALLOW_SCORING=true"
  }
}
```

### 3.2 `POST /jev/probability`

推算下一期 80 个号码的开出概率。请求体（字段均可省略，走默认值）：

```json
{ "baseIssueCount": 200, "pickSize": 4 }
```

实现方式：一次请求声明 **80 个 `Noul` 问题**（"号码 N 是否会在下一期开出"）
加 **1 个 `Score` 问题**（组合结构风险档位），共 81 个问题由 Jev 并行求解。
超过 120 个问题时自动分批，防止上游对单请求问题数设限。

返回关键字段：

| 字段 | 说明 |
|---|---|
| `numbers[]` | 80 个号码的概率、相对 0.25 基线的偏移、按概率降序的排名 |
| `topNumbers` | 概率最高的 `pickSize` 个号码（**仅观察项**） |
| `meanProbability` | 80 个概率的均值 |
| `impliedDrawnCount` | 80 个概率之和，即模型隐含的「期望开出号码数」。**规则要求必须等于 20** |
| `meanAbsoluteDeviation` / `maxDeviation` | 平均与最大绝对偏移 |
| `aboveBaselineCount` | 概率高于基线的号码数量，用于识别「整体抬高」而非「有区分度」 |
| `overallRiskScore` / `overallRiskLabel` | 结构风险量表位置与档位说明 |
| `legendAligned` | Jev 回传的 Score 档位表是否与请求定义一一对应 |
| `interpretation` | 中文解读，按基率守恒 → 方向一致性 → 偏移幅度三层判据给出结论 |
| `warnings` | 风险提示 |

`baselineConserved()` 是结果对象上的派生判定：`|impliedDrawnCount - 20| ≤ 1`。
它是比任何统计指标都靠前的**硬约束**——80 个号码每期只开出 20 个，
所以 80 个概率之和在数学上必须等于 20；一旦不满足，说明输出连游戏规则都没对齐。

`interpretation` 的判据优先级（刻意如此排序）：

| 顺序 | 判据 | 结论 |
|---|---|---|
| 1 | `baselineConserved()` 为 false | 概率之和与规则冲突，数值只能作同期内部**相对排序**参考，不能当绝对概率 |
| 2 | `aboveBaselineCount ≥ 72` 或 `≤ 8` | 偏移方向高度一致，属整体平移而非号码间区分，排序的名义区分度不可当真 |
| 3 | 守恒且平均绝对偏移 ≤ 0.03 | 整体贴近随机基线，未体现可利用信号，符合独立同分布预期 |
| 4 | 其余 | 偏差是否有意义必须由校准闸门以样本外回测判定，不能由单次结果认定 |

**为什么把基率守恒放在第一位**：真实调用验证后发现，模型会把 80 个号码的概率整体抬高。
此时平均绝对偏移看似温和（7~8 个百分点），概率之和却已与规则冲突。
只看平均绝对偏移会把系统性偏差误读成小样本波动，等于放过了最该报告的缺陷。

### 3.3 `POST /jev/calibration`

运行校准闸门。这是**外呼密集型**操作：耗时约为「期数 × 单次 Jev 调用耗时」，期数硬上限 20。

```json
{ "issues": 5, "baseIssueCount": 200, "pickSize": 4 }
```

方法：走查前推。第 i 期只用第 i 期之前的历史构建特征报告（复用
`LotteryKl8FeatureService.buildReportFromDraws`），让 Jev 推算 80 个号码概率，
再与当期真实开奖比对，逐期计算 Brier 分数，与常数 0.25 基线做**配对单侧 t 检验**。

为什么用 Brier 而不是命中率：Brier 是严格适当评分规则。
把 80 个号码概率整体抬高（虚高）不会改善 Brier，只有真正把开出号码抬高、把未开出压低才有增益。
因此虚高蒙混不过关。

判读标准：

| 指标 | 含义 |
|---|---|
| `brierJev` / `brierBaseline` | 0.25 常数基线的 Brier 恒为 0.1875 |
| `brierDelta` | 负数表示 Jev 更优；**长期贴近 0 是预期结果** |
| `tStatistic` / `criticalValue` | 单侧 95% 闸门判定，`t ≤ -critical` 才放行 |
| `passedGate` | 是否放行。`false` 是正常结果 |
| `requiredIssuesForSignificance` | 若方向成立，按现有波动需多少期才能显著 |

量级参考：真正具备判别力（把 20 个开出号码的概率抬到 30%、60 个未开出的压到 23.33%，
均值仍保持 25%）时，`brierDelta` 约为 **-0.024**。
若实测差值远小于这个量级，说明模型没有判别力。

### 3.4 真实端点实测结论（2026-09-20）

用真实密钥对 `POST https://api.typesafe.ai/v1/systemone` 完成冒烟，覆盖三原语字段探测、
81 问端到端双语对照、重复性检验。以下全部是实测，不是推断。
复现入口：`LotteryKl8JevLiveSmokeTest`（默认跳过，报告写到 `backend/target/jev-smoke-report-*.txt`）。

#### 字段对齐：全部命中

| 请求原语 | 实际响应 | 解析 |
|---|---|---|
| noul | `{"type":"noul","noul":0.29}` | ✓ |
| choice | `choice:"balanced"` + `confidence:0.55` + `probabilities` | ✓ |
| score | `score:0.93` + `confidence` + `probabilities` + `legend` | ✓ |
| legend | 5 档文字逐字回传 | `legendAligned=true` |
| usage | `{"input_tokens":869,"output_tokens":67}` | ✓ |
| model | 回传 `jev-1.13.0`（请求的是别名 `jev-latest`） | ✓ |

两处**文档未明确、只有实测才能确认**的事实：

1. **Noul 不返回 `confidence`，也不返回 `probabilities`。**
   80 个号码概率这一路因此完全没有置信度可用（`confidenceOrZero()` 恒为 0）；
   只有 Choice 与 Score 带置信度。
2. **`score` 是连续位置而非整数档位。** 实测 `0.93` 而概率峰值落在第 0 档（0.48），
   两者不矛盾——`score` 是期望位置，`probabilities` 是分布形状。

#### 核心结论：概率不满足基率守恒，排序不稳定

同一份合成特征、两次独立调用：

| 次 | 语言 | 概率均值 | 隐含期望开出数 | 相对 20 的高估 | 高于基线号码数 |
|---|---|---|---|---|---|
| 1 | zh | 0.3266 | 26.13 | +30.6% | 80 / 80 |
| 1 | en | 0.3142 | 25.14 | +25.7% | 80 / 80 |
| 2 | zh | 0.3314 | 26.51 | +32.6% | 80 / 80 |
| 2 | en | 0.3195 | 25.56 | +27.8% | 80 / 80 |

**80 个号码全部高于基线、0 个低于基线。** 这不是抽样波动，而是稳定的整体平移：
模型没有在做号码间判别，只是把全体信念一起抬高。

重复性检验（同一输入连跑 3 次，`pickSize=4`）：

| 次数 | 候选号码 |
|---|---|
| 1 | 1, 14, 20, 27 |
| 2 | 7, 14, 20, 74 |
| 3 | 4, 14, 17, 34 |

平均重叠 **1.33 / 4**（完全稳定应为 4）。相同输入下 top-4 几乎不重合，
说明排序由采样噪声主导，**不具备选号判别力**。

#### 语言的影响：方向与直觉相反

| 指标 | zh | en | 差异 |
|---|---|---|---|
| 概率均值（第 2 次） | 0.3314 | 0.3195 | en 偏离更小 |
| 平均绝对偏移 | 0.0814 | 0.0695 | en 更小 |
| 输入 token | 22649 | 20324 | **en 省 10%** |
| 端到端耗时 | 1370ms | 1222ms | en 略快 |

英文版的基率偏离确实更小，但**两版都严重超标**（+27.8% vs +32.6%），在同一量级上失败。
更关键的是：**换语言改变的是偏差大小，而不是「有没有信号」**——两版都没有。

另外，同一份数据下 Score 给出的结构风险档位在两版间也不一致（0.54 vs 0.95），
说明该量表对提示词语言敏感，不适合作为稳定特征使用。

#### 由此产生的代码决定

实测把两件事从「设计意图」变成了「必须有」：

1. **`interpretation` 判据顺序重排**：基率守恒 → 方向一致性 → 偏移幅度（见 §3.2）。
2. **`JevProbabilityScorer` 增加自动否决**：即使人工打开 `JEV_ALLOW_SCORING`，
   只要 `baselineConserved()` 为 false 就拒绝打分并回退规则策略。
   双重闸门的分工是——人工闸门管「要不要用它」，自动否决管「它到底合不合格」。
   按当前实测，这道否决会**长期生效**，即 Jev 概率无法影响推荐；
   这是正确行为，等模型改进到满足守恒时闸门会自然打开。

#### 成本

81 问一次约 22000 输入 token / 70 输出 token，按 $0.042/百万输入 token 计约 **$0.001**，
单次调用成本可忽略。唯一需要留意的量是 `state` 体积随窗口期数线性增长。

#### 结论

**字段对齐是通的，接入管道没有缺陷；但模型输出的概率不满足游戏规则约束、排序不稳定，
因此不可用于选号。** 这印证了前置评估的判断：Jev 是决策层而不是预言机，
换更强的决策模型不改变随机开奖的可预测性上限。

## 4. 代码结构与接入位

```text
JevRuntimeConfig / JevRuntimeConfigService     配置（环境变量，含人工闸门）
JevPromptLocale / JevPromptRenderer            提示词语言与渲染（zh / en）
JevQuestion / JevAnswer / JevEvaluation        协议类型（noul / choice / score）
LotteryKl8JevClient                            HTTP 客户端（JDK 内置 HttpClient，无新依赖）
LotteryKl8JevProbabilityService                state 构造 + 80 个 Noul 问题 + 守恒与偏差统计
LotteryKl8JevProbabilityResult / ...NumberProbability   结果模型（含 baselineConserved 判定）
LotteryKl8JevCalibrationService                校准闸门（Brier + 配对 t 检验）
LotteryKl8JevCalibrationReport                 校准报告
LotteryKl8NumberScorer                         打分策略接口（新增接入位）
RuleFactorScorer                               规则策略（包装现有 compositeScore，行为不变）
JevProbabilityScorer                           Jev 概率策略（人工闸门 + 基率守恒自动否决）
LotteryKl8JevLiveSmokeTest                     真实端点冒烟（默认跳过，需 JEV_LIVE_TEST=true）
```

`LotteryKl8NumberScorer` 是给后续所有决策模型预留的统一接入位：
任何模型实现该接口即可被同一套回测栅栏评估，
避免出现绕过回测直接上线的旁路。当前 **未改动** `LotteryKl8FeatureService` 的候选池构造代码，
现有推荐行为与接入前完全一致。

## 5. 失败与降级

| 场景 | 行为 |
|---|---|
| `JEV_ENABLED=false` 或密钥缺失 | `/jev/*` 返回 400 及中文原因；`JevProbabilityScorer.available()` 为 false |
| 401 / 422 | 立即抛出，附中文解释与响应片段（区分密钥错误与结构错误） |
| 429 / 529 / 5xx | 指数退避重试，最多 3 次 |
| 部分号码未返回概率 | 按 0.25 基线退避，并在 `warnings` 中列出号码 |
| 全部答案缺失 | 抛异常，不产出伪造概率 |
| **概率不满足基率守恒** | **自动否决**：打分阶段拒绝参与排序并回退规则策略（见 §3.4） |
| Score 的 `legend` 缺失或档位数不符 | `legendAligned=false`，写入 `warnings`，档位仅作参考 |
| 打分阶段调用失败 | 记录 WARN 后回退规则策略，不拖垮推荐主链路 |

## 6. 合规

- 不承诺提高中奖概率；所有输出为统计研究与娱乐参考。
- 不接入自动投注。
- `JevRuntimeConfig.callable()` 与 `scoringAllowed()` 分离，确保"能算"不等于"能用在推荐上"。
- 第三方密钥不落库、不返回前端、不写入日志。

## 7. 验证步骤

```bash
# 1. 配置（Windows PowerShell 示例）
$env:JEV_ENABLED="true"; $env:TYPESAFE_API_KEY="sk-..."

# 2. 启动后端
cd backend && mvn spring-boot:run

# 3. 查看配置状态
curl -H "Authorization: Bearer <用户token>" http://localhost:8080/api/tools/lottery/kl8/jev/status

# 4. 推算概率
curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer <用户token>" \
  -d '{"baseIssueCount":200,"pickSize":4}' \
  http://localhost:8080/api/tools/lottery/kl8/jev/probability

# 5. 跑校准闸门（约 5 期外呼）
curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer <用户token>" \
  -d '{"issues":5,"baseIssueCount":200,"pickSize":4}' \
  http://localhost:8080/api/tools/lottery/kl8/jev/calibration
```

预期结果：第 3 步 `available=true`、`scoringAllowed=false`；
第 4 步 `meanProbability` 贴近 0.25；第 5 步 `passedGate=false`，
结论为"未发现优于随机基线的证据"。
**这三条同时成立，说明接入是正确的，不是失败。**
