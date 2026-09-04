package com.lcbinterview.service;

/**
 * 会员计费业务错误码。前端根据 code 弹出升级会员或充值积分引导。
 */
public final class BillingErrorCodes {

    /** 当日免费额度已用完且无法用积分抵扣 */
    public static final int QUOTA_EXHAUSTED = 40301;

    /** 功能需要会员才能使用 */
    public static final int MEMBER_REQUIRED = 40302;

    /** AI 积分不足 */
    public static final int CREDIT_INSUFFICIENT = 40303;

    private BillingErrorCodes() {
    }
}
