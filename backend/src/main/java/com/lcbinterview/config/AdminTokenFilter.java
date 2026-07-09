package com.lcbinterview.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * Admin API Token 校验过滤器。所有 /api/admin/* 请求需要携带 Authorization: Bearer <token>
 * 或查询参数 ?token=<token>（后者仅用于 SSE EventSource 等无法自定义请求头的端点）。
 * <p>
 * 安全要点：
 * <ul>
 *   <li>Token 比较使用 {@link MessageDigest#isEqual} 常量时间算法，防止时序攻击逐字节猜测</li>
 *   <li>查询参数传 Token 仅对 SSE 端点（路径以 -stream 结尾）放行，避免 Token 泄漏到访问日志和 Referer</li>
 * </ul>
 * @author chongan
 */
@Component
@Order(1)
public class AdminTokenFilter implements Filter {

    @Value("${admin.token}")
    private String adminToken;

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest req = (HttpServletRequest) request;
        HttpServletResponse res = (HttpServletResponse) response;

        String path = req.getRequestURI();
        if (!path.startsWith("/api/admin/")) {
            chain.doFilter(request, response);
            return;
        }

        String auth = req.getHeader("Authorization");
        if (auth != null && constantTimeEquals(auth, "Bearer " + adminToken)) {
            chain.doFilter(request, response);
            return;
        }

        // 查询参数传 Token 仅允许 SSE 端点使用，避免 Token 出现在普通请求的 URL、日志和 Referer 中
        if (path.endsWith("-stream")) {
            String queryToken = req.getParameter("token");
            if (queryToken != null && constantTimeEquals(queryToken, adminToken)) {
                chain.doFilter(request, response);
                return;
            }
        }

        res.setStatus(401);
        res.setContentType("application/json;charset=UTF-8");
        res.getWriter().write("{\"code\":401,\"message\":\"Unauthorized\"}");
    }

    /**
     * 常量时间字符串比较，防止通过响应时间差逐字节猜测 Token。
     *
     * @param a 待比较字符串
     * @param b 目标字符串
     * @return true 表示内容相等
     */
    private boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null) {
            return false;
        }
        byte[] bytesA = a.getBytes(StandardCharsets.UTF_8);
        byte[] bytesB = b.getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(bytesA, bytesB);
    }
}
