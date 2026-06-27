package com.lcbinterview.service;

import java.util.List;

/**
 * 快乐8公开开奖数据抓取器。
 */
public interface LotteryKl8DrawFetcher {

    /**
     * 抓取近期开奖数据。
     *
     * @return 标准化后的开奖记录
     */
    List<LotteryKl8FetchedDraw> fetchRecentDraws();
}
