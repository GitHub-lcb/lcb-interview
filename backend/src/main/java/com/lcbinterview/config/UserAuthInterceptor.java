package com.lcbinterview.config;

import com.lcbinterview.common.BusinessException;
import com.lcbinterview.service.AuthTokenService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * 普通用户访问拦截器，仅保护个人工具接口和当前用户接口。
 */
@Component
@ConditionalOnBean(AuthTokenService.class)
@RequiredArgsConstructor
public class UserAuthInterceptor implements HandlerInterceptor {

    private final AuthTokenService authTokenService;

    /**
     * 在 Controller 执行前解析普通用户令牌。
     *
     * @param request  HTTP 请求
     * @param response HTTP 响应
     * @param handler  处理器
     * @return true 表示继续执行
     */
    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            throw new BusinessException(401, "请先登录");
        }
        AuthUserContext.setUserId(authTokenService.parseUserId(header.substring("Bearer ".length())));
        return true;
    }

    /**
     * 请求结束后清理普通用户上下文。
     *
     * @param request  HTTP 请求
     * @param response HTTP 响应
     * @param handler  处理器
     * @param ex       请求异常
     */
    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        AuthUserContext.clear();
    }
}
