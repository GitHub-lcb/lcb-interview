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

/**
 * 中彩网双色球开奖数据抓取器（与快乐8 同一 JSONP 接口，lotteryId=1）。
 * 红球 6 个 + 蓝球 1 个，字段 frontWinningNum / backWinningNum。
 */
@Slf4j
@Service
public class ZhcwSsqDrawFetcher {

    private static final String PAGE_URL = "https://www.zhcw.com/kjxx/ssq/";
    private static final String SOURCE_URL = "https://jc.zhcw.com/port/client_json.php";
    private static final String SOURCE_NAME = "中彩网双色球开奖信息";
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final int PAGE_SIZE = 500;
    private static final int MAX_PAGES = 6;

    private final HttpClient httpClient;

    /**
     * 创建中彩网双色球抓取器。
     */
    public ZhcwSsqDrawFetcher() {
        this(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).build());
    }

    ZhcwSsqDrawFetcher(HttpClient httpClient) {
        this.httpClient = httpClient;
    }

    /**
     * 抓取近期双色球开奖数据。
     *
     * @return 标准化后的开奖记录
     */
    public List<SsqFetchedDraw> fetchRecentDraws() {
        List<SsqFetchedDraw> allDraws = new ArrayList<>();
        LinkedHashSet<String> seenIssueNos = new LinkedHashSet<>();
        for (int pageNum = 1; pageNum <= MAX_PAGES; pageNum += 1) {
            List<SsqFetchedDraw> pageDraws = fetchPage(pageNum);
            if (pageDraws.isEmpty()) {
                break;
            }
            int beforeSize = seenIssueNos.size();
            for (SsqFetchedDraw draw : pageDraws) {
                if (seenIssueNos.add(draw.issueNo())) {
                    allDraws.add(draw);
                }
            }
            // 尾页之后接口可能重复返回最后一页，用期号去重增量判断停止，避免空转请求。
            if (seenIssueNos.size() == beforeSize) {
                break;
            }
        }
        log.info("Fetched SSQ draw data: {} unique records", allDraws.size());
        return allDraws;
    }

    private List<SsqFetchedDraw> fetchPage(int pageNum) {
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
                throw new IllegalStateException("中彩网双色球页面返回 HTTP " + response.statusCode());
            }
            return parseJsonp(response.body());
        } catch (IOException e) {
            throw new IllegalStateException("双色球开奖页面抓取失败", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("双色球开奖页面抓取被中断", e);
        }
    }

    private String dataApiUrl(int pageNum) {
        return SOURCE_URL
                + "?transactionType=10001001"
                + "&lotteryId=1"
                + "&issueCount=" + PAGE_SIZE * MAX_PAGES
                + "&type=0"
                + "&pageNum=" + pageNum
                + "&pageSize=" + PAGE_SIZE
                + "&callback=callback"
                + "&tt=" + System.currentTimeMillis();
    }

    /**
     * 解析 JSONP 开奖数据，供测试直接覆盖接口结构变化。
     *
     * @param jsonp JSONP 响应
     * @return 标准化后的开奖记录
     */
    public List<SsqFetchedDraw> parseJsonp(String jsonp) {
        String json = extractJson(jsonp);
        List<SsqFetchedDraw> draws = new ArrayList<>();
        try {
            JsonNode data = OBJECT_MAPPER.readTree(json).path("data");
            if (!data.isArray()) {
                return List.of();
            }
            for (JsonNode item : data) {
                SsqFetchedDraw draw = parseDraw(item);
                if (draw != null) {
                    draws.add(draw);
                }
            }
            log.info("Parsed SSQ draw data: {} records", draws.size());
            return draws;
        } catch (Exception e) {
            throw new IllegalStateException("SSQ draw data parse failed", e);
        }
    }

    private String extractJson(String jsonp) {
        String text = jsonp == null ? "" : jsonp.trim();
        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');
        if (start < 0 || end <= start) {
            throw new IllegalStateException("SSQ draw data is not valid JSONP");
        }
        return text.substring(start, end + 1);
    }

    private SsqFetchedDraw parseDraw(JsonNode item) {
        String issueNo = item.path("issue").asText("");
        String openTime = item.path("openTime").asText("");
        List<Integer> redNumbers = parseNumbers(item.path("frontWinningNum").asText(""), 6);
        List<Integer> blueNumbers = parseNumbers(item.path("backWinningNum").asText(""), 1);
        if (issueNo.isBlank() || openTime.isBlank() || redNumbers.size() != 6 || blueNumbers.size() != 1) {
            return null;
        }
        return new SsqFetchedDraw(issueNo, LocalDate.parse(openTime),
                List.copyOf(redNumbers), blueNumbers.getFirst(), PAGE_URL, SOURCE_NAME);
    }

    private List<Integer> parseNumbers(String value, int expected) {
        LinkedHashSet<Integer> numbers = new LinkedHashSet<>();
        if (value != null) {
            for (String part : value.split("[\\s,，]+")) {
                try {
                    numbers.add(Integer.parseInt(part.trim()));
                } catch (NumberFormatException ignored) {
                    // 跳过非数字片段，依赖数量校验兜底
                }
            }
        }
        return new ArrayList<>(numbers);
    }

    /**
     * 抓取到的单期双色球开奖。
     *
     * @param issueNo   期号
     * @param drawDate  开奖日期
     * @param redNumbers 6 个红球
     * @param blueNumber 1 个蓝球
     * @param sourceUrl 来源地址
     * @param sourceName 来源名称
     */
    public record SsqFetchedDraw(String issueNo, LocalDate drawDate,
                                 List<Integer> redNumbers, Integer blueNumber,
                                 String sourceUrl, String sourceName) {
    }
}
