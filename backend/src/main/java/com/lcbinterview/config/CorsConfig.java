package com.lcbinterview.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.List;

/**
 * CORS 跨域配置。
 * <p>
 * 开发环境默认允许所有来源；生产环境通过环境变量 CORS_ALLOWED_ORIGINS 指定白名单域名，
 * 多个域名逗号分隔，例如：https://interview.example.com,https://admin.example.com。
 * @author chongan
 */
@Configuration
public class CorsConfig {

    @Value("${cors.allowed-origins:}")
    private String allowedOrigins;

    /**
     * 创建 CORS 过滤器。生产环境应通过环境变量限制允许的来源域名。
     *
     * @return CORS 过滤器
     */
    @Bean
    public CorsFilter corsFilter() {
        CorsConfiguration config = new CorsConfiguration();
        if (allowedOrigins == null || allowedOrigins.isBlank()) {
            // 开发环境兜底：允许所有来源
            config.addAllowedOriginPattern("*");
        } else {
            // 生产环境：仅允许配置的域名
            for (String origin : allowedOrigins.split(",")) {
                String trimmed = origin.trim();
                if (!trimmed.isEmpty()) {
                    config.addAllowedOrigin(trimmed);
                }
            }
        }
        config.addAllowedMethod("*");
        config.addAllowedHeader("*");
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return new CorsFilter(source);
    }
}
