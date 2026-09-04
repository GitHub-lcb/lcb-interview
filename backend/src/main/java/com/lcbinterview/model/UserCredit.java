package com.lcbinterview.model;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 用户 AI 积分余额实体。每个用户单行记录，扣减通过条件更新防止并发出现负余额。
 * 余额属于资金类数据，不做逻辑删除。
 */
@Data
@TableName("user_credit")
public class UserCredit {

    /** 主键 */
    @TableId(type = IdType.AUTO)
    private Long id;

    /** 所属普通用户 ID */
    @TableField("user_id")
    private Long userId;

    /** 当前积分余额 */
    private Integer balance;

    /** 累计获得积分 */
    @TableField("total_granted")
    private Long totalGranted;

    /** 累计消耗积分 */
    @TableField("total_consumed")
    private Long totalConsumed;

    /** 创建时间 */
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    /** 更新时间 */
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}
