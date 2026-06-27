package com.lcbinterview.dto.tools;

/**
 * 书摘查询条件。
 *
 * @param keyword   关键词
 * @param tag       标签
 * @param bookTitle 书名
 * @param page      页码
 * @param size      每页条数
 */
public record ReadingExcerptQuery(
        String keyword,
        String tag,
        String bookTitle,
        Integer page,
        Integer size
) {
}
