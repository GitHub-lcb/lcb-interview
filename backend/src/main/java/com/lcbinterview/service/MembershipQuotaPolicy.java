package com.lcbinterview.service;

/**
 * 会员配额策略。集中定义 FREE / PRO 两档在各资源上的每日配额与超限积分单价，
 * 后续如需后台调参可迁移到 membership_quota_policy 表，接口保持不变。
 */
public final class MembershipQuotaPolicy {

    /** 免费档 */
    public static final String LEVEL_FREE = "FREE";

    /** 付费档 */
    public static final String LEVEL_PRO = "PRO";

    /** 不限量标记 */
    public static final int UNLIMITED = -1;

    private MembershipQuotaPolicy() {
    }

    /**
     * 受配额管控的资源类型。
     */
    public enum Resource {
        /** AI 深度评分（source=AI 才计费，规则评分免费不限量） */
        AI_EVALUATE,
        /** AI 追问演练 */
        AI_FOLLOW_UP,
        /** 完整结构化答案查看 */
        ANSWER_DETAIL,
        /** Anki / Markdown 导出 */
        EXPORT,
        /** 急救包、简报、差距报告等高级导出，仅 PRO 可用 */
        PREMIUM_EXPORT
    }

    /**
     * 单个资源在某个档位下的配额规则。
     *
     * @param dailyLimit         每日免费次数，UNLIMITED 表示不限量
     * @param overflowCreditCost 超出配额后每次消耗的积分，0 表示不支持积分抵扣
     * @param proOnly            是否仅 PRO 可用
     */
    public record Rule(int dailyLimit, int overflowCreditCost, boolean proOnly) {

        /**
         * 是否不限量。
         *
         * @return true 表示不限量
         */
        public boolean unlimited() {
            return dailyLimit == UNLIMITED;
        }
    }

    /**
     * 查询资源在指定档位下的配额规则。
     *
     * @param resource 配额资源
     * @param level    会员等级：FREE / PRO
     * @return 配额规则
     */
    public static Rule rule(Resource resource, String level) {
        boolean pro = LEVEL_PRO.equals(level);
        return switch (resource) {
            case AI_EVALUATE -> pro ? new Rule(50, 1, false) : new Rule(3, 1, false);
            case AI_FOLLOW_UP -> pro ? new Rule(100, 1, false) : new Rule(1, 1, false);
            case ANSWER_DETAIL -> pro ? new Rule(UNLIMITED, 0, false) : new Rule(10, 0, false);
            case EXPORT -> pro ? new Rule(20, 0, false) : new Rule(1, 0, false);
            case PREMIUM_EXPORT -> pro ? new Rule(UNLIMITED, 0, false) : new Rule(0, 0, true);
        };
    }
}
