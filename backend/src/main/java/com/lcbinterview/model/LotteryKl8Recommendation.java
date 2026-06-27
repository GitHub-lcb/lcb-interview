package com.lcbinterview.model;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 快乐8选5推荐历史实体，保存当前用户每次生成的 5 组号码。
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

    /** 推荐来源：AI / RULE_BASED */
    private String source;

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
