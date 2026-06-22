package com.lcbinterview.service;

import com.lcbinterview.dto.InterviewEvaluateRequest;
import com.lcbinterview.dto.InterviewFeedbackVO;

/**
 * AI 面试评分客户端，封装外部模型调用能力，便于 Service 在失败时回退规则评分。
 */
public interface AiInterviewClient {

    /**
     * 判断当前 AI 客户端是否具备可调用条件。
     *
     * @return true 表示已配置并允许调用外部模型
     */
    boolean isEnabled();

    /**
     * 调用外部模型生成面试评分。
     *
     * @param request          面试评分请求
     * @param ruleBasedFallback 规则评分结果，用作模型失败或字段缺失时的兜底参考
     * @return AI 评分结果
     */
    InterviewFeedbackVO evaluate(InterviewEvaluateRequest request, InterviewFeedbackVO ruleBasedFallback);
}
