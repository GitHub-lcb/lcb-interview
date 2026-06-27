package com.lcbinterview.dto.tools;

import com.lcbinterview.model.ReadingExcerpt;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

/**
 * 书摘展示对象。
 *
 * @param id         主键
 * @param bookTitle  书名
 * @param author     作者
 * @param content    摘录正文
 * @param note       个人评论
 * @param tags       标签
 * @param chapter    章节
 * @param pageNo     页码
 * @param createTime 创建时间
 * @param updateTime 更新时间
 */
public record ReadingExcerptVO(
        Long id,
        String bookTitle,
        String author,
        String content,
        String note,
        List<String> tags,
        String chapter,
        String pageNo,
        LocalDateTime createTime,
        LocalDateTime updateTime
) {

    /**
     * 从实体创建书摘展示对象。
     *
     * @param excerpt 书摘实体
     * @return 书摘展示对象
     */
    public static ReadingExcerptVO from(ReadingExcerpt excerpt) {
        return new ReadingExcerptVO(
                excerpt.getId(),
                excerpt.getBookTitle(),
                excerpt.getAuthor(),
                excerpt.getContent(),
                excerpt.getNote(),
                splitTags(excerpt.getTags()),
                excerpt.getChapter(),
                excerpt.getPageNo(),
                excerpt.getCreateTime(),
                excerpt.getUpdateTime());
    }

    private static List<String> splitTags(String tags) {
        if (tags == null || tags.isBlank()) {
            return List.of();
        }
        return Arrays.stream(tags.split(","))
                .map(String::trim)
                .filter(tag -> !tag.isBlank())
                .toList();
    }
}
