package com.lcbinterview.service;

import org.junit.jupiter.api.Test;

import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLParameters;
import javax.net.ssl.SSLSession;
import java.io.IOException;
import java.net.Authenticator;
import java.net.CookieHandler;
import java.net.ProxySelector;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpHeaders;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ZhcwKl8DrawFetcherTest {

    @Test
    void parsesSimpleHtmlFixture() {
        ZhcwKl8DrawFetcher fetcher = new ZhcwKl8DrawFetcher(null);
        String html = """
                <table>
                  <tr><td>2026150</td><td>2026-06-27</td>
                  <td>01 02 03 04 05 06 07 08 09 10 11 12 13 14 15 16 17 18 19 20</td></tr>
                </table>
                """;

        List<LotteryKl8FetchedDraw> draws = fetcher.parseHtml(html);

        assertEquals(1, draws.size());
        assertEquals("2026150", draws.get(0).issueNo());
        assertEquals(20, draws.get(0).numbers().size());
    }

    @Test
    void parsesZhcwJsonpFixture() {
        ZhcwKl8DrawFetcher fetcher = new ZhcwKl8DrawFetcher(null);
        String jsonp = """
                callback({"resCode":"000000","data":[{"issue":"2026168","openTime":"2026-06-27","frontWinningNum":"02 06 08 09 20 21 24 25 31 33 42 44 46 48 55 61 64 66 72 77"}]});
                """;

        List<LotteryKl8FetchedDraw> draws = fetcher.parseHtml(jsonp);

        assertEquals(1, draws.size());
        assertEquals("2026168", draws.get(0).issueNo());
        assertEquals(2026, draws.get(0).drawDate().getYear());
        assertEquals(List.of(2, 6, 8, 9, 20, 21, 24, 25, 31, 33, 42, 44, 46, 48, 55, 61, 64, 66, 72, 77),
                draws.get(0).numbers());
    }

    @Test
    void fetchesFromZhcwJsonpDataApi() {
        CapturingHttpClient httpClient = new CapturingHttpClient(List.of(
                """
                        callback({"resCode":"000000","data":[{"issue":"2026168","openTime":"2026-06-27","frontWinningNum":"02 06 08 09 20 21 24 25 31 33 42 44 46 48 55 61 64 66 72 77"}]});
                        """,
                """
                        callback({"resCode":"000000","data":[]});
                        """
        ));
        ZhcwKl8DrawFetcher fetcher = new ZhcwKl8DrawFetcher(httpClient);

        List<LotteryKl8FetchedDraw> draws = fetcher.fetchRecentDraws();

        assertEquals("jc.zhcw.com", httpClient.request.uri().getHost());
        assertEquals("/port/client_json.php", httpClient.request.uri().getPath());
        assertTrue(httpClient.request.uri().getQuery().contains("transactionType=10001001"));
        assertTrue(httpClient.request.uri().getQuery().contains("lotteryId=6"));
        assertEquals("https://www.zhcw.com/kjxx/kl8/",
                httpClient.request.headers().firstValue("Referer").orElse(""));
        assertEquals(1, draws.size());
        assertEquals("2026168", draws.get(0).issueNo());
    }

    @Test
    void fetchesPagedZhcwJsonpDataApiUntilNoMoreDraws() {
        CapturingHttpClient httpClient = new CapturingHttpClient(List.of(
                """
                        callback({"resCode":"000000","data":[
                        {"issue":"2026168","openTime":"2026-06-27","frontWinningNum":"02 06 08 09 20 21 24 25 31 33 42 44 46 48 55 61 64 66 72 77"},
                        {"issue":"2026167","openTime":"2026-06-26","frontWinningNum":"01 03 05 07 09 11 13 15 17 19 21 23 25 27 29 31 33 35 37 39"}]});
                        """,
                """
                        callback({"resCode":"000000","data":[
                        {"issue":"2026166","openTime":"2026-06-25","frontWinningNum":"04 08 12 16 20 24 28 32 36 40 44 48 52 56 60 64 68 72 76 80"}]});
                        """,
                """
                        callback({"resCode":"000000","data":[]});
                        """
        ));
        ZhcwKl8DrawFetcher fetcher = new ZhcwKl8DrawFetcher(httpClient);

        List<LotteryKl8FetchedDraw> draws = fetcher.fetchRecentDraws();

        assertEquals(3, httpClient.requests.size());
        assertTrue(httpClient.requests.get(0).uri().getQuery().contains("pageNum=1"));
        assertTrue(httpClient.requests.get(1).uri().getQuery().contains("pageNum=2"));
        assertTrue(httpClient.requests.get(2).uri().getQuery().contains("pageNum=3"));
        assertTrue(httpClient.requests.get(0).uri().getQuery().contains("pageSize=500"));
        assertEquals(3, draws.size());
        assertEquals(List.of("2026168", "2026167", "2026166"),
                draws.stream().map(LotteryKl8FetchedDraw::issueNo).toList());
    }

    private static class CapturingHttpClient extends HttpClient {

        private final Deque<String> bodies;
        private HttpRequest request;
        private final List<HttpRequest> requests = new ArrayList<>();

        private CapturingHttpClient(String body) {
            this(List.of(body));
        }

        private CapturingHttpClient(List<String> bodies) {
            this.bodies = new ArrayDeque<>(bodies);
        }

        @Override
        public Optional<CookieHandler> cookieHandler() {
            return Optional.empty();
        }

        @Override
        public Optional<Duration> connectTimeout() {
            return Optional.empty();
        }

        @Override
        public Redirect followRedirects() {
            return Redirect.NEVER;
        }

        @Override
        public Optional<ProxySelector> proxy() {
            return Optional.empty();
        }

        @Override
        public SSLContext sslContext() {
            return null;
        }

        @Override
        public SSLParameters sslParameters() {
            return null;
        }

        @Override
        public Optional<Authenticator> authenticator() {
            return Optional.empty();
        }

        @Override
        public Version version() {
            return Version.HTTP_1_1;
        }

        @Override
        public Optional<Executor> executor() {
            return Optional.empty();
        }

        @Override
        public <T> HttpResponse<T> send(HttpRequest request, HttpResponse.BodyHandler<T> responseBodyHandler)
                throws IOException, InterruptedException {
            this.request = request;
            this.requests.add(request);
            @SuppressWarnings("unchecked")
            T typedBody = (T) bodies.removeFirst();
            return new SimpleHttpResponse<>(request, typedBody);
        }

        @Override
        public <T> CompletableFuture<HttpResponse<T>> sendAsync(
                HttpRequest request,
                HttpResponse.BodyHandler<T> responseBodyHandler) {
            try {
                return CompletableFuture.completedFuture(send(request, responseBodyHandler));
            } catch (IOException | InterruptedException e) {
                return CompletableFuture.failedFuture(e);
            }
        }

        @Override
        public <T> CompletableFuture<HttpResponse<T>> sendAsync(
                HttpRequest request,
                HttpResponse.BodyHandler<T> responseBodyHandler,
                HttpResponse.PushPromiseHandler<T> pushPromiseHandler) {
            return sendAsync(request, responseBodyHandler);
        }
    }

    private record SimpleHttpResponse<T>(HttpRequest request, T body) implements HttpResponse<T> {

        @Override
        public int statusCode() {
            return 200;
        }

        @Override
        public HttpHeaders headers() {
            return HttpHeaders.of(java.util.Map.of(), (left, right) -> true);
        }

        @Override
        public Optional<HttpResponse<T>> previousResponse() {
            return Optional.empty();
        }

        @Override
        public Optional<SSLSession> sslSession() {
            return Optional.empty();
        }

        @Override
        public URI uri() {
            return request.uri();
        }

        @Override
        public HttpClient.Version version() {
            return HttpClient.Version.HTTP_1_1;
        }
    }
}
