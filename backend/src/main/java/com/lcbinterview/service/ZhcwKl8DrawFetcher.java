package com.lcbinterview.service;

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

    private static final String SOURCE_URL = "https://www.zhcw.com/kjxx/kl8/";
    private static final String SOURCE_NAME = "中彩网快乐8开奖信息";
    private static final Pattern DATE_PATTERN = Pattern.compile("(20\\d{2})[-年/.](\\d{1,2})[-月/.](\\d{1,2})");
    private static final Pattern ISSUE_PATTERN = Pattern.compile("(20\\d{5,}|\\d{7,})");
    private static final Pattern NUMBER_PATTERN = Pattern.compile("(?<!\\d)(0?[1-9]|[1-7]\\d|80)(?!\\d)");

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
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(SOURCE_URL))
                    .timeout(Duration.ofSeconds(10))
                    .header("User-Agent", "Mozilla/5.0 LCBInterviewBot/1.0")
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
