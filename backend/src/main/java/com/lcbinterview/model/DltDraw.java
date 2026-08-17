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
 * 大乐透开奖记录实体，前区 5 个 + 后区 2 个。
 */
@Data
@TableName("lottery_dlt_draw")
public class DltDraw {

    /** 主键 */
    @TableId(type = IdType.AUTO)
    private Long id;

    /** 期号，如 26092 */
    @TableField("issue_no")
    private String issueNo;

    /** 开奖日期 */
    @TableField("draw_date")
    private LocalDate drawDate;

    /** 5 个前区号码，逗号分隔 */
    @TableField("front_numbers")
    private String frontNumbers;

    /** 2 个后区号码，逗号分隔 */
    @TableField("back_numbers")
    private String backNumbers;

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
