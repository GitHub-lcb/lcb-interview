package com.lcbinterview.service;

import com.lcbinterview.dto.InterviewEvaluateRequest;
import com.lcbinterview.dto.InterviewFeedbackVO;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.function.BiFunction;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 面试官评分 Service 测试，验证规则评分在无外部 AI 依赖时仍可稳定工作。
 */
class InterviewCoachServiceTest {

    private final InterviewCoachService service = new InterviewCoachService();

    @Test
    void evaluateReturnsLowScoreForBlankAnswer() {
        InterviewFeedbackVO feedback = service.evaluate(request("   "));

        assertThat(feedback.score()).isZero();
        assertThat(feedback.level()).isEqualTo("needs-work");
        assertThat(feedback.criteria()).allMatch(item -> item.score() == 0);
        assertThat(feedback.followUps()).hasSize(2);
        assertThat(feedback.source()).isEqualTo("RULE_BASED");
    }

    @Test
    void evaluateScoresStructuredAnswerHighly() {
        InterviewFeedbackVO feedback = service.evaluate(request("""
                首先，HashMap 在多线程下 thread safety 有问题，resize 和 put 都会修改内部结构。
                其次，并发写入时节点引用、桶数组和扩容过程没有同步保护，可能造成覆盖和可见性问题。
                例如线上高并发缓存写入，我会选 ConcurrentHashMap 或者在外层加锁，并说明 lock 粒度。
                风险和边界是：只读场景风险低，写多读多不能直接用 HashMap。
                """));

        assertThat(feedback.score()).isGreaterThanOrEqualTo(80);
        assertThat(feedback.level()).isEqualTo("strong");
        assertThat(feedback.criteria()).extracting("key")
                .containsExactly("coverage", "structure", "specificity", "risk");
        assertThat(feedback.followUps()).anyMatch(item -> item.contains("ConcurrentHashMap"));
    }

    @Test
    void evaluateAsksTargetedFollowUpsForShallowAnswer() {
        InterviewFeedbackVO feedback = service.evaluate(request("HashMap is not safe in multiple threads."));

        assertThat(feedback.score()).isLessThan(60);
        assertThat(feedback.level()).isEqualTo("needs-work");
        assertThat(feedback.followUps()).anyMatch(item -> item.contains("线上"));
        assertThat(feedback.advice()).hasSizeGreaterThanOrEqualTo(2);
    }

    @Test
    void evaluateUsesAiClientWhenConfigured() {
        InterviewCoachService aiService = new InterviewCoachService(new StubAiInterviewClient((request, fallback) ->
                new InterviewFeedbackVO(
                        91,
                        "strong",
                        fallback.criteria(),
                        List.of("补充一个容量扩容例子。"),
                        List.of("为什么树化需要容量阈值？"),
                        "AI"
                )));

        InterviewFeedbackVO feedback = aiService.evaluate(request("""
                首先，HashMap 在冲突严重时链表查询会退化。
                其次，JDK 1.8 会在满足阈值和容量条件时树化，把最坏查询降到 O(log n)。
                例如线上热点 key 冲突时要关注容量和 hash 分布，风险是小容量优先扩容而不是树化。
                """));

        assertThat(feedback.score()).isEqualTo(91);
        assertThat(feedback.source()).isEqualTo("AI");
        assertThat(feedback.followUps()).containsExactly("为什么树化需要容量阈值？");
    }

    @Test
    void evaluateFallsBackToRuleBasedWhenAiClientFails() {
        InterviewCoachService aiService = new InterviewCoachService(new StubAiInterviewClient((request, fallback) -> {
            throw new IllegalStateException("mock timeout");
        }));

        InterviewFeedbackVO feedback = aiService.evaluate(request("""
                首先，HashMap 在多线程下 thread safety 有问题。
                其次，并发写入 resize 会修改内部结构。
                例如线上高并发写入会选 ConcurrentHashMap。
                风险和边界是只读场景风险低，写多读多不能直接用 HashMap。
                """));

        assertThat(feedback.source()).isEqualTo("RULE_BASED");
        assertThat(feedback.score()).isGreaterThan(0);
    }

    private InterviewEvaluateRequest request(String answer) {
        return new InterviewEvaluateRequest(
                "HashMap thread safety and resize mechanism",
                "Java Collections",
                List.of("HashMap", "Thread Safety", "Resize"),
                "HARD",
                "Java 后端",
                answer
        );
    }

    private record StubAiInterviewClient(
            BiFunction<InterviewEvaluateRequest, InterviewFeedbackVO, InterviewFeedbackVO> evaluator
    ) implements AiInterviewClient {

        @Override
        public boolean isEnabled() {
            return true;
        }

        @Override
        public InterviewFeedbackVO evaluate(InterviewEvaluateRequest request, InterviewFeedbackVO ruleBasedFallback) {
            return evaluator.apply(request, ruleBasedFallback);
        }
    }
}
