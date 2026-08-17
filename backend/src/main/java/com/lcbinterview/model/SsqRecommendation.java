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
 * 双色球推荐历史实体，保存当前用户每次生成的 7 红 + 1 蓝推荐。
 */
@Data
@TableName("lottery_ssq_recommendation")
public class SsqRecommendation {

    /** 主键 */
    @TableId(type = IdType.AUTO)
    private Long id;

    /** 所属普通用户 ID */
    @TableField("user_id")
    private Long userId;

    /** 推荐来源：RULE_BASED */
    private String source;

    /** 7 个红球号码，逗号分隔 */
    @TableField("red_numbers")
    private String redNumbers;

    /** 1 个蓝球号码 */
    @TableField("blue_number")
    private String blueNumber;

    /** 使用的历史期数 */
    @TableField("base_issue_count")
    private Integer baseIssueCount;

    /** 生成时最新期号 */
    @TableField("latest_issue_no")
    private String latestIssueNo;

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

    /** 红球命中数 + 蓝球命中数 */
    @TableField("total_hit_count")
    private Integer totalHitCount;

    /** 红球命中数（0-7） */
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
