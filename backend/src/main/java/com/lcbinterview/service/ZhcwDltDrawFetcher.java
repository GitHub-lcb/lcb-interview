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
 * 中彩网大乐透开奖数据抓取器（与快乐8/双色球同一 JSONP 接口，lotteryId=281）。
 * 前区 5 个（1-35）+ 后区 2 个（1-12），字段 frontWinningNum / backWinningNum。
 */
@Slf4j
@Service
public class ZhcwDltDrawFetcher {

    private static final String PAGE_URL = "https://www.zhcw.com/kjxx/dlt/";
    private static final String SOURCE_URL = "https://jc.zhcw.com/port/client_json.php";
    private static final String SOURCE_NAME = "中彩网大乐透开奖信息";
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final int PAGE_SIZE = 500;
    private static final int MAX_PAGES = 6;

    private final HttpClient httpClient;

    /**
     * 创建中彩网大乐透抓取器。
     */
    public ZhcwDltDrawFetcher() {
        this(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).build());
    }

    ZhcwDltDrawFetcher(HttpClient httpClient) {
        this.httpClient = httpClient;
    }

    /**
     * 抓取近期大乐透开奖数据。
     *
     * @return 标准化后的开奖记录
     */
    public List<DltFetchedDraw> fetchRecentDraws() {
        List<DltFetchedDraw> allDraws = new ArrayList<>();
        LinkedHashSet<String> seenIssueNos = new LinkedHashSet<>();
        for (int pageNum = 1; pageNum <= MAX_PAGES; pageNum += 1) {
            List<DltFetchedDraw> pageDraws = fetchPage(pageNum);
            if (pageDraws.isEmpty()) {
                break;
            }
            int beforeSize = seenIssueNos.size();
            for (DltFetchedDraw draw : pageDraws) {
                if (seenIssueNos.add(draw.issueNo())) {
                    allDraws.add(draw);
                }
            }
            // 尾页之后接口可能重复返回最后一页，用期号去重增量判断停止，避免空转请求。
            if (seenIssueNos.size() == beforeSize) {
                break;
            }
        }
        log.info("Fetched DLT draw data: {} unique records", allDraws.size());
        return allDraws;
    }

    private List<DltFetchedDraw> fetchPage(int pageNum) {
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
                throw new IllegalStateException("中彩网大乐透页面返回 HTTP " + response.statusCode());
            }
            return parseJsonp(response.body());
        } catch (IOException e) {
            throw new IllegalStateException("大乐透开奖页面抓取失败", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("大乐透开奖页面抓取被中断", e);
        }
    }

    private String dataApiUrl(int pageNum) {
        return SOURCE_URL
                + "?transactionType=10001001"
                + "&lotteryId=281"
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
    public List<DltFetchedDraw> parseJsonp(String jsonp) {
        String json = extractJson(jsonp);
        List<DltFetchedDraw> draws = new ArrayList<>();
        try {
            JsonNode data = OBJECT_MAPPER.readTree(json).path("data");
            if (!data.isArray()) {
                return List.of();
            }
            for (JsonNode item : data) {
                DltFetchedDraw draw = parseDraw(item);
                if (draw != null) {
                    draws.add(draw);
                }
            }
            log.info("Parsed DLT draw data: {} records", draws.size());
            return draws;
        } catch (Exception e) {
            throw new IllegalStateException("DLT draw data parse failed", e);
        }
    }

    private String extractJson(String jsonp) {
        String text = jsonp == null ? "" : jsonp.trim();
        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');
        if (start < 0 || end <= start) {
            throw new IllegalStateException("DLT draw data is not valid JSONP");
        }
        return text.substring(start, end + 1);
    }

    private DltFetchedDraw parseDraw(JsonNode item) {
        String issueNo = item.path("issue").asText("");
        String openTime = item.path("openTime").asText("");
        List<Integer> frontNumbers = parseNumbers(item.path("frontWinningNum").asText(""), 5);
        List<Integer> backNumbers = parseNumbers(item.path("backWinningNum").asText(""), 2);
        if (issueNo.isBlank() || openTime.isBlank() || frontNumbers.size() != 5 || backNumbers.size() != 2) {
            return null;
        }
        return new DltFetchedDraw(issueNo, LocalDate.parse(openTime),
                List.copyOf(frontNumbers), List.copyOf(backNumbers), PAGE_URL, SOURCE_NAME);
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
     * 抓取到的单期大乐透开奖。
     *
     * @param issueNo      期号
     * @param drawDate     开奖日期
     * @param frontNumbers 5 个前区号码
     * @param backNumbers  2 个后区号码
     * @param sourceUrl    来源地址
     * @param sourceName   来源名称
     */
    public record DltFetchedDraw(String issueNo, LocalDate drawDate,
                                 List<Integer> frontNumbers, List<Integer> backNumbers,
                                 String sourceUrl, String sourceName) {
    }
}
