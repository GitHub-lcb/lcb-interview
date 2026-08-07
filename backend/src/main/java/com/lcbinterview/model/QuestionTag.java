package com.lcbinterview.model;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

/**
 * 题目标签关联实体，复合主键 question_id + tag_id。
 */
@Data
@TableName("question_tag")
public class QuestionTag {

    /** 题目 ID */
    private Long questionId;

    /** 标签 ID */
    private Long tagId;
}
