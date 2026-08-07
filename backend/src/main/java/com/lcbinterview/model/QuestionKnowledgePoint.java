package com.lcbinterview.model;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

/**
 * 题目-考点关联实体，一道题可命中多个考点。
 */
@Data
@TableName("question_knowledge_point")
public class QuestionKnowledgePoint {

    /** 题目 ID */
    private Long questionId;

    /** 考点 ID */
    private Long knowledgePointId;

    /** 关联来源：AI/MANUAL */
    private String source;
}
