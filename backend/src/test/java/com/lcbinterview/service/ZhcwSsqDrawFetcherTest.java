package com.lcbinterview.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ZhcwSsqDrawFetcherTest {

    private final ZhcwSsqDrawFetcher fetcher = new ZhcwSsqDrawFetcher();

    @Test
    void parsesJsonpDrawData() {
        String jsonp = """
                callback({"data":[
                  {"issue":"2026094","openTime":"2026-08-16",
                   "frontWinningNum":"06 13 15 17 24 25","backWinningNum":"01","week":"星期日"},
                  {"issue":"2026093","openTime":"2026-08-13",
                   "frontWinningNum":"02 08 11 19 27 30","backWinningNum":"05","week":"星期四"}
                ]})
                """;

        List<ZhcwSsqDrawFetcher.SsqFetchedDraw> draws = fetcher.parseJsonp(jsonp);

        assertEquals(2, draws.size());
        ZhcwSsqDrawFetcher.SsqFetchedDraw first = draws.getFirst();
        assertEquals("2026094", first.issueNo());
        assertEquals("2026-08-16", first.drawDate().toString());
        assertEquals(List.of(6, 13, 15, 17, 24, 25), first.redNumbers());
        assertEquals(1, first.blueNumber());
    }

    @Test
    void rejectsMalformedDraws() {
        String jsonp = """
                callback({"data":[
                  {"issue":"2026094","openTime":"2026-08-16",
                   "frontWinningNum":"06 13 15 17 24","backWinningNum":"01"},
                  {"issue":"2026095","openTime":"2026-08-18",
                   "frontWinningNum":"01 02 03 04 05 06","backWinningNum":"16"}
                ]})
                """;

        List<ZhcwSsqDrawFetcher.SsqFetchedDraw> draws = fetcher.parseJsonp(jsonp);

        // 第一条红球只有 5 个应被拒绝，第二条合法
        assertEquals(1, draws.size());
        assertEquals("2026095", draws.getFirst().issueNo());
    }

    @Test
    void handlesEmptyData() {
        List<ZhcwSsqDrawFetcher.SsqFetchedDraw> draws = fetcher.parseJsonp("callback({\"data\":[]})");
        assertTrue(draws.isEmpty());
    }
}
