package com.lcbinterview.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PasswordHashServiceTest {

    @Test
    void hashesAndVerifiesPassword() {
        PasswordHashService service = new PasswordHashService();

        String hash = service.hash("password123");

        assertTrue(service.matches("password123", hash));
        assertFalse(service.matches("wrong-password", hash));
    }

    @Test
    void usesDifferentSaltForEachHash() {
        PasswordHashService service = new PasswordHashService();

        String first = service.hash("password123");
        String second = service.hash("password123");

        assertNotEquals(first, second);
    }
}
