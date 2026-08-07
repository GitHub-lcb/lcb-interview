package com.lcbinterview.service;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AiHttpClientResponseLimitTest {

    @Test
    void rejectsSuccessResponseBeyondConfiguredByteLimit() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        byte[] response = ("{\"choices\":[{\"message\":{\"content\":\""
                + "x".repeat(1024) + "\"}}]}").getBytes(StandardCharsets.UTF_8);
        server.createContext("/chat", exchange -> {
            exchange.getRequestBody().readAllBytes();
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();

        try {
            AiHttpClient client = new AiHttpClient();
            ReflectionTestUtils.setField(client, "maxResponseBytes", 64);
            AiRuntimeConfig config = new AiRuntimeConfig("test-key", "test-model",
                    "http://127.0.0.1:" + server.getAddress().getPort() + "/chat", true);

            RuntimeException error = assertThrows(RuntimeException.class,
                    () -> client.callSync("test", config, 100, 5000));

            assertTrue(error.getMessage().contains("响应体超过限制"));
        } finally {
            server.stop(0);
        }
    }
}
