package com.lcbinterview.dto;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 题目查询参数测试，确保公开搜索接口能容忍常见的客户端输入噪音。
 */
class QuestionQueryTest {

    @Test
    void normalizesTextFiltersAndDefaultsPagination() {
        QuestionQuery query = new QuestionQuery(
                null,
                "  MEDIUM  ",
                "  Java  ",
                null,
                "  hot  ",
                null,
                null
        );

        assertThat(query.difficulty()).isEqualTo("MEDIUM");
        assertThat(query.keyword()).isEqualTo("Java");
        assertThat(query.sort()).isEqualTo("hot");
        assertThat(query.page()).isEqualTo(0);
        assertThat(query.size()).isEqualTo(20);
    }

    @Test
    void convertsBlankTextFiltersToAbsentValues() {
        QuestionQuery query = new QuestionQuery(null, "  ", "\t", null, "", 1, 10);

        assertThat(query.difficulty()).isNull();
        assertThat(query.keyword()).isNull();
        assertThat(query.sort()).isNull();
        assertThat(query.page()).isEqualTo(1);
        assertThat(query.size()).isEqualTo(10);
    }
}
