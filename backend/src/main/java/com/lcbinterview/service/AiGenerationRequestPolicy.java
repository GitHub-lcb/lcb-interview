package com.lcbinterview.service;

import org.springframework.stereotype.Component;

/**
 * AI 生成请求策略。集中约束管理端生成参数，避免 GET/SSE 参数绕过 DTO 校验后进入服务层。
 */
@Component
public class AiGenerationRequestPolicy {

    private static final int MIN_COUNT = 1;
    private static final int MAX_COUNT = 20;

    /**
     * 将生成数量归一化到系统支持的安全范围。
     *
     * @param count 外部传入的生成数量
     * @return 1 到 20 之间的安全数量
     */
    public int clampCount(int count) {
        return Math.max(MIN_COUNT, Math.min(count, MAX_COUNT));
    }
}
