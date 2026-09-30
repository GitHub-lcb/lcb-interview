package com.lcbinterview.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Jev 提示词渲染器：把历史特征渲染成「送模型」的 state 文案与问题文本。
 *
 * 两条硬约束：
 * <ul>
 *   <li><b>规则必须显式声明。</b>「快乐8」「选4」这类名称不在通用模型的语料里，
 *       因此号码范围、每期开出数量、开奖独立性与中奖门槛全部写进 state，
 *       不依赖模型认识品牌名。这一条与语言无关，中英文都必须做。</li>
 *   <li><b>人机文本分离。</b>本渲染器只产出送模型的部分；用户可见的中文解读、
 *       风险提示与档位标签由服务层另行生成，切换提示词语言不会改变前端文案。</li>
 * </ul>
 *
 * 位置：{@code state} 与 {@code questions} 的文案全部经此渲染，
 * 使 {@link LotteryKl8JevProbabilityService} 不必散落语言分支。
 */
public class JevPromptRenderer {

    /** 号码总数，与快乐8玩法一致。 */
    private static final int NUMBER_RANGE = 80;

    /** 每期开出号码数量。 */
    private static final int DRAWN_PER_ISSUE = 20;

    /** 各语言下的号码标签词映射，用于把特征层的中文标签转成模型语言。 */
    private static final Map<String, String> TAG_EN = Map.ofEntries(
            Map.entry("热号", "hot"),
            Map.entry("冷号", "cold"),
            Map.entry("高遗漏", "long-missing"),
            Map.entry("近期上行", "recent-uptrend"),
            Map.entry("近期活跃", "recently-active"),
            Map.entry("近30未出", "absent-in-last-30"),
            Map.entry("百期断档", "absent-over-100-issues"),
            Map.entry("衰减热度高", "high-time-decayed-heat"),
            Map.entry("遗漏压力高", "high-missing-pressure"),
            Map.entry("波动大", "high-volatility"),
            Map.entry("均衡补位", "balancing-filler"));

    /** 权重配置名称映射。 */
    private static final Map<String, String> WEIGHT_PROFILE_EN = Map.of(
            "均衡", "balanced",
            "热度优先", "hot-priority",
            "遗漏优先", "missing-priority",
            "衰减热度优先", "decay-priority",
            "共现优先", "pair-priority",
            "结构均衡优先", "balance-priority");

    /** 因子名称映射。 */
    private static final Map<String, String> FACTOR_EN = Map.of(
            "热度", "heat",
            "遗漏", "missing",
            "趋势", "trend",
            "时间衰减", "time-decay",
            "共现", "co-occurrence",
            "结构均衡", "structural-balance");

    /** 中文结构风险档位，同时作为用户可见文案的唯一来源。 */
    private static final List<String> RISK_LEVELS_ZH = List.of(
            "结构高度均衡：区间、奇偶、尾数分布贴近历史常态",
            "结构较均衡：仅个别维度存在轻微偏移",
            "结构一般：存在可察觉的区间或奇偶集中",
            "结构偏斜：多个维度同时偏离历史常态",
            "结构严重偏斜：极端集中，与历史常态差异显著");

    /** 英文结构风险档位，仅用于送模型。 */
    private static final List<String> RISK_LEVELS_EN = List.of(
            "Highly balanced: range, parity and tail distributions all close to historical norms",
            "Mostly balanced: only minor deviation in a single dimension",
            "Moderate: noticeable concentration in range or parity",
            "Skewed: several dimensions deviate from historical norms at once",
            "Strongly skewed: extreme concentration, clearly unlike historical norms");

    private final JevPromptLocale locale;

    /**
     * 创建指定语言的渲染器。
     *
     * @param locale 提示词语言，为 null 时按中文处理
     */
    public JevPromptRenderer(JevPromptLocale locale) {
        this.locale = locale == null ? JevPromptLocale.ZH : locale;
    }

    /**
     * 当前语言代码。
     *
     * @return zh 或 en
     */
    public String localeCode() {
        return locale.code();
    }

    /**
     * state 开头的说明，交代数据性质与边界。
     * 明确写出「不含未来信息」，避免模型把历史统计误当成已知结果。
     *
     * @return 说明文本
     */
    public String schemaNote() {
        if (isEnglish()) {
            return "All fields below are historical statistics from already-drawn issues of this lottery; "
                    + "no future information is included.";
        }
        return "以下均为快乐8历史开奖的统计特征，不含未来信息。";
    }

    /**
     * 游戏规则声明。
     * 这里把玩法规则完整写出来，而不是只给品牌名：
     * 通用模型的语料里没有「快乐8」「选4」这类中文彩票术语，
     * 只给名称会让模型无从判断号码范围与开出数量。
     *
     * @return 游戏规则描述
     */
    public String gameName() {
        if (isEnglish()) {
            // 注意：.formatted() 的优先级高于字符串拼接，必须先用括号包住整段拼接结果，
            // 否则只有最后一段被格式化，前一段会残留字面量 %d 直接送进提示词
            return ("Chinese Welfare Lottery Kuai Le 8 (keno-style draw): numbers range from 1 to %d, "
                    + "exactly %d numbers are drawn per issue, and draws are independent of each other.")
                    .formatted(NUMBER_RANGE, DRAWN_PER_ISSUE);
        }
        return "中国福利彩票快乐8（基诺型开奖）：号码范围 1 到 %d，每期固定开出 %d 个号码，各期开奖相互独立。"
                .formatted(NUMBER_RANGE, DRAWN_PER_ISSUE);
    }

