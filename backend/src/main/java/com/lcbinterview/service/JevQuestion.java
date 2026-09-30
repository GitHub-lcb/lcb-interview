package com.lcbinterview.service;

import java.util.List;
import java.util.Map;

/**
 * Jev System One 类型化问题。
 *
 * Jev 只有三种问题原语，这里按官方 SDK 的形态建模：
 * <ul>
 *   <li>{@code noul}：是/否问题，返回 0-1 的概率；</li>
 *   <li>{@code choice}：从候选集中选一个，返回全量概率分布与置信度，criteria 为「选项值 -&gt; 选项说明」映射；</li>
 *   <li>{@code score}：在有序量表上打分，返回位置与置信度，criteria 为按序排列的档位说明。</li>
 * </ul>
 * 同一状态下的多个问题由服务端并行求解，因此把 80 个号码拆成 80 个 Noul 问题不会线性放大耗时。
 *
 * @param id           问题标识，响应按同一 id 回填，必须唯一且非空
 * @param type         问题类型：noul / choice / score
 * @param instructions 问题指令，描述要判断什么
 * @param criteria     choice 时为选项映射，score 时为档位列表，noul 时为空
 */
public record JevQuestion(
        String id,
        String type,
        String instructions,
        Map<String, String> criteria,
        List<String> levels
) {

    /** 问题类型常量：是/否概率。 */
    public static final String TYPE_NOUL = "noul";
    /** 问题类型常量：多选一。 */
    public static final String TYPE_CHOICE = "choice";
    /** 问题类型常量：有序量表打分。 */
    public static final String TYPE_SCORE = "score";

    /**
     * 构造一个 Noul 问题（是/否，返回概率）。
     *
     * @param id           问题标识
     * @param instructions 问题指令，应当是可用「是/否」回答的判断句
     * @return Noul 问题
     */
    public static JevQuestion noul(String id, String instructions) {
        return new JevQuestion(id, TYPE_NOUL, instructions, Map.of(), List.of());
    }

    /**
     * 构造一个带边界说明的 Noul 问题。
     * 官方文档建议在「是」与「否」的边界容易混淆时用 criteria 写清两边各自的含义；
     * 对「某号码是否开出」这类问题，把理论基率一并写进 criteria，
     * 可以给模型一个明确锚点，避免先验被冷热判断带偏。
     *
     * @param id           问题标识
     * @param instructions 问题指令
     * @param criteria     边界说明，键为 true / false
     * @return Noul 问题
     */
    public static JevQuestion noul(String id, String instructions, Map<String, String> criteria) {
        return new JevQuestion(id, TYPE_NOUL, instructions,
                criteria == null ? Map.of() : Map.copyOf(criteria), List.of());
    }

    /**
     * 构造一个 Choice 问题（多选一，返回全量概率分布）。
     *
     * @param id           问题标识
     * @param instructions 问题指令
     * @param options      选项映射，键为返回的选项值，值为该选项的说明
     * @return Choice 问题
     */
    public static JevQuestion choice(String id, String instructions, Map<String, String> options) {
        return new JevQuestion(id, TYPE_CHOICE, instructions, Map.copyOf(options), List.of());
    }

    /**
     * 构造一个 Score 问题（有序量表，返回档位位置）。
     *
     * @param id           问题标识
     * @param instructions 问题指令
     * @param levels       按从低到高排列的档位说明，索引即档位序号
     * @return Score 问题
     */
    public static JevQuestion score(String id, String instructions, List<String> levels) {
        if (levels.size() < 2 || levels.size() > 10) {
            // Jev 官方限定 Score 档位为 2-10 个，越界请求会在服务端 422，这里提前拦截给出可读错误
            throw new IllegalArgumentException("Score 档位数量必须在 2 到 10 之间");
        }
        return new JevQuestion(id, TYPE_SCORE, instructions, Map.of(), List.copyOf(levels));
    }
}
