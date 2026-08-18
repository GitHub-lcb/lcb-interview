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
 * 大乐透推荐历史实体，保存当前用户每次生成的 5 前区 + 3 后区（复式）推荐。
 */
@Data
@TableName("lottery_dlt_recommendation")
public class DltRecommendation {

    /** 主键 */
    @TableId(type = IdType.AUTO)
    private Long id;

    /** 所属普通用户 ID */
    @TableField("user_id")
    private Long userId;

    /** 推荐来源：RULE_BASED */
    private String source;

    /** 5 个前区号码，逗号分隔 */
    @TableField("front_numbers")
    private String frontNumbers;

    /** 3 个后区号码（复式），逗号分隔 */
    @TableField("back_numbers")
    private String backNumbers;

    /** 使用的历史期数 */
    @TableField("base_issue_count")
    private Integer baseIssueCount;

    /** 生成时最新期号 */
    @TableField("latest_issue_no")
    private String latestIssueNo;

    /** 预测开奖日期（未结算时前端据此展示今晚/明天开） */
    @TableField("predicted_draw_date")
    private LocalDate predictedDrawDate;

    /** 历史特征摘要 */
    @TableField("feature_summary")
    private String featureSummary;

    /** 分析 JSON（回测摘要等） */
    @TableField("analysis_json")
    private String analysisJson;

    /** 结算开奖期号 */
    @TableField("evaluated_issue_no")
    private String evaluatedIssueNo;

    /** 结算开奖日期 */
    @TableField("evaluated_draw_date")
    private LocalDate evaluatedDrawDate;

    /** 命中结果 JSON */
    @TableField("hit_summary_json")
    private String hitSummaryJson;

    /** 前区命中 + 后区命中 */
    @TableField("total_hit_count")
    private Integer totalHitCount;

    /** 前区命中数（0-5） */
    @TableField("max_hit_count")
    private Integer maxHitCount;

    /** 命中结算时间 */
    @TableField("evaluated_at")
    private LocalDateTime evaluatedAt;

    /** 风险提示 */
    private String disclaimer;

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
