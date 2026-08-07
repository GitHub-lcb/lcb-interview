package com.lcbinterview.model;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 面经语料实体，保存抓取的面经原文与 AI 提取状态，仅用于权重计算不对外展示。
 */
@Data
@TableName("interview_source")
public class InterviewSource {

    /** 主键 */
    @TableId(type = IdType.AUTO)
    private Long id;

    /** 原文地址，去重键 */
    @TableField("source_url")
    private String sourceUrl;

    /** 来源站点 */
    @TableField("source_name")
    private String sourceName;

    /** AI 提取的公司 */
    private String company;

    /** AI 提取的岗位 */
    private String position;

    /** 发布日期 */
    @TableField("publish_date")
    private LocalDate publishDate;

    /** 原文文本，仅本地处理不对外展示 */
    @TableField("raw_content")
    private String rawContent;

    /** RAW/EXTRACTED/FAILED */
    private String status;

    /** 提取失败原因 */
    @TableField("extract_error")
    private String extractError;

    /** 创建时间 */
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    /** 更新时间 */
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    /** 逻辑删除标记 */
    @TableLogic
    @TableField("is_deleted")
    private Boolean isDeleted;
}
