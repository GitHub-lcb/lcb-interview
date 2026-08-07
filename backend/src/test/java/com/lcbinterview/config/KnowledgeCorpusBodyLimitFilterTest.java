package com.lcbinterview.config;

import com.lcbinterview.common.PayloadTooLargeException;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class KnowledgeCorpusBodyLimitFilterTest {

    private KnowledgeCorpusBodyLimitFilter filter;

    @BeforeEach
    void setUp() {
        filter = new KnowledgeCorpusBodyLimitFilter();
        ReflectionTestUtils.setField(filter, "maxBodyBytes", 16L);
    }

    @Test
    void rejectsKnownOversizedBodyBeforeReading() throws Exception {
        MockHttpServletRequest request = requestWithBody("0123456789ABCDEFG");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (req, res) -> {
            throw new AssertionError("超限请求不应进入下游");
        });

        assertEquals(413, response.getStatus());
    }

    @Test
    void stopsChunkedBodyWhileDownstreamReads() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST",
                "/api/admin/knowledge/corpus/import") {
            @Override
            public long getContentLengthLong() {
                return -1;
            }
        };
        request.setContent("0123456789ABCDEFG".getBytes(StandardCharsets.UTF_8));
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain drainBody = (req, res) -> req.getInputStream().readAllBytes();

        assertThrows(PayloadTooLargeException.class,
                () -> filter.doFilter(request, response, drainBody));
    }

    @Test
    void ignoresOtherEndpoints() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/questions");
        request.setContent("0123456789ABCDEFG".getBytes(StandardCharsets.UTF_8));
        MockHttpServletResponse response = new MockHttpServletResponse();
        int[] calls = {0};

        filter.doFilter(request, response, (req, res) -> calls[0] += 1);

        assertEquals(1, calls[0]);
    }

    private MockHttpServletRequest requestWithBody(String body) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST",
                "/api/admin/knowledge/corpus/import");
        request.setContent(body.getBytes(StandardCharsets.UTF_8));
        return request;
    }
}
