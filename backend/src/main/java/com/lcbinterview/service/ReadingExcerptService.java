package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.lcbinterview.common.BusinessException;
import com.lcbinterview.dto.PageResult;
import com.lcbinterview.dto.tools.MarkdownExportVO;
import com.lcbinterview.dto.tools.ReadingExcerptCreateRequest;
import com.lcbinterview.dto.tools.ReadingExcerptQuery;
import com.lcbinterview.dto.tools.ReadingExcerptUpdateRequest;
import com.lcbinterview.dto.tools.ReadingExcerptVO;
import com.lcbinterview.mapper.ReadingExcerptMapper;
import com.lcbinterview.model.ReadingExcerpt;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 书摘库服务，处理个人书摘的保存、搜索和 Markdown 导出。
 */
@Service
@RequiredArgsConstructor
public class ReadingExcerptService {

    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 100;

    private final ReadingExcerptMapper readingExcerptMapper;

    /**
     * 分页查询当前用户的书摘。
     *
     * @param userId 用户 ID
     * @param query  查询条件
     * @return 分页书摘
     */
    @Transactional(readOnly = true)
    public PageResult<ReadingExcerptVO> list(Long userId, ReadingExcerptQuery query) {
        Page<ReadingExcerpt> page = new Page<>(normalizePage(query.page()) + 1L, normalizeSize(query.size()));
        IPage<ReadingExcerpt> result = readingExcerptMapper.selectPage(page, buildQuery(userId, query));
        List<ReadingExcerptVO> content = result.getRecords().stream()
                .map(ReadingExcerptVO::from)
                .toList();
        return PageResult.of(result, content);
    }

    /**
     * 新增当前用户的书摘。
     *
     * @param userId  用户 ID
     * @param request 新增请求
     * @return 新增后的书摘
     */
    @Transactional
    public ReadingExcerptVO create(Long userId, ReadingExcerptCreateRequest request) {
        ReadingExcerpt excerpt = new ReadingExcerpt();
        excerpt.setUserId(userId);
        fill(excerpt, request.bookTitle(), request.author(), request.content(), request.note(),
                request.tags(), request.chapter(), request.pageNo());
        readingExcerptMapper.insert(excerpt);
        return ReadingExcerptVO.from(excerpt);
    }

    /**
     * 更新当前用户的书摘。
     *
     * @param userId  用户 ID
     * @param id      书摘 ID
     * @param request 更新请求
     * @return 更新后的书摘
     */
    @Transactional
    public ReadingExcerptVO update(Long userId, Long id, ReadingExcerptUpdateRequest request) {
        ReadingExcerpt excerpt = requireOwned(userId, id);
        fill(excerpt, request.bookTitle(), request.author(), request.content(), request.note(),
                request.tags(), request.chapter(), request.pageNo());
        readingExcerptMapper.updateById(excerpt);
        return ReadingExcerptVO.from(excerpt);
    }

    /**
     * 逻辑删除当前用户的书摘。
     *
     * @param userId 用户 ID
     * @param id     书摘 ID
     */
    @Transactional
    public void delete(Long userId, Long id) {
        requireOwned(userId, id);
        readingExcerptMapper.deleteById(id);
    }

    /**
     * 导出当前筛选结果为 Markdown。
     *
     * @param userId 用户 ID
     * @param query  查询条件
     * @return Markdown 导出结果
     */
    @Transactional(readOnly = true)
    public MarkdownExportVO exportMarkdown(Long userId, ReadingExcerptQuery query) {
        List<ReadingExcerpt> excerpts = readingExcerptMapper.selectList(buildQuery(userId, query));
        String markdown = buildMarkdown(excerpts);
        return new MarkdownExportVO("读书摘录-" + LocalDate.now() + ".md", markdown);
    }

    private ReadingExcerpt requireOwned(Long userId, Long id) {
        ReadingExcerpt excerpt = readingExcerptMapper.selectById(id);
        if (excerpt == null || !userId.equals(excerpt.getUserId())) {
            throw new BusinessException(404, "书摘不存在");
        }
        return excerpt;
    }

