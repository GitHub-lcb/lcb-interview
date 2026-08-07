package com.lcbinterview.config;

import com.lcbinterview.common.PayloadTooLargeException;
import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * 限制面经导入端点的原始请求体大小，防止 JSON 反序列化前占满应用堆。
 */
@Component
@Order(2)
public class KnowledgeCorpusBodyLimitFilter implements Filter {

    private static final String IMPORT_PATH = "/api/admin/knowledge/corpus/import";

    @Value("${app.knowledge.corpus.max-import-body-bytes:10485760}")
    private long maxBodyBytes;

    /**
     * 对语料导入请求应用字节限制，其他请求直接放行。
     *
     * @param request  Servlet 请求
     * @param response Servlet 响应
     * @param chain    过滤器链
     * @throws IOException      读取失败
     * @throws ServletException 下游处理失败
     */
    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        if (!"POST".equalsIgnoreCase(httpRequest.getMethod())
                || !IMPORT_PATH.equals(httpRequest.getRequestURI())) {
            chain.doFilter(request, response);
            return;
        }

        long contentLength = httpRequest.getContentLengthLong();
        if (contentLength > maxBodyBytes) {
            writeTooLarge((HttpServletResponse) response);
            return;
        }
        chain.doFilter(new LimitedRequest(httpRequest, maxBodyBytes), response);
    }

    private void writeTooLarge(HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_REQUEST_ENTITY_TOO_LARGE);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"code\":413,\"message\":\"语料导入请求体超过限制\",\"data\":null}");
    }

    private static final class LimitedRequest extends HttpServletRequestWrapper {

        private final long maxBytes;

        private LimitedRequest(HttpServletRequest request, long maxBytes) {
            super(request);
            this.maxBytes = maxBytes;
        }

        @Override
        public ServletInputStream getInputStream() throws IOException {
            return new LimitedInputStream(super.getInputStream(), maxBytes);
        }
    }

    private static final class LimitedInputStream extends ServletInputStream {

        private final ServletInputStream delegate;
        private final long maxBytes;
        private long bytesRead;

        private LimitedInputStream(ServletInputStream delegate, long maxBytes) {
            this.delegate = delegate;
            this.maxBytes = maxBytes;
        }

        @Override
        public int read() throws IOException {
            int value = delegate.read();
            if (value >= 0) {
                count(1);
            }
            return value;
        }

        @Override
        public int read(byte[] bytes, int offset, int length) throws IOException {
            int count = delegate.read(bytes, offset, length);
            if (count > 0) {
                count(count);
            }
            return count;
        }

        private void count(int count) throws PayloadTooLargeException {
            bytesRead += count;
            if (bytesRead > maxBytes) {
                throw new PayloadTooLargeException("语料导入请求体超过限制");
            }
        }

        @Override
        public boolean isFinished() {
            return delegate.isFinished();
        }

        @Override
        public boolean isReady() {
            return delegate.isReady();
        }

        @Override
        public void setReadListener(ReadListener readListener) {
            delegate.setReadListener(readListener);
        }
    }
}
