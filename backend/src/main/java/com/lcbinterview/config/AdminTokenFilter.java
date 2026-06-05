package com.lcbinterview.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import java.io.IOException;

/**
 * Admin API Token 校验过滤器。所有 /api/admin/* 请求需要携带 Authorization: Bearer <token>
 * 或查询参数 ?token=<token>（后者用于 EventSource 等无法自定义请求头的场景）。
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
        if (auth != null && auth.equals("Bearer " + adminToken)) {
            chain.doFilter(request, response);
            return;
        }

        // EventSource 不支持自定义请求头，允许通过查询参数传递 token
        String queryToken = req.getParameter("token");
        if (queryToken != null && queryToken.equals(adminToken)) {
            chain.doFilter(request, response);
            return;
        }

        res.setStatus(401);
        res.setContentType("application/json;charset=UTF-8");
        res.getWriter().write("{\"code\":401,\"message\":\"Unauthorized\"}");
    }
}
