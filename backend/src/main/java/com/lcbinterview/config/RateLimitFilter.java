package com.lcbinterview.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 简单的 IP 级别请求限流过滤器，保护登录和注册端点防暴力破解。
 * <p>
 * 使用内存滑动窗口，每个 IP 在时间窗口内最多允许 {@link #MAX_REQUESTS} 次请求。
 * 超出限制后返回 429 Too Many Requests。
 * <p>
 * 适用范围仅限 /api/auth/login 和 /api/auth/register，不影响其他接口。
 *
 * @author chongan
 */
@Slf4j
@Component
@Order(2)
public class RateLimitFilter implements Filter {

    /** 每个 IP 在时间窗口内允许的最大请求次数 */
    private static final int MAX_REQUESTS = 10;
    /** 滑动窗口大小（毫秒），1 分钟 */
    private static final long WINDOW_MILLIS = 60_000L;

    private final Map<String, RateBucket> buckets = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest req = (HttpServletRequest) request;
        String path = req.getRequestURI();

        // 仅限流登录和注册端点
        if (!"/api/auth/login".equals(path) && !"/api/auth/register".equals(path)) {
            chain.doFilter(request, response);
            return;
        }

        String clientIp = extractClientIp(req);
        String key = clientIp + ":" + path;
        RateBucket bucket = buckets.compute(key, (k, existing) -> {
            long now = System.currentTimeMillis();
            if (existing == null || now - existing.windowStart > WINDOW_MILLIS) {
                return new RateBucket(now);
            }
            return existing;
        });

        int count = bucket.counter.incrementAndGet();
        if (count > MAX_REQUESTS) {
            log.warn("限流触发: ip={}, path={}, count={}", clientIp, path, count);
            HttpServletResponse res = (HttpServletResponse) response;
            res.setStatus(429);
            res.setContentType("application/json;charset=UTF-8");
            res.getWriter().write(objectMapper.writeValueAsString(Map.of(
                    "code", 429,
                    "message", "请求过于频繁，请稍后再试"
            )));
            return;
        }

        chain.doFilter(request, response);
    }

    /**
     * 提取客户端真实 IP，优先从反向代理头获取。
     *
     * @param req HTTP 请求
     * @return 客户端 IP
     */
    private String extractClientIp(HttpServletRequest req) {
        String xff = req.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        String realIp = req.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        return req.getRemoteAddr();
    }

    /**
     * 限流桶，记录窗口起始时间和请求计数。
     */
    private static class RateBucket {
        final long windowStart;
        final AtomicInteger counter = new AtomicInteger(0);

        RateBucket(long windowStart) {
            this.windowStart = windowStart;
        }
    }
}
