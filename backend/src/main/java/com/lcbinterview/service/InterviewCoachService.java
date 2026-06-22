package com.lcbinterview.service;

import com.lcbinterview.dto.InterviewCriterionVO;
import com.lcbinterview.dto.InterviewEvaluateRequest;
import com.lcbinterview.dto.InterviewFeedbackVO;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * 面试官评分 Service，优先使用 AI 评分，并在密钥缺失、超时或模型响应异常时回退规则评分。
 */
@Slf4j
@Service
public class InterviewCoachService {

    private static final String RULE_BASED_SOURCE = "RULE_BASED";
    private static final Set<String> STOP_WORDS = Set.of(
            "and", "the", "with", "for", "why", "what", "how", "java", "mechanism"
    );

    @Nullable
    private final AiInterviewClient aiInterviewClient;

    /**
     * 创建无外部 AI 依赖的评分 Service，主要用于单元测试。
     */
    public InterviewCoachService() {
        this(null);
    }

    /**
     * 创建评分 Service。
     *
     * @param aiInterviewClient AI 评分客户端，可为空
     */
    @Autowired
    public InterviewCoachService(@Nullable AiInterviewClient aiInterviewClient) {
        this.aiInterviewClient = aiInterviewClient;
    }

    /**
     * 根据题目上下文和用户回答生成面试评分。
     *
     * @param request 评分请求
     * @return 面试评分结果
     */
    public InterviewFeedbackVO evaluate(InterviewEvaluateRequest request) {
        InterviewFeedbackVO ruleBasedFeedback = evaluateRuleBased(request);
        String answer = request.answer() == null ? "" : request.answer().trim();
        if (!answer.isBlank() && aiInterviewClient != null && aiInterviewClient.isEnabled()) {
            try {
                return aiInterviewClient.evaluate(request, ruleBasedFeedback);
            } catch (RuntimeException e) {
                log.warn("AI 面试评分失败，已降级规则评分: {}", e.getMessage());
            }
        }
        return ruleBasedFeedback;
    }

    private InterviewFeedbackVO evaluateRuleBased(InterviewEvaluateRequest request) {
        String answer = request.answer() == null ? "" : request.answer().trim();
        if (answer.isBlank()) {
            return blankFeedback(request);
        }

        String normalizedAnswer = normalize(answer);
        int coverageScore = scoreCoverage(request, normalizedAnswer);
        int structureScore = scoreStructure(answer);
        int specificityScore = scoreSpecificity(normalizedAnswer);
        int riskScore = scoreRisk(normalizedAnswer);
        int baseScore = Math.round(
                coverageScore * 0.35f
                        + structureScore * 0.25f
                        + specificityScore * 0.2f
                        + riskScore * 0.2f
        );
        int depthBonus = answer.length() >= 180
                && structureScore >= 70
                && specificityScore >= 70
                && riskScore >= 70
                ? 5
                : 0;
        int score = clampScore(baseScore + depthBonus);
        List<InterviewCriterionVO> criteria = List.of(
                criterion("coverage", coverageScore, coverageScore >= 70 ? "核心概念覆盖较完整" : "核心概念还需要补齐"),
                criterion("structure", structureScore, structureScore >= 70 ? "回答有清晰层次" : "建议按结论、原因、例子组织"),
                criterion("specificity", specificityScore, specificityScore >= 70 ? "有具体场景或替代方案" : "缺少项目场景或落地例子"),
                criterion("risk", riskScore, riskScore >= 70 ? "能说明边界和风险" : "需要补充适用边界和误区")
        );

        return new InterviewFeedbackVO(
                score,
                score >= 80 ? "strong" : score >= 60 ? "pass" : "needs-work",
                criteria,
                buildAdvice(criteria),
                buildFollowUps(request, criteria),
                RULE_BASED_SOURCE
        );
    }

    private InterviewFeedbackVO blankFeedback(InterviewEvaluateRequest request) {
        return new InterviewFeedbackVO(
                0,
                "needs-work",
                List.of(
                        criterion("coverage", 0, "还没有覆盖题目核心关键词"),
                        criterion("structure", 0, "还没有形成回答结构"),
                        criterion("specificity", 0, "还没有给出场景或例子"),
                        criterion("risk", 0, "还没有说明边界和风险")
                ),
                List.of("先写出核心结论，再补原因、例子和边界。"),
                List.of(
                        "请先用一句话回答：" + request.questionTitle(),
                        "如果面试官追问线上场景，你会怎么展开？"
                ),
                RULE_BASED_SOURCE
        );
    }

