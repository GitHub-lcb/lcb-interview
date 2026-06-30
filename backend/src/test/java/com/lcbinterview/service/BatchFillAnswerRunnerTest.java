package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.conditions.AbstractWrapper;
import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.lcbinterview.mapper.QuestionMapper;
import com.lcbinterview.model.Question;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.fail;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 后台批量补答案任务测试，验证任务锁、候选题范围和进度统计。
 */
class BatchFillAnswerRunnerTest {

    private final QuestionMapper questionMapper = mock(QuestionMapper.class);
    private final AiQuestionService aiQuestionService = mock(AiQuestionService.class);
    private final BatchFillAnswerRunner runner = new BatchFillAnswerRunner(questionMapper, aiQuestionService);

    @BeforeEach
    void setUp() {
        TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new MybatisConfiguration(), ""), Question.class);
    }

    @Test
    void startRejectsSecondTaskWhileCurrentTaskIsRunning() throws Exception {
        Question question = question(1L, 3L, "Java 中的 volatile 有什么作用？");
        CountDownLatch selectStarted = new CountDownLatch(1);
        CountDownLatch releaseSelect = new CountDownLatch(1);
        when(questionMapper.selectCount(any())).thenReturn(1L);
        when(questionMapper.selectList(any())).thenAnswer(invocation -> {
            selectStarted.countDown();
            releaseSelect.await(1, TimeUnit.SECONDS);
            return List.of(question);
        });
        when(aiQuestionService.fillAnswerSync(question)).thenReturn(success(question));

        assertThat(runner.start(null, null, 0)).isTrue();
        assertThat(selectStarted.await(1, TimeUnit.SECONDS)).isTrue();
        assertThat(runner.start(null, null, 0)).isFalse();

        releaseSelect.countDown();
        waitUntilFinished(runner);
        assertThat(runner.getProgress().status()).isEqualTo("COMPLETED");
    }

    @Test
    void batchFillAnswersProcessesCandidatesAndTracksSuccessAndFailure() throws Exception {
        Question first = question(1L, 3L, "HashMap 为什么线程不安全？");
        Question second = question(2L, 4L, "Redis 缓存击穿怎么处理？");
        when(questionMapper.selectCount(any())).thenReturn(2L);
        when(questionMapper.selectList(any())).thenReturn(List.of(first, second));
        when(aiQuestionService.fillAnswerSync(first)).thenReturn(success(first));
        when(aiQuestionService.fillAnswerSync(second)).thenReturn(failure(second, "质量分 40"));

        assertThat(runner.start(null, null, 0)).isTrue();
        waitUntilFinished(runner);

        var progress = runner.getProgress();
        assertThat(progress.status()).isEqualTo("COMPLETED");
        assertThat(progress.totalQuestions()).isEqualTo(2);
        assertThat(progress.generatedQuestions()).isEqualTo(1);
        assertThat(progress.failedCategories()).isEqualTo(1);
        assertThat(progress.errors()).contains("2: 质量分 40");
        verify(aiQuestionService).fillAnswerSync(first);
        verify(aiQuestionService).fillAnswerSync(second);
    }

    @Test
    @SuppressWarnings({"unchecked", "rawtypes"})
    void batchFillAnswersAppliesCategoryAndMaxQuestionLimit() throws Exception {
        Question question = question(8L, 5L, "MySQL 的 MVCC 是什么？");
        when(questionMapper.selectCount(any())).thenReturn(7L);
        when(questionMapper.selectList(any())).thenReturn(List.of(question));
        when(aiQuestionService.fillAnswerSync(question)).thenReturn(success(question));

        assertThat(runner.start(5L, 2, 0)).isTrue();
        waitUntilFinished(runner);

        ArgumentCaptor<Wrapper<Question>> wrapperCaptor = ArgumentCaptor.forClass((Class) Wrapper.class);
        verify(questionMapper).selectList(wrapperCaptor.capture());
        AbstractWrapper<?, ?, ?> wrapper = (AbstractWrapper<?, ?, ?>) wrapperCaptor.getValue();
        assertThat(wrapper.getCustomSqlSegment()).contains("LIMIT 2");
        assertThat(wrapper.getParamNameValuePairs()).containsValue(5L);
    }

    @Test
    void batchFillAnswersRunsQuestionsConcurrentlyWhenConcurrencyIsGreaterThanOne() throws Exception {
        Question first = question(1L, 3L, "HashMap 为什么线程不安全？");
        Question second = question(2L, 4L, "Redis 缓存击穿怎么处理？");
        CountDownLatch bothStarted = new CountDownLatch(2);
        CountDownLatch releaseRequests = new CountDownLatch(1);
        when(questionMapper.selectCount(any())).thenReturn(2L);
        when(questionMapper.selectList(any())).thenReturn(List.of(first, second));
        when(aiQuestionService.fillAnswerSync(any())).thenAnswer(invocation -> {
            Question question = invocation.getArgument(0);
            bothStarted.countDown();
            releaseRequests.await(1, TimeUnit.SECONDS);
            return success(question);
        });

        assertThat(runner.start(null, null, 0, 2)).isTrue();
        assertThat(bothStarted.await(1, TimeUnit.SECONDS)).isTrue();
        releaseRequests.countDown();
        waitUntilFinished(runner);

        var progress = runner.getProgress();
        assertThat(progress.status()).isEqualTo("COMPLETED");
        assertThat(progress.generatedQuestions()).isEqualTo(2);
    }

    private Question question(Long id, Long categoryId, String title) {
        Question question = new Question();
        question.setId(id);
        question.setCategoryId(categoryId);
        question.setTitle(title);
        question.setStatus("DRAFT");
        return question;
    }

    private AiQuestionService.FillAnswerResult success(Question question) {
        return new AiQuestionService.FillAnswerResult(true, question.getId(), 100, 120, null, List.of());
    }

    private AiQuestionService.FillAnswerResult failure(Question question, String error) {
        return new AiQuestionService.FillAnswerResult(false, question.getId(), 40, 80, error, List.of(error));
    }

    private void waitUntilFinished(BatchFillAnswerRunner runner) throws InterruptedException {
        for (int i = 0; i < 100; i++) {
            String status = runner.getProgress().status();
            if ("COMPLETED".equals(status) || "FAILED".equals(status)) {
                return;
            }
            Thread.sleep(20);
        }
        fail("批量补答案任务未在预期时间内结束");
    }
}
