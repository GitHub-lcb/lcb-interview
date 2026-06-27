package com.lcbinterview.service;

import com.lcbinterview.common.BusinessException;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class AuthTokenServiceTest {

    @Test
    void parsesIssuedToken() {
        AuthTokenService service = new AuthTokenService("secret", 1, fixedClock("2026-06-27T00:00:00Z"));

        String token = service.issueToken(42L);

        assertEquals(42L, service.parseUserId(token));
    }

    @Test
    void rejectsTamperedToken() {
        AuthTokenService service = new AuthTokenService("secret", 1, fixedClock("2026-06-27T00:00:00Z"));

        String token = service.issueToken(42L) + "x";

        assertThrows(BusinessException.class, () -> service.parseUserId(token));
    }

    @Test
    void rejectsExpiredToken() {
        AuthTokenService issuer = new AuthTokenService("secret", 1, fixedClock("2026-06-27T00:00:00Z"));
        AuthTokenService parser = new AuthTokenService("secret", 1, fixedClock("2026-06-27T02:00:01Z"));

        String token = issuer.issueToken(42L);

        assertThrows(BusinessException.class, () -> parser.parseUserId(token));
    }

    private Clock fixedClock(String value) {
        return Clock.fixed(Instant.parse(value), ZoneOffset.UTC);
    }
}