    private InterviewCriterionVO criterion(String key, int score, String summary) {
        return new InterviewCriterionVO(key, label(key), score, summary);
    }

    private String label(String key) {
        return switch (key) {
            case "coverage" -> "知识覆盖";
            case "structure" -> "表达结构";
            case "specificity" -> "场景细节";
            case "risk" -> "边界风险";
            default -> key;
        };
    }

    private int scoreCoverage(InterviewEvaluateRequest request, String normalizedAnswer) {
        List<String> keywords = extractKeywords(request);
        if (keywords.isEmpty()) {
            return 60;
        }
        long matched = keywords.stream().filter(normalizedAnswer::contains).count();
        return clampScore(Math.round((matched * 100f) / keywords.size()));
    }

    private int scoreStructure(String answer) {
        List<String> markers = List.of("首先", "其次", "然后", "最后", "第一", "第二", "1.", "2.", "\n", "结论");
        int markerHits = (int) markers.stream().filter(answer::contains).count();
        int lengthBonus = answer.length() >= 120 ? 40 : answer.length() >= 60 ? 20 : 0;
        return clampScore(markerHits * 22 + lengthBonus);
    }

    private int scoreSpecificity(String normalizedAnswer) {
        List<String> markers = List.of("例如", "比如", "项目", "线上", "生产", "高并发", "concurrenthashmap", "加锁", "lock", "case");
        return clampScore((int) markers.stream().filter(normalizedAnswer::contains).count() * 28);
    }

    private int scoreRisk(String normalizedAnswer) {
        List<String> markers = List.of("风险", "边界", "缺点", "注意", "不能", "只读", "可见性", "覆盖", "异常", "误区");
        return clampScore((int) markers.stream().filter(normalizedAnswer::contains).count() * 24);
    }

    private List<String> buildAdvice(List<InterviewCriterionVO> criteria) {
        return criteria.stream()
                .filter(item -> item.score() < 70)
                .map(item -> switch (item.key()) {
                    case "coverage" -> "先补齐题目关键词，至少覆盖定义、原因和替代方案。";
                    case "structure" -> "按“结论 -> 原因 -> 场景 -> 边界”重组答案。";
                    case "specificity" -> "加入一个线上或项目场景，让答案从背诵变成经验。";
                    case "risk" -> "补充适用边界、风险和常见误区。";
                    default -> "继续补充答案细节。";
                })
                .toList();
    }

    private List<String> buildFollowUps(InterviewEvaluateRequest request, List<InterviewCriterionVO> criteria) {
        List<String> prompts = new ArrayList<>();
        String title = normalize(request.questionTitle());
        if (title.contains("hashmap")) {
            prompts.add("如果换成 ConcurrentHashMap，它解决了哪些并发问题？");
        }
        if (criteria.stream().anyMatch(item -> "specificity".equals(item.key()) && item.score() < 70)) {
            prompts.add("放到线上高并发写入场景，你会怎么选型和验证？");
        }
        if (criteria.stream().anyMatch(item -> "risk".equals(item.key()) && item.score() < 70)) {
            prompts.add("这个方案的边界、风险和常见误区是什么？");
        }
        prompts.add("请用 60 秒重新回答：" + request.questionTitle());
        return new ArrayList<>(new LinkedHashSet<>(prompts)).stream().limit(3).toList();
    }

    private List<String> extractKeywords(InterviewEvaluateRequest request) {
        String text = String.join(" ", List.of(
                request.questionTitle() == null ? "" : request.questionTitle(),
                request.categoryName() == null ? "" : request.categoryName(),
                String.join(" ", request.tags() == null ? List.of() : request.tags())
        ));
        return new ArrayList<>(new LinkedHashSet<>(
                List.of(normalize(text).split("[^a-z0-9\\u4e00-\\u9fa5]+")).stream()
                        .map(String::trim)
                        .filter(word -> word.length() >= 3)
                        .filter(word -> !STOP_WORDS.contains(word))
                        .toList()
        )).stream().limit(8).toList();
    }

    private String normalize(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
    }

    private int clampScore(int value) {
        return Math.max(0, Math.min(100, value));
    }
}
