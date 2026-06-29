package com.lcbinterview.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 中彩网快乐8开奖信息页抓取器。
 * 页面结构可能变化，因此解析逻辑尽量只依赖期号、日期和号码的文本特征。
 */
@Slf4j
@Service
public class ZhcwKl8DrawFetcher implements LotteryKl8DrawFetcher {

    private static final String PAGE_URL = "https://www.zhcw.com/kjxx/kl8/";
    private static final String SOURCE_URL = "https://jc.zhcw.com/port/client_json.php";
    private static final String SOURCE_NAME = "中彩网快乐8开奖信息";
    private static final Pattern DATE_PATTERN = Pattern.compile("(20\\d{2})[-年/.](\\d{1,2})[-月/.](\\d{1,2})");
    private static final Pattern ISSUE_PATTERN = Pattern.compile("(20\\d{5,}|\\d{7,})");
    private static final Pattern NUMBER_PATTERN = Pattern.compile("(?<!\\d)(0?[1-9]|[1-7]\\d|80)(?!\\d)");
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final int PAGE_SIZE = 500;
    private static final int MAX_PAGES = 12;

    private final HttpClient httpClient;

    /**
     * 创建中彩网抓取器。
     */
    public ZhcwKl8DrawFetcher() {
        this(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).build());
    }

    ZhcwKl8DrawFetcher(HttpClient httpClient) {
        this.httpClient = httpClient;
    }

    /**
     * 抓取近期开奖数据。
     *
     * @return 标准化后的开奖记录
     */
    @Override
    public List<LotteryKl8FetchedDraw> fetchRecentDraws() {
        List<LotteryKl8FetchedDraw> allDraws = new ArrayList<>();
        LinkedHashSet<String> seenIssueNos = new LinkedHashSet<>();
        for (int pageNum = 1; pageNum <= MAX_PAGES; pageNum += 1) {
            List<LotteryKl8FetchedDraw> pageDraws = fetchPage(pageNum);
            if (pageDraws.isEmpty()) {
                break;
            }
            int beforeSize = seenIssueNos.size();
            for (LotteryKl8FetchedDraw draw : pageDraws) {
                if (seenIssueNos.add(draw.issueNo())) {
                    allDraws.add(draw);
                }
            }
            // 中彩网尾页之后可能重复返回最后一页，用期号去重后的增量判断停止，避免继续空转请求。
            if (seenIssueNos.size() == beforeSize) {
                break;
            }
        }
        log.info("Fetched KL8 draw data: {} unique records", allDraws.size());
        return allDraws;
    }

    private List<LotteryKl8FetchedDraw> fetchPage(int pageNum) {
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(dataApiUrl(pageNum)))
                    .timeout(Duration.ofSeconds(10))
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36")
                    .header("Referer", PAGE_URL)
                    .header("Accept", "application/json,text/javascript,*/*;q=0.01")
                    .header("Accept-Language", "zh-CN,zh;q=0.9")
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("中彩网快乐8页面返回 HTTP " + response.statusCode());
            }
            return parseHtml(response.body());
        } catch (IOException e) {
            throw new IllegalStateException("快乐8开奖页面抓取失败", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("快乐8开奖页面抓取被中断", e);
        }
    }

    /**
     * 解析开奖 HTML，供测试直接覆盖页面结构变化。
     *
     * @param html 页面 HTML
     * @return 标准化后的开奖记录
     */
    public List<LotteryKl8FetchedDraw> parseHtml(String html) {
        if (html != null && html.contains("\"frontWinningNum\"")) {
            return parseJsonp(html);
        }
        String normalized = html == null ? "" : html
                .replaceAll("(?is)<script.*?</script>", " ")
                .replaceAll("(?is)<style.*?</style>", " ")
                .replaceAll("(?is)<tr", "\n<tr")
                .replaceAll("(?is)<[^>]+>", " ")
                .replace("&nbsp;", " ")
                .replaceAll("\\s+", " ");
        List<LotteryKl8FetchedDraw> draws = new ArrayList<>();
        for (String chunk : normalized.split("(?=20\\d{5,}|\\d{7,})")) {
            LotteryKl8FetchedDraw draw = parseChunk(chunk.trim());
            if (draw != null) {
                draws.add(draw);
            }
        }
        log.info("解析快乐8公开开奖数据 {} 条", draws.size());
        return draws;
    }

    private String dataApiUrl(int pageNum) {
        return SOURCE_URL
                + "?transactionType=10001001"
                + "&lotteryId=6"
                + "&issueCount=" + PAGE_SIZE * MAX_PAGES
                + "&type=0"
                + "&pageNum=" + pageNum
                + "&pageSize=" + PAGE_SIZE
                + "&callback=callback"
                + "&tt=" + System.currentTimeMillis();
    }

    private List<LotteryKl8FetchedDraw> parseJsonp(String jsonp) {
        String json = extractJson(jsonp);
        List<LotteryKl8FetchedDraw> draws = new ArrayList<>();
        try {
            JsonNode data = OBJECT_MAPPER.readTree(json).path("data");
            if (!data.isArray()) {
                return List.of();
            }
            for (JsonNode item : data) {
                LotteryKl8FetchedDraw draw = parseJsonDraw(item);
                if (draw != null) {
                    draws.add(draw);
                }
            }
            log.info("Parsed KL8 draw data: {} records", draws.size());
            return draws;
        } catch (Exception e) {
            throw new IllegalStateException("KL8 draw data parse failed", e);
        }
    }

    private String extractJson(String jsonp) {
        String text = jsonp == null ? "" : jsonp.trim();
        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');
        if (start < 0 || end <= start) {
            throw new IllegalStateException("KL8 draw data is not valid JSONP");
        }
        return text.substring(start, end + 1);
    }

    private LotteryKl8FetchedDraw parseJsonDraw(JsonNode item) {
        String issueNo = item.path("issue").asText("");
        String openTime = item.path("openTime").asText("");
        List<Integer> numbers = parseNumbers(item.path("frontWinningNum").asText(""));
        if (issueNo.isBlank() || openTime.isBlank() || numbers.size() != 20) {
            return null;
        }
        return new LotteryKl8FetchedDraw(issueNo, LocalDate.parse(openTime), List.copyOf(numbers), PAGE_URL, SOURCE_NAME);
    }

    private List<Integer> parseNumbers(String value) {
        LinkedHashSet<Integer> numbers = new LinkedHashSet<>();
        Matcher matcher = NUMBER_PATTERN.matcher(value == null ? "" : value);
        while (matcher.find() && numbers.size() < 20) {
            numbers.add(Integer.parseInt(matcher.group(1)));
        }
        return new ArrayList<>(numbers);
    }

    private LotteryKl8FetchedDraw parseChunk(String chunk) {
        Matcher issueMatcher = ISSUE_PATTERN.matcher(chunk);
        Matcher dateMatcher = DATE_PATTERN.matcher(chunk);
        if (!issueMatcher.find() || !dateMatcher.find()) {
            return null;
        }
        String issueNo = issueMatcher.group(1);
        LocalDate drawDate = LocalDate.of(
                Integer.parseInt(dateMatcher.group(1)),
                Integer.parseInt(dateMatcher.group(2)),
                Integer.parseInt(dateMatcher.group(3)));
        LinkedHashSet<Integer> numbers = new LinkedHashSet<>();
        Matcher numberMatcher = NUMBER_PATTERN.matcher(chunk.substring(dateMatcher.end()));
        while (numberMatcher.find() && numbers.size() < 20) {
            numbers.add(Integer.parseInt(numberMatcher.group(1)));
        }
        if (numbers.size() != 20) {
            return null;
        }
        return new LotteryKl8FetchedDraw(issueNo, drawDate, List.copyOf(numbers), SOURCE_URL, SOURCE_NAME);
    }
}
