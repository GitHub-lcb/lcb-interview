package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.lcbinterview.mapper.CategoryMapper;
import com.lcbinterview.mapper.QuestionMapper;
import com.lcbinterview.model.Category;
import com.lcbinterview.model.Question;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Anki 导出服务测试，覆盖 TSV 列结构、HTML 转义、空字段跳过和 limit 归一化。
 */
class AnkiExportServiceTest {

    private QuestionMapper questionMapper;
    private CategoryMapper categoryMapper;
    private AnkiExportService ankiExportService;

    @BeforeEach
    void setUp() {
        // LambdaQueryWrapper 依赖表元数据，纯单测环境下需要手动初始化
        TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new MybatisConfiguration(), ""), Question.class);
        questionMapper = mock(QuestionMapper.class);
        categoryMapper = mock(CategoryMapper.class);
        ankiExportService = new AnkiExportService(questionMapper, categoryMapper);
    }

    @Test
    void buildAnkiTsvAlwaysProducesThreeColumnsPerLine() {
        Question question = question(10L, 3L, "什么是\tHashMap\n扩容？");
        question.setSummary("一句话\t解释\n扩容");
        question.setContent("正文内容");
        when(questionMapper.selectList(any())).thenReturn(List.of(question));
        when(categoryMapper.selectBatchIds(anyList())).thenReturn(List.of(category(3L, "Java 基础")));

        String tsv = ankiExportService.buildAnkiTsv(3L, "MEDIUM", 10);

        // 字段内的制表符/换行必须被清洗，每行恰好两处制表符分隔出三列
        String[] lines = tsv.split("\n", -1);
        assertThat(lines).hasSize(2);
        assertThat(lines[0]).doesNotEndWith("\n");
        String[] columns = lines[0].split("\t", -1);
        assertThat(columns).hasSize(3);
        assertThat(columns[0]).doesNotContain("\n");
        assertThat(columns[1]).doesNotContain("\n");
        assertThat(columns[2]).doesNotContain("\n");
        // 末尾仅一个换行，行内无多余换行泄漏
        assertThat(tsv.chars().filter(ch -> ch == '\t').count()).isEqualTo(2);
    }

    @Test
    void buildAnkiTsvEscapesHtmlInAllFields() {
        Question question = question(11L, 3L, "什么是 <script>alert(1)</script> & 注入？");
        question.setContent("内容包含 <b>标签</b> 和 & 符号");
        when(questionMapper.selectList(any())).thenReturn(List.of(question));
        when(categoryMapper.selectBatchIds(anyList())).thenReturn(List.of(category(3L, "Java 基础")));

        String tsv = ankiExportService.buildAnkiTsv(null, null, 100);

        // < > & 全部转义，防止题目内容注入 HTML 破坏卡片结构
        assertThat(tsv).contains("&lt;script&gt;").contains("&amp;").doesNotContain("<script>");
        assertThat(tsv).contains("&lt;b&gt;");
    }

    @Test
    void buildAnkiTsvSkipsBlankAnswerSections() {
        Question question = question(12L, 3L, "只填速览的题目");
        question.setContent(null);
        question.setPrinciple("   ");
        question.setScenario(null);
        question.setRisk(null);
        when(questionMapper.selectList(any())).thenReturn(List.of(question));
        when(categoryMapper.selectBatchIds(anyList())).thenReturn(List.of(category(3L, "Java 基础")));

        String tsv = ankiExportService.buildAnkiTsv(null, null, 100);

        // 只有 summary 一个小节，空白字段不生成空标题
        assertThat(tsv).contains("<h3>30秒速览</h3>");
        assertThat(tsv).doesNotContain("标准回答").doesNotContain("原理深挖")
                .doesNotContain("适用场景").doesNotContain("风险与避坑");
    }

    @Test
    void buildAnkiTsvBuildsTagsAsCategoryDeckPath() {
        Question question = question(13L, 5L, "网络分层题目");
        // 标签列的难度取题目自身字段，而非导出时的难度筛选参数
        question.setDifficulty("EASY");
        when(questionMapper.selectList(any())).thenReturn(List.of(question));
        when(categoryMapper.selectBatchIds(anyList())).thenReturn(List.of(category(5L, "Computer Network 基础")));

        String tsv = ankiExportService.buildAnkiTsv(null, "EASY", 100);

        // 分类名空格替换为下划线，难度用 :: 拼接成 Anki 牌组路径
        String tags = tsv.split("\t", -1)[2].split("\n", -1)[0];
        assertThat(tags).isEqualTo("Computer_Network_基础::EASY");
    }

    @Test
    void buildAnkiTsvKeepsTagColumnWhenDifficultyMissing() {
        Question question = question(14L, 5L, "无难度题目");
        question.setDifficulty(null);
        when(questionMapper.selectList(any())).thenReturn(List.of(question));
        when(categoryMapper.selectBatchIds(anyList())).thenReturn(List.of(category(5L, "Java 基础")));

        String tsv = ankiExportService.buildAnkiTsv(null, null, 100);

        // 难度缺失时标签只保留分类名，不产生尾部 ::
        String tags = tsv.split("\t", -1)[2].split("\n", -1)[0];
        assertThat(tags).isEqualTo("Java_基础");
    }

    @Test
    void buildAnkiTsvConvertsMarkdownSyntaxToReadableHtml() {
        Question question = question(15L, 3L, "Markdown 转换题目");
        question.setSummary("正常段落 **加粗**");
        question.setContent("# 一级标题\n- 列表项一\n- 列表项二\n```\nint x = 1 < 2;\n```");
        when(questionMapper.selectList(any())).thenReturn(List.of(question));
        when(categoryMapper.selectBatchIds(anyList())).thenReturn(List.of(category(3L, "Java 基础")));

        String tsv = ankiExportService.buildAnkiTsv(null, null, 100);

        assertThat(tsv).contains("<p>正常段落 <strong>加粗</strong></p>");
        assertThat(tsv).contains("<h4>一级标题</h4>");
        assertThat(tsv).contains("<ul><li>列表项一</li><li>列表项二</li></ul>");
        assertThat(tsv).contains("<pre>int x = 1 &lt; 2;<br></pre>");
    }

    @Test
    void buildAnkiTsvNormalizesLimitIntoSafeRange() {
        when(questionMapper.selectList(any())).thenReturn(List.of());

        ankiExportService.buildAnkiTsv(null, null, 0);
        ankiExportService.buildAnkiTsv(null, null, -5);
        ankiExportService.buildAnkiTsv(null, null, 10000);

        // 非法值回退默认 100，超上限收敛到 500，通过 wrapper 的 last SQL 片段断言
        ArgumentCaptor<Wrapper<Question>> wrapperCaptor = ArgumentCaptor.forClass(Wrapper.class);
        verify(questionMapper, org.mockito.Mockito.times(3)).selectList(wrapperCaptor.capture());
        List<String> lastSegments = wrapperCaptor.getAllValues().stream()
                .map(Wrapper::getCustomSqlSegment)
                .toList();
        assertThat(lastSegments.get(0)).contains("LIMIT 100");
        assertThat(lastSegments.get(1)).contains("LIMIT 100");
        assertThat(lastSegments.get(2)).contains("LIMIT 500");
    }

    @Test
    void buildAnkiTsvReturnsEmptyWhenNoQuestions() {
        when(questionMapper.selectList(any())).thenReturn(List.of());

        assertThat(ankiExportService.buildAnkiTsv(null, null, 100)).isEmpty();
    }

    private Question question(Long id, Long categoryId, String title) {
        Question question = new Question();
        question.setId(id);
        question.setCategoryId(categoryId);
        question.setTitle(title);
        question.setSummary("速览内容");
        question.setContent("标准回答内容");
        question.setDifficulty("MEDIUM");
        question.setViewCount(10);
        question.setStatus("PUBLISHED");
        return question;
    }

    private Category category(Long id, String name) {
        Category category = new Category();
        category.setId(id);
        category.setName(name);
        return category;
    }
}
