package com.lcbinterview.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 快乐8 AI 推荐客户端，复用现有 OpenAI 兼容 AI 配置。
 */
@Service
public class LotteryKl8AiRecommendationService {

    private final ObjectMapper objectMapper;
    private final AiRuntimeConfigService aiRuntimeConfigService;
    private final HttpClient httpClient;

    /**
     * 创建快乐8 AI 推荐客户端。
     *
     * @param objectMapper           JSON 组件
     * @param aiRuntimeConfigService AI 运行时配置服务
     */
    @Autowired
    public LotteryKl8AiRecommendationService(ObjectMapper objectMapper, AiRuntimeConfigService aiRuntimeConfigService) {
        this(objectMapper, aiRuntimeConfigService, HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).build());
    }

    LotteryKl8AiRecommendationService(
            ObjectMapper objectMapper,
            AiRuntimeConfigService aiRuntimeConfigService,
            HttpClient httpClient) {
        this.objectMapper = objectMapper;
        this.aiRuntimeConfigService = aiRuntimeConfigService;
        this.httpClient = httpClient;
    }

    /**
     * 调用 AI 生成快乐8选5推荐 JSON。
     *
     * @param report 历史特征报告
     * @return AI 输出文本
     */
    public String recommend(LotteryKl8FeatureReport report) {
        AiRuntimeConfig config = aiRuntimeConfigService.current();
        if (!StringUtils.hasText(config.apiKey()) || !StringUtils.hasText(config.model()) || !StringUtils.hasText(config.apiUrl())) {
            throw new IllegalStateException("AI 推荐配置不完整");
        }
        try {
            String body = objectMapper.writeValueAsString(buildPayload(report, config.model()));
            HttpRequest request = HttpRequest.newBuilder(URI.create(config.apiUrl()))
                    .timeout(Duration.ofSeconds(90))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .header("Authorization", "Bearer " + config.apiKey())
                    .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("AI 推荐接口返回 HTTP " + response.statusCode());
            }
            JsonNode root = objectMapper.readTree(response.body());
            return root.path("choices").path(0).path("message").path("content").asText("");
        } catch (IOException e) {
            throw new IllegalStateException("AI 推荐网络调用失败", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("AI 推荐调用被中断", e);
        }
    }

    private Map<String, Object> buildPayload(LotteryKl8FeatureReport report, String model) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", model);
        payload.put("temperature", 0.42);
        payload.put("max_tokens", 5000);
        payload.put("messages", List.of(
                Map.of("role", "system", "content", systemPrompt()),
                Map.of("role", "user", "content", userPrompt(report))
        ));
        return payload;
    }

    private String systemPrompt() {
        return """
                你是彩票历史数据统计分析助手，需要像多角色预测团队一样工作：
                1. 统计分析员：只基于输入的历史特征识别冷热、遗漏、趋势、区间、尾数、共现和波动信号。
                2. 候选策略师：从候选池里组合 1 组选5号码，要求区间、奇偶、尾数和信号来源分散。
                3. 风险审稿员：主动指出随机性、过拟合和历史样本局限。
                4. 最终选择器：输出可解析 JSON。

                彩票结果具有随机性，你不能承诺命中，也不能给投注金额建议。
                只输出 JSON，不要 Markdown，不要解释 JSON 之外的内容。
                JSON 结构必须是：
                {
                  "confidenceLabel":"低|中低|中",
                  "analysis":{
                    "overview":"80到180字中文总览",
                    "featureSignals":["至少4条特征信号"],
                    "combinationLogic":["至少3条组合逻辑"],
                    "riskWarnings":["至少2条风险提示，必须包含随机性和不保证命中"]
                  },
                  "groups":[{"numbers":[1,2,3,4,5],"reason":"30到120字中文理由"}]
                }。
                必须恰好 1 组，每组恰好 5 个整数，号码范围 1-80，组内不重复。
                confidenceLabel 最高只能是“中”，不能输出“高”。
                """;
    }

    private String userPrompt(LotteryKl8FeatureReport report) {
        return """
                请根据以下快乐8深度历史特征，为下一期选5玩法生成 1 组娱乐统计参考号码。

                ## 深度摘要
                %s

                ## 结构化输入 JSON
                %s

                要求：
                - 优先以 optimizedPortfolio 的 1 组为硬参考，除非有明确结构性理由才微调。
                - candidatePool、backtestSummary、numberProfiles 是选号证据，不能脱离这些输入自由编造。
                - 推荐组要说明用到了哪些历史特征。
                - 不要输出投注建议，不要暗示稳赚或必出。
                """.formatted(
                report.deepSummary(),
                reportJson(report));
    }

    private String reportJson(LotteryKl8FeatureReport report) {
        try {
            Map<String, Object> input = new LinkedHashMap<>();
            input.put("baseIssueCount", report.baseIssueCount());
            input.put("latestIssueNo", report.latestIssueNo());
            input.put("summary", report.summary());
            input.put("deepSummary", report.deepSummary());
            input.put("hotNumbers", report.hotNumbers());
            input.put("coldNumbers", report.coldNumbers());
            input.put("missingTop", report.missingNumbers().entrySet().stream()
                    .sorted((left, right) -> right.getValue().compareTo(left.getValue()))
                    .limit(20)
                    .toList());
            input.put("rangeCounts", report.rangeCounts());
            input.put("tailCounts", report.tailCounts());
            input.put("moduloCounts", report.moduloCounts());
            input.put("oddEven", Map.of("odd", report.oddCount(), "even", report.evenCount()));
            input.put("analysisSections", report.analysisSections());
            input.put("candidatePool", report.candidatePool());
            input.put("pairHighlights", report.pairHighlights());
            input.put("backtestSummary", report.backtestSummary());
            input.put("optimizedPortfolio", report.optimizedPortfolio());
            input.put("numberProfiles", report.numberProfiles());
            return objectMapper.writeValueAsString(input);
        } catch (IOException e) {
            throw new IllegalStateException("快乐8深度特征序列化失败", e);
        }
    }
}
