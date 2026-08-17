package com.lcbinterview.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ZhcwDltDrawFetcherTest {

    private final ZhcwDltDrawFetcher fetcher = new ZhcwDltDrawFetcher();

    @Test
    void parsesJsonpDrawData() {
        String jsonp = """
                callback({"data":[
                  {"issue":"26092","openTime":"2026-08-15",
                   "frontWinningNum":"12 16 19 29 33","backWinningNum":"07 09","week":"星期六"},
                  {"issue":"26091","openTime":"2026-08-12",
                   "frontWinningNum":"02 08 11 19 27","backWinningNum":"03 05","week":"星期三"}
                ]})
                """;

        List<ZhcwDltDrawFetcher.DltFetchedDraw> draws = fetcher.parseJsonp(jsonp);

        assertEquals(2, draws.size());
        ZhcwDltDrawFetcher.DltFetchedDraw first = draws.getFirst();
        assertEquals("26092", first.issueNo());
        assertEquals("2026-08-15", first.drawDate().toString());
        assertEquals(List.of(12, 16, 19, 29, 33), first.frontNumbers());
        assertEquals(List.of(7, 9), first.backNumbers());
    }

    @Test
    void rejectsMalformedDraws() {
        String jsonp = """
                callback({"data":[
                  {"issue":"26092","openTime":"2026-08-15",
                   "frontWinningNum":"12 16 19 29","backWinningNum":"07 09"},
                  {"issue":"26093","openTime":"2026-08-17",
                   "frontWinningNum":"01 02 03 04 05","backWinningNum":"06 12"}
                ]})
                """;

        List<ZhcwDltDrawFetcher.DltFetchedDraw> draws = fetcher.parseJsonp(jsonp);

        // 第一条前区只有 4 个应被拒绝，第二条合法
        assertEquals(1, draws.size());
        assertEquals("26093", draws.getFirst().issueNo());
    }

    @Test
    void handlesEmptyData() {
        List<ZhcwDltDrawFetcher.DltFetchedDraw> draws = fetcher.parseJsonp("callback({\"data\":[]})");
        assertTrue(draws.isEmpty());
    }
}
