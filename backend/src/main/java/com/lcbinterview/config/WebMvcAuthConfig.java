package com.lcbinterview.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 普通用户认证拦截配置。限定到个人工具路径，避免影响公开题库和管理后台。
 */
@Configuration
@ConditionalOnBean(UserAuthInterceptor.class)
@RequiredArgsConstructor
public class WebMvcAuthConfig implements WebMvcConfigurer {

    private final UserAuthInterceptor userAuthInterceptor;

    /**
     * 注册普通用户认证拦截器。
     *
     * @param registry 拦截器注册器
     */
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(userAuthInterceptor)
                .addPathPatterns("/api/tools/**", "/api/auth/me");
    }
}