    /**
     * 玩法声明，含中奖门槛，避免模型把「选4」误读成动词短语。
     *
     * @param pickSize 每组号码数量
     * @return 玩法描述
     */
    public String playMode(int pickSize) {
        if (isEnglish()) {
            return ("pick %d: the player selects %d numbers out of %d per entry; "
                    + "an entry wins a prize when at least 2 of its numbers are drawn.")
                    .formatted(pickSize, pickSize, NUMBER_RANGE);
        }
        return "选%d：每注从 %d 个号码中选 %d 个，命中 2 个及以上即有奖。"
                .formatted(pickSize, NUMBER_RANGE, pickSize);
    }

    /**
     * 单个号码开出与否的问题指令。
     * 指令里带上下期是「20 个号码」这个前提，使问题自包含；
     * Jev 不会收到问题 ID，因此指令本身必须说清要判断什么。
     *
     * @param number 号码
     * @return 问题指令
     */
    public String numberInstruction(int number) {
        if (isEnglish()) {
            return ("Based on the historical statistics in `state`, will number %d appear among the %d numbers "
                    + "drawn in the next issue?").formatted(number, DRAWN_PER_ISSUE);
        }
        return "根据 state 中的历史统计特征，号码 %d 是否会在下一期开奖的 %d 个号码中出现？"
                .formatted(number, DRAWN_PER_ISSUE);
    }

    /**
     * 号码问题的边界说明。
     * 官方文档建议边界模糊时用 criteria 定义 true/false 各自的含义；
     * 这里额外把理论基率写进去，给模型一个明确的锚点，
     * 使其不至于把「冷号」或「热号」的先验抬离 25%。
     *
     * @return 边界说明映射
     */
    public Map<String, String> numberCriteria() {
        Map<String, String> criteria = new LinkedHashMap<>();
        double baseline = (double) DRAWN_PER_ISSUE / NUMBER_RANGE;
        if (isEnglish()) {
            criteria.put("true", ("the number is among the %d numbers drawn in the next issue "
                    + "(each number's long-run base rate is %.2f)").formatted(DRAWN_PER_ISSUE, baseline));
            criteria.put("false", ("the number is not among the %d numbers drawn in the next issue "
                    + "(long-run base rate %.2f)").formatted(DRAWN_PER_ISSUE, 1.0 - baseline));
        } else {
            criteria.put("true", "该号码在下一期的 %d 个开奖号码之中（每个号码的长期基率均为 %.2f）"
                    .formatted(DRAWN_PER_ISSUE, baseline));
            criteria.put("false", "该号码不在下一期的 %d 个开奖号码之中（长期基率为 %.2f）"
                    .formatted(DRAWN_PER_ISSUE, 1.0 - baseline));
        }
        return criteria;
    }

    /**
     * 结构风险量表的问题指令。
     *
     * @param pickSize 每组号码数量
     * @return 问题指令
     */
    public String riskInstruction(int pickSize) {
        if (isEnglish()) {
            return ("Score the structural risk of a set of %d numbers that was built to follow historical norms. "
                    + "A higher level means its range, parity and tail distributions are more concentrated, "
                    + "and deviate further from historical norms.").formatted(pickSize);
        }
        return "为「按历史常态构造的一组选%d号码」的形态风险打分：档位越高表示区间、奇偶、尾数分布越集中，越偏离历史常态。"
                .formatted(pickSize);
    }

    /**
     * 送模型的结构风险档位文字。
     *
     * @return 档位列表，索引即档位序号
     */
    public List<String> riskLevels() {
        return isEnglish() ? RISK_LEVELS_EN : RISK_LEVELS_ZH;
    }

    /**
     * 用户可见的中文档位文字。
     * 无论提示词用什么语言，返回给用户的档位说明都固定取中文，
     * 保证语言切换不会影响接口文案。
     *
     * @param score 量表位置，可落在档位之间
     * @return 中文档位说明
     */
    public String userFacingRiskLabel(double score) {
        int index = (int) Math.round(score);
        index = Math.max(0, Math.min(RISK_LEVELS_ZH.size() - 1, index));
        return RISK_LEVELS_ZH.get(index);
    }

    /**
     * 用户可见的中文档位列表，供校准服务校验档位数量。
     *
     * @return 中文档位列表
     */
    public List<String> userFacingRiskLevels() {
        return RISK_LEVELS_ZH;
    }

    /**
     * 转换号码标签词。英文模式下查表，未收录的标签原样返回，
     * 避免因为特征层新增标签就把内容丢掉。
     *
     * @param tag 特征层产出的标签
     * @return 模型语言下的标签
     */
    public String tag(String tag) {
        if (!isEnglish() || tag == null) {
            return tag;
        }
        return TAG_EN.getOrDefault(tag, tag);
    }

    /**
     * 转换权重配置名称。
     *
     * @param name 中文权重配置名
     * @return 模型语言下的名称
     */
    public String weightProfileName(String name) {
        if (!isEnglish() || name == null) {
            return name;
        }
        return WEIGHT_PROFILE_EN.getOrDefault(name, name);
    }

    /**
     * 转换因子名称。
     *
     * @param name 中文因子名
     * @return 模型语言下的名称
     */
    public String factorName(String name) {
        if (!isEnglish() || name == null) {
            return name;
        }
        return FACTOR_EN.getOrDefault(name, name);
    }

    /**
     * 是否应当丢弃中文散文类字段。
     * 回测摘要与深度摘要是中文自由文本，内容与结构化字段高度重复，
     * 在英文模式下保留只会让语言混杂，因此直接不送。
     *
     * @return true 表示丢弃中文散文
     */
    public boolean dropChineseProse() {
        return isEnglish();
    }

    private boolean isEnglish() {
        return locale == JevPromptLocale.EN;
    }
}
