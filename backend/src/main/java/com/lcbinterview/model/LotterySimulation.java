package com.lcbinterview.model;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 彩票模拟战场结果实体：对最近 N 期逐期滚动预测并结算，统计预测算法命中表现。
 * 与线上推荐记录（lottery_*_recommendation）分开存储。
 */
@Data
@TableName("lottery_simulation")
public class LotterySimulation {

    /** 主键 */
    @TableId(type = IdType.AUTO)
    private Long id;

    /** 所属普通用户 ID */
    @TableField("user_id")
    private Long userId;

    /** 模拟类型：KL8/SSQ/DLT */
    @TableField("lottery_type")
    private String lotteryType;

    /** 模拟期数（10-1000） */
    @TableField("window_size")
    private Integer windowSize;

    /** 每期预测使用的前置历史期数 */
    @TableField("lead_history")
    private Integer leadHistory;

    /** 模拟起始期号 */
    @TableField("start_issue_no")
    private String startIssueNo;

    /** 模拟结束期号 */
    @TableField("end_issue_no")
    private String endIssueNo;

    /** 实际结算期数 */
    @TableField("evaluated_count")
    private Integer evaluatedCount;

    /** 总命中数 */
    @TableField("total_hits")
    private Integer totalHits;

    /** 平均命中 */
    @TableField("avg_hits")
    private BigDecimal avgHits;

    /** 至少命中 1 个的比例（%） */
    @TableField("hit_rate")
    private BigDecimal hitRate;

    /** 全不中期数 */
    @TableField("zero_hit_count")
    private Integer zeroHitCount;

    /** 单期最高命中 */
    @TableField("max_hits")
    private Integer maxHits;

    /** 次维度平均命中（KL8 两组总命中/SSQ 蓝球/DLT 后区） */
    @TableField("secondary_avg")
    private BigDecimal secondaryAvg;

    /** KL8 单组全中 4 个的期数 */
    @TableField("hit4_count")
    private Integer hit4Count;

    /** 主维度命中数分布 JSON，如 {"0":5,"1":20,"2":40} */
    @TableField("hit_distribution_json")
    private String hitDistributionJson;

    /** 逐期模拟明细 JSON */
    @TableField("result_json")
    private String resultJson;

    /** 统计摘要 */
    private String summary;

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
