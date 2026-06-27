package com.lcbinterview.dto.tools;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * 更新书摘请求。
 *
 * @param bookTitle 书名
 * @param author    作者
 * @param content   摘录正文
 * @param note      个人评论
 * @param tags      标签
 * @param chapter   章节
 * @param pageNo    页码
 */
public record ReadingExcerptUpdateRequest(
        @NotBlank(message = "书名不能为空")
        @Size(max = 160, message = "书名不能超过 160 位")
        String bookTitle,
        @Size(max = 120, message = "作者不能超过 120 位")
        String author,
        @NotBlank(message = "摘录不能为空")
        String content,
        String note,
        List<String> tags,
        @Size(max = 120, message = "章节不能超过 120 位")
        String chapter,
        @Size(max = 40, message = "页码不能超过 40 位")
        String pageNo
) {
}