    private LambdaQueryWrapper<ReadingExcerpt> buildQuery(Long userId, ReadingExcerptQuery query) {
        String keyword = trim(query.keyword());
        String tag = trim(query.tag());
        String bookTitle = trim(query.bookTitle());
        LambdaQueryWrapper<ReadingExcerpt> wrapper = Wrappers.<ReadingExcerpt>lambdaQuery()
                .eq(ReadingExcerpt::getUserId, userId)
                .orderByDesc(ReadingExcerpt::getUpdateTime)
                .orderByDesc(ReadingExcerpt::getCreateTime);
        if (StringUtils.hasText(bookTitle)) {
            wrapper.like(ReadingExcerpt::getBookTitle, bookTitle);
        }
        if (StringUtils.hasText(tag)) {
            wrapper.like(ReadingExcerpt::getTags, tag);
        }
        if (StringUtils.hasText(keyword)) {
            wrapper.and(w -> w.like(ReadingExcerpt::getBookTitle, keyword)
                    .or().like(ReadingExcerpt::getAuthor, keyword)
                    .or().like(ReadingExcerpt::getContent, keyword)
                    .or().like(ReadingExcerpt::getNote, keyword));
        }
        return wrapper;
    }

    private void fill(
            ReadingExcerpt excerpt,
            String bookTitle,
            String author,
            String content,
            String note,
            List<String> tags,
            String chapter,
            String pageNo) {
        excerpt.setBookTitle(trimRequired(bookTitle, "书名不能为空"));
        excerpt.setAuthor(trim(author));
        excerpt.setContent(trimRequired(content, "摘录不能为空"));
        excerpt.setNote(trim(note));
        excerpt.setTags(normalizeTags(tags));
        excerpt.setChapter(trim(chapter));
        excerpt.setPageNo(trim(pageNo));
    }

    private String buildMarkdown(List<ReadingExcerpt> excerpts) {
        if (excerpts.isEmpty()) {
            return "# 读书摘录\n\n暂无符合条件的书摘。\n";
        }
        Map<String, List<ReadingExcerpt>> grouped = new LinkedHashMap<>();
        for (ReadingExcerpt excerpt : excerpts) {
            grouped.computeIfAbsent(excerpt.getBookTitle(), key -> new java.util.ArrayList<>()).add(excerpt);
        }
        StringBuilder markdown = new StringBuilder("# 读书摘录\n\n");
        grouped.forEach((bookTitle, items) -> {
            markdown.append("## ").append(escapeMarkdown(bookTitle)).append("\n\n");
            for (ReadingExcerpt item : items) {
                appendExcerpt(markdown, item);
            }
        });
        return markdown.toString();
    }

    private void appendExcerpt(StringBuilder markdown, ReadingExcerpt item) {
        if (StringUtils.hasText(item.getAuthor())) {
            markdown.append("- 作者：").append(item.getAuthor()).append("\n");
        }
        if (StringUtils.hasText(item.getChapter())) {
            markdown.append("- 章节：").append(item.getChapter()).append("\n");
        }
        if (StringUtils.hasText(item.getPageNo())) {
            markdown.append("- 页码：").append(item.getPageNo()).append("\n");
        }
        if (StringUtils.hasText(item.getTags())) {
            markdown.append("- 标签：").append(item.getTags()).append("\n");
        }
        markdown.append("\n> ").append(item.getContent().replace("\n", "\n> ")).append("\n\n");
        if (StringUtils.hasText(item.getNote())) {
            markdown.append("个人评论：").append(item.getNote()).append("\n\n");
        }
    }

    private String normalizeTags(List<String> tags) {
        if (tags == null || tags.isEmpty()) {
            return "";
        }
        return tags.stream()
                .map(this::trim)
                .filter(StringUtils::hasText)
                .distinct()
                .limit(20)
                .reduce((left, right) -> left + "," + right)
                .orElse("");
    }

    private int normalizePage(Integer page) {
        return Math.max(0, page == null ? 0 : page);
    }

    private int normalizeSize(Integer size) {
        int value = size == null ? DEFAULT_PAGE_SIZE : size;
        return Math.min(MAX_PAGE_SIZE, Math.max(1, value));
    }

    private String trimRequired(String value, String message) {
        String trimmed = trim(value);
        if (!StringUtils.hasText(trimmed)) {
            throw new BusinessException(400, message);
        }
        return trimmed;
    }

    private String trim(String value) {
        return value == null ? "" : value.trim();
    }

    private String escapeMarkdown(String value) {
        return value.replace("#", "\\#");
    }
}
