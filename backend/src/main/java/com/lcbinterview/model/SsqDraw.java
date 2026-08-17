package com.lcbinterview.model;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 双色球开奖记录实体，红球 6 个 + 蓝球 1 个。
 */
@Data
@TableName("lottery_ssq_draw")
public class SsqDraw {

    /** 主键 */
    @TableId(type = IdType.AUTO)
    private Long id;

    /** 期号，如 2026094 */
    @TableField("issue_no")
    private String issueNo;

    /** 开奖日期 */
    @TableField("draw_date")
    private LocalDate drawDate;

    /** 6 个红球号码，逗号分隔 */
    @TableField("red_numbers")
    private String redNumbers;

    /** 1 个蓝球号码 */
    @TableField("blue_number")
    private String blueNumber;

    /** 来源页面 */
    @TableField("source_url")
    private String sourceUrl;

    /** 来源名称 */
    @TableField("source_name")
    private String sourceName;

    /** 创建时间 */
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    /** 更新时间 */
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}
