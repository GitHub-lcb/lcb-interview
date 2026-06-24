package com.lcbinterview.service;

import com.lcbinterview.dto.AdminAiConfigStatusVO;
import com.lcbinterview.dto.AdminAiConfigUpdateRequest;
import com.lcbinterview.dto.AdminAiConfigVO;
import com.lcbinterview.mapper.AiConfigMapper;
import com.lcbinterview.model.AiConfig;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.net.URI;

/**
 * AI 运行时配置服务，统一处理数据库覆盖、环境变量兜底和密钥脱敏。
 */
@Service
public class AiRuntimeConfigService {

    private static final long SINGLETON_ID = 1L;

    private final AiConfigMapper aiConfigMapper;
    private final String envApiKey;
    private final String envModel;
    private final String envApiUrl;
    private final boolean envInterviewEnabled;

    /**
     * 创建 AI 运行时配置服务。
     *
     * @param aiConfigMapper       AI 配置 Mapper
     * @param envApiKey            环境变量中的 API Key
     * @param envModel             环境变量中的模型名称
     * @param envApiUrl            环境变量中的接口地址
     * @param envInterviewEnabled  环境变量中的面试评分开关
     */
    @Autowired
    public AiRuntimeConfigService(
            AiConfigMapper aiConfigMapper,
            @Value("${ai.deepseek.api-key:}") String envApiKey,
            @Value("${ai.deepseek.model:deepseek-v4-flash}") String envModel,
            @Value("${ai.deepseek.url:https://opencode.ai/zen/go/v1/chat/completions}") String envApiUrl,
            @Value("${ai.interview.enabled:true}") boolean envInterviewEnabled) {
        this.aiConfigMapper = aiConfigMapper;
        this.envApiKey = normalize(envApiKey);
        this.envModel = normalize(envModel);
        this.envApiUrl = normalize(envApiUrl);
        this.envInterviewEnabled = envInterviewEnabled;
    }

    /**
     * 查询当前实际生效的 AI 配置。数据库字段非空时优先使用数据库，否则回退环境变量。
     *
     * @return 当前实际生效配置
     */
    @Transactional(readOnly = true)
    public AiRuntimeConfig current() {
        AiConfig stored = aiConfigMapper.selectById(SINGLETON_ID);
        return toRuntimeConfig(stored);
    }

    /**
     * 查询管理端可展示的 AI 配置，密钥只返回脱敏值。
     *
     * @return 管理端 AI 配置展示对象
     */
    @Transactional(readOnly = true)
    public AdminAiConfigVO publicConfig() {
        return toPublicConfig(current());
    }

    /**
     * 查询旧状态接口需要的配置状态，兼容既有前端禁用逻辑。
     *
     * @return 旧版 AI 配置状态对象
     */
    @Transactional(readOnly = true)
    public AdminAiConfigStatusVO legacyStatus() {
        AdminAiConfigVO config = publicConfig();
        return new AdminAiConfigStatusVO(
                config.available(),
                config.apiKeyConfigured(),
                config.model(),
                config.endpointHost(),
                config.message());
    }

    /**
     * 保存管理端 AI 配置。apiKey 留空时保留已有数据库密钥，其他字段留空时表示使用环境变量兜底。
     *
     * @param request 配置更新请求
     * @return 保存后的管理端展示配置
     */
    @Transactional
    public AdminAiConfigVO save(AdminAiConfigUpdateRequest request) {
        AiConfig existing = aiConfigMapper.selectById(SINGLETON_ID);
        AiConfig target = existing == null ? new AiConfig() : existing;
        target.setId(SINGLETON_ID);

        if (StringUtils.hasText(request.apiKey())) {
            target.setApiKey(request.apiKey().trim());
        }
        target.setModel(blankToNull(request.model()));
        target.setApiUrl(blankToNull(request.apiUrl()));
        if (request.interviewEnabled() != null) {
            target.setInterviewEnabled(request.interviewEnabled());
        }

        if (existing == null) {
            aiConfigMapper.insert(target);
        } else {
            aiConfigMapper.updateById(target);
        }
        return toPublicConfig(toRuntimeConfig(target));
    }

    private AiRuntimeConfig toRuntimeConfig(AiConfig stored) {
        if (stored == null) {
            return new AiRuntimeConfig(envApiKey, envModel, envApiUrl, envInterviewEnabled);
        }
        return new AiRuntimeConfig(
                firstText(stored.getApiKey(), envApiKey),
                firstText(stored.getModel(), envModel),
                firstText(stored.getApiUrl(), envApiUrl),
                stored.getInterviewEnabled() == null ? envInterviewEnabled : stored.getInterviewEnabled());
    }

    private AdminAiConfigVO toPublicConfig(AiRuntimeConfig config) {
        boolean available = config.generationAvailable();
        return new AdminAiConfigVO(
                available,
                config.apiKeyConfigured(),
                mask(config.apiKey()),
                config.model(),
                config.apiUrl(),
                endpointHost(config.apiUrl()),
                config.interviewEnabled(),
                statusMessage(config));
    }

    private String statusMessage(AiRuntimeConfig config) {
        if (!config.apiKeyConfigured()) {
            return "AI 生成服务未配置密钥，请在页面保存 API Key，或设置 AI_OPENCODE_API_KEY";
        }
        if (!config.modelConfigured()) {
            return "AI 生成服务未配置模型，请在页面保存模型名称，或设置 AI_DEEPSEEK_MODEL";
        }
        if (!config.endpointConfigured()) {
            return "AI 生成服务未配置接口地址，请在页面保存接口地址，或设置 AI_DEEPSEEK_URL";
        }
        return "AI 生成服务已配置";
    }

    private String endpointHost(String apiUrl) {
        if (!StringUtils.hasText(apiUrl)) {
            return "";
        }
        try {
            String host = URI.create(apiUrl).getHost();
            return host == null ? "" : host;
        } catch (IllegalArgumentException e) {
            return "";
        }
    }

    private String mask(String value) {
        if (!StringUtils.hasText(value)) {
            return "";
        }
        String trimmed = value.trim();
        if (trimmed.length() <= 8) {
            return "****";
        }
        return trimmed.substring(0, 4) + "****" + trimmed.substring(trimmed.length() - 4);
    }

    private String firstText(String preferred, String fallback) {
        return StringUtils.hasText(preferred) ? preferred.trim() : fallback;
    }

    private String blankToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private static String normalize(String value) {
        return StringUtils.hasText(value) ? value.trim() : "";
    }
}
