package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.lcbinterview.mapper.CategoryMapper;
import com.lcbinterview.mapper.QuestionMapper;
import com.lcbinterview.model.Category;
import com.lcbinterview.model.Question;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Anki 导出服务。把已发布题目转换为 Anki 可直接导入的 TSV 文本，
 * 每行一条笔记，三列：正面（标题）、背面（HTML 答案）、标签（分类::难度）。
 * Markdown 仅做轻量转换（代码围栏/标题/加粗/列表/段落），保证可读即可。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AnkiExportService {

    /** 默认导出条数 */
    private static final int DEFAULT_LIMIT = 100;

    /** 单次导出上限，防止一次性拉全量题库拖垮内存和响应时间 */
    private static final int MAX_LIMIT = 500;

    /** Markdown 加粗语法 **text**，先转义 HTML 再替换，避免注入 */
    private static final Pattern BOLD_PATTERN = Pattern.compile("\\*\\*(.+?)\\*\\*");

    /** 标题行语法 #/##/###，映射为 h4/h5/h6，避免与背面分节 h3 冲突 */
    private static final Pattern HEADING_PATTERN = Pattern.compile("^(#{1,3})\\s+(.+)$");

    private final QuestionMapper questionMapper;
    private final CategoryMapper categoryMapper;

    /**
     * 生成 Anki 可导入的 TSV 文本。
     *
     * @param categoryId 分类 ID，可选；为空时导出全部分类
     * @param difficulty 难度（EASY/MEDIUM/HARD），可选
     * @param limit      导出条数，归一化到 1~500，非法值回退默认 100
     * @return TSV 文本，每行三列：正面、背面 HTML、标签；无符合条件的题目时返回空字符串
     */
    public String buildAnkiTsv(Long categoryId, String difficulty, int limit) {
        int normalizedLimit = normalizeLimit(limit);
        LambdaQueryWrapper<Question> wrapper = Wrappers.<Question>lambdaQuery()
                .eq(Question::getStatus, "PUBLISHED")
                // 热门优先，导出的通常是用户最需要先背的题目
                .orderByDesc(Question::getViewCount)
                .orderByDesc(Question::getId)
                // 用 last LIMIT 而非分页插件：导出是单批读取，无需 count 统计
                .last("LIMIT " + normalizedLimit);
        if (categoryId != null) {
            wrapper.eq(Question::getCategoryId, categoryId);
        }
        if (StringUtils.hasText(difficulty)) {
            wrapper.eq(Question::getDifficulty, difficulty.trim());
        }
        List<Question> questions = questionMapper.selectList(wrapper);
        if (questions.isEmpty()) {
            return "";
        }
        // 批量查分类名映射，避免逐题 selectById 造成 N+1
        Map<Long, String> categoryNames = loadCategoryNames(questions);

        StringBuilder tsv = new StringBuilder();
        for (Question question : questions) {
            // 正面同样按 HTML 转义：Anki 导入允许 HTML 时，字段都会被渲染，避免标题注入标签
            String front = escapeHtml(sanitizePlain(question.getTitle()));
            String back = buildBackHtml(question);
            String tags = buildTags(categoryNames.get(question.getCategoryId()), question.getDifficulty());
            // 三个字段内部保证无制表符/换行，列结构才不会被 Anki 解析错位
            tsv.append(front).append('\t')
                    .append(back.replace('\t', ' ').replace("\r", "").replace("\n", "<br>"))
                    .append('\t')
                    .append(tags)
                    .append('\n');
        }
        log.info("Anki 导出完成，条件 category={}, difficulty={}，导出 {} 条", categoryId, difficulty, questions.size());
        return tsv.toString();
    }

    /**
     * 归一化导出条数：非法值（<=0）回退默认 100，再收敛到 1~500。
     *
     * @param limit 原始条数
     * @return 归一化后的条数
     */
    private int normalizeLimit(int limit) {
        int value = limit <= 0 ? DEFAULT_LIMIT : limit;
        return Math.min(MAX_LIMIT, Math.max(1, value));
    }

    /**
     * 批量加载题目涉及的分类名，避免逐题查询分类表。
     *
     * @param questions 待导出题目
     * @return categoryId → categoryName 映射，分类缺失时不收录（导出时回退“未分类”）
     */
    private Map<Long, String> loadCategoryNames(List<Question> questions) {
        List<Long> categoryIds = questions.stream()
                .map(Question::getCategoryId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (categoryIds.isEmpty()) {
            return Map.of();
        }
        return categoryMapper.selectBatchIds(categoryIds).stream()
                .collect(Collectors.toMap(Category::getId, Category::getName, (left, right) -> left));
    }

    /**
     * 组装背面 HTML：每个非空答案字段生成一个小节（h3 标题 + 转换后的 HTML）。
     *
     * @param question 题目实体
     * @return 背面 HTML 字符串
     */
    private String buildBackHtml(Question question) {
        StringBuilder html = new StringBuilder();
        appendSection(html, "30秒速览", question.getSummary());
        appendSection(html, "标准回答", question.getContent());
        appendSection(html, "原理深挖", question.getPrinciple());
        appendSection(html, "适用场景", question.getScenario());
        appendSection(html, "风险与避坑", question.getRisk());
        return html.toString();
    }

    /**
     * 追加一个小节，字段为空白时跳过，避免出现空标题。
     *
     * @param html   输出缓冲
     * @param title  小节标题
     * @param markdown 字段原始 Markdown 内容
     */
    private void appendSection(StringBuilder html, String title, String markdown) {
        if (!StringUtils.hasText(markdown)) {
            return;
        }
        html.append("<h3>").append(escapeHtml(title)).append("</h3>").append(toHtml(markdown));
    }

    /**
     * 构建标签列：分类名::难度（Anki 牌组路径用 :: 连接），空格替换为下划线。
     * 难度缺失时只保留分类名。
     *
     * @param categoryName 分类名，可为 null
     * @param difficulty   难度，可为空
     * @return 标签字符串
     */
    private String buildTags(String categoryName, String difficulty) {
        // 分类可能被逻辑删除或数据缺失，回退固定名保证牌组路径稳定
        String deck = StringUtils.hasText(categoryName) ? categoryName : "未分类";
        String tags = deck.replace(' ', '_');
        if (StringUtils.hasText(difficulty)) {
            tags = tags + "::" + difficulty.trim().replace(' ', '_');
        }
        return sanitizePlain(tags);
    }

    /**
     * 清洗正面/标签等纯文本字段：制表符和换行一律替换成空格，
     * 防止破坏 TSV 列结构和 Anki 行解析。
     *
     * @param value 原始文本
     * @return 清洗后的单行文本
     */
    private String sanitizePlain(String value) {
        if (value == null) {
            return "";
        }
        return value.replace('\t', ' ').replace('\r', ' ').replace('\n', ' ').trim();
    }

    /**
     * 轻量 Markdown 转 HTML：处理代码围栏、#/##/### 标题、**加粗**、
     * “- ” 列表和普通段落。不追求完整 Markdown 语义，保证文本可读且 HTML 已转义。
     *
     * @param markdown 原始 Markdown 文本
     * @return HTML 片段（不含换行符，换行已转为 p/br/ul 结构）
     */
    private String toHtml(String markdown) {
        StringBuilder html = new StringBuilder();
        // 统一换行符，Windows \r\n 与孤立 \r 都按 \n 处理
        String[] lines = markdown.replace("\r\n", "\n").replace('\r', '\n').split("\n", -1);
        boolean inCodeBlock = false;
        List<String> listItems = new java.util.ArrayList<>();
        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.startsWith("```")) {
                flushList(html, listItems);
                // 代码围栏开关：进入/退出 <pre>，围栏标记本身不输出
                html.append(inCodeBlock ? "</pre>" : "<pre>");
                inCodeBlock = !inCodeBlock;
            } else if (inCodeBlock) {
                // 代码行保持原文（仅转义），用 <br> 换行，避免裸换行破坏 TSV 列
                html.append(escapeHtml(line)).append("<br>");
            } else if (trimmed.isEmpty()) {
                flushList(html, listItems);
            } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
                listItems.add(inlineHtml(trimmed.substring(2)));
            } else {
                Matcher heading = HEADING_PATTERN.matcher(trimmed);
                if (heading.matches()) {
                    flushList(html, listItems);
                    int level = heading.group(1).length() + 3;
                    html.append("<h").append(level).append('>')
                            .append(inlineHtml(heading.group(2)))
                            .append("</h").append(level).append('>');
                } else {
                    flushList(html, listItems);
                    html.append("<p>").append(inlineHtml(trimmed)).append("</p>");
                }
            }
        }
        // 容错：源文本围栏未闭合时也要关闭 <pre>，避免 HTML 残缺
        if (inCodeBlock) {
            html.append("</pre>");
        }
        flushList(html, listItems);
        return html.toString();
    }

    /**
     * 把暂存的列表项输出为 ul/li 结构。
     *
     * @param html      输出缓冲
     * @param listItems 暂存的列表项，输出后清空
     */
    private void flushList(StringBuilder html, List<String> listItems) {
        if (listItems.isEmpty()) {
            return;
        }
        html.append("<ul>");
        for (String item : listItems) {
            html.append("<li>").append(item).append("</li>");
        }
        html.append("</ul>");
        listItems.clear();
    }

    /**
     * 行内元素转换：先做 HTML 转义，再识别 **加粗**，保证输出安全。
     *
     * @param text 已 trim 的行内文本
     * @return 转换后的 HTML 片段
     */
    private String inlineHtml(String text) {
        String escaped = escapeHtml(text);
        Matcher bold = BOLD_PATTERN.matcher(escaped);
        return bold.replaceAll("<strong>$1</strong>");
    }

    /**
     * HTML 转义：&、<、> 必须转义，防止题目内容注入破坏卡片结构。
     *
     * @param text 原始文本
     * @return 转义后文本
     */
    private String escapeHtml(String text) {
        if (text == null) {
            return "";
        }
        return text.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;");
    }

}
