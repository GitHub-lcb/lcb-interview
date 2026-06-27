package com.lcbinterview.service;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

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
}
