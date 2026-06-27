package com.lcbinterview.dto.tools;

/**
 * Markdown 导出响应。
 *
 * @param fileName 导出文件名
 * @param markdown Markdown 内容
 */
public record MarkdownExportVO(String fileName, String markdown) {
}
