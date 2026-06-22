package com.lcbinterview.common;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void handleBusinessUsesMatchingHttpStatusForStandardErrorCodes() {
        assertBusinessStatus(401, HttpStatus.UNAUTHORIZED);
        assertBusinessStatus(403, HttpStatus.FORBIDDEN);
        assertBusinessStatus(404, HttpStatus.NOT_FOUND);
        assertBusinessStatus(409, HttpStatus.CONFLICT);
        assertBusinessStatus(503, HttpStatus.SERVICE_UNAVAILABLE);
    }

    @Test
    void handleBusinessFallsBackToBadRequestForNonErrorBusinessCodes() {
        assertBusinessStatus(200, HttpStatus.BAD_REQUEST);
        assertBusinessStatus(499, HttpStatus.BAD_REQUEST);
    }

    private void assertBusinessStatus(int code, HttpStatus expectedStatus) {
        ResponseEntity<ApiResponse<Void>> response = handler.handleBusiness(new BusinessException(code, "business error"));

        assertThat(response.getStatusCode()).isEqualTo(expectedStatus);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo(code);
        assertThat(response.getBody().message()).isEqualTo("business error");
    }
}
