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
 * 快乐8开奖记录实体，保存每期 20 个开奖号码。
 */
@Data
@TableName("lottery_kl8_draw")
public class LotteryKl8Draw {

    /** 主键 */
    @TableId(type = IdType.AUTO)
    private Long id;

    /** 开奖期号 */
    @TableField("issue_no")
    private String issueNo;

    /** 开奖日期 */
    @TableField("draw_date")
    private LocalDate drawDate;

    /** 20 个开奖号码，逗号分隔 */
    private String numbers;

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
