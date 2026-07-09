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
 * 快乐8推荐历史实体，保存当前用户每次生成的推荐号码，支持选1到选10玩法。
 */
@Data
@TableName("lottery_kl8_recommendation")
public class LotteryKl8Recommendation {

    /** 主键 */
    @TableId(type = IdType.AUTO)
    private Long id;

    /** 所属普通用户 ID */
    @TableField("user_id")
    private Long userId;

        /** 推荐来源：RULE_BASED，旧记录可能为 AI */
    private String source;

    /** 每组推荐号码数量（1-10），旧记录为 null 时按 5 处理 */
    @TableField("pick_size")
    private Integer pickSize;

    /** 使用的历史期数 */
    @TableField("base_issue_count")
    private Integer baseIssueCount;

    /** 生成时最新期号 */
    @TableField("latest_issue_no")
    private String latestIssueNo;

    /** 推荐号码和理由 JSON */
    @TableField("recommendations_json")
    private String recommendationsJson;

    /** 历史特征摘要 */
    @TableField("feature_summary")
    private String featureSummary;

    /** 深度分析 JSON */
    @TableField("analysis_json")
    private String analysisJson;

    /** 候选池 JSON */
    @TableField("candidate_pool_json")
    private String candidatePoolJson;

    /** 策略校准快照 JSON */
    @TableField("calibration_snapshot_json")
    private String calibrationSnapshotJson;

    /** 推荐策略版本 */
    @TableField("strategy_version")
    private String strategyVersion;

    /** 结算开奖期号 */
    @TableField("evaluated_issue_no")
    private String evaluatedIssueNo;

    /** 结算开奖日期 */
    @TableField("evaluated_draw_date")
    private LocalDate evaluatedDrawDate;

    /** 命中结果 JSON */
    @TableField("hit_summary_json")
    private String hitSummaryJson;

    /** 推荐组累计命中数量 */
    @TableField("total_hit_count")
    private Integer totalHitCount;

    /** 单组最高命中数量 */
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

    /** 逻辑删除标记 */
    @TableLogic
    @TableField("is_deleted")
    private Boolean isDeleted;
}
