package com.lcbinterview.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * AI 生成请求策略测试，约束管理端传入的生成数量边界。
 */
class AiGenerationRequestPolicyTest {

    private final AiGenerationRequestPolicy policy = new AiGenerationRequestPolicy();

    @Test
    void clampCountKeepsGenerationCountWithinSupportedRange() {
        assertThat(policy.clampCount(-5)).isEqualTo(1);
        assertThat(policy.clampCount(0)).isEqualTo(1);
        assertThat(policy.clampCount(7)).isEqualTo(7);
        assertThat(policy.clampCount(99)).isEqualTo(20);
    }
}
