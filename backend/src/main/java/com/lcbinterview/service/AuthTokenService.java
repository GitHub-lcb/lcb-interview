package com.lcbinterview.service;

import com.lcbinterview.common.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;

/**
 * 普通用户访问令牌服务。使用 HMAC 签名避免引入完整安全框架。
 */
@Service
public class AuthTokenService {

    private static final String HMAC_ALGORITHM = "HmacSHA256";

    private final String secret;
    private final long ttlSeconds;
    private final Clock clock;

    /**
     * 创建访问令牌服务。
     *
     * @param secret 令牌签名密钥
     * @param ttlHours 令牌有效小时数
     */
    public AuthTokenService(
            @Value("${app.auth.secret}") String secret,
            @Value("${app.auth.token-ttl-hours:168}") long ttlHours) {
        this(secret, ttlHours, Clock.systemUTC());
    }

    AuthTokenService(String secret, long ttlHours, Clock clock) {
        this.secret = StringUtils.hasText(secret) ? secret : "dev-user-auth-secret-change-me";
        this.ttlSeconds = Math.max(1L, ttlHours) * 3600L;
        this.clock = clock;
    }

    /**
     * 为用户签发访问令牌。
     *
     * @param userId 普通用户 ID
     * @return 访问令牌
     */
    public String issueToken(Long userId) {
        long expiresAt = Instant.now(clock).plusSeconds(ttlSeconds).getEpochSecond();
        String payload = userId + ":" + expiresAt;
        String encodedPayload = encode(payload);
        return encodedPayload + "." + sign(encodedPayload);
    }

    /**
     * 解析并校验访问令牌。
     *
     * @param token 访问令牌
     * @return 普通用户 ID
     */
    public Long parseUserId(String token) {
        if (!StringUtils.hasText(token) || !token.contains(".")) {
            throw invalidToken();
        }
        String[] parts = token.split("\\.", 2);
        String encodedPayload = parts[0];
        String signature = parts[1];
        if (!sign(encodedPayload).equals(signature)) {
            throw invalidToken();
        }
        String payload = decode(encodedPayload);
        String[] payloadParts = payload.split(":", 2);
        if (payloadParts.length != 2) {
            throw invalidToken();
        }
        try {
            Long userId = Long.parseLong(payloadParts[0]);
            long expiresAt = Long.parseLong(payloadParts[1]);
            if (expiresAt < Instant.now(clock).getEpochSecond()) {
                throw invalidToken();
            }
            return userId;
        } catch (NumberFormatException e) {
            throw invalidToken();
        }
    }

    private String sign(String value) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM));
            return Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("普通用户令牌签名失败", e);
        }
    }

    private String encode(String value) {
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    private String decode(String value) {
        try {
            return new String(Base64.getUrlDecoder().decode(value), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            throw invalidToken();
        }
    }

    private BusinessException invalidToken() {
        return new BusinessException(401, "登录状态已失效");
    }
}
