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
 * 普通用户实体，用于个人工具模块的多用户数据隔离。
 */
@Data
@TableName("app_user")
public class AppUser {

    /** 主键 */
    @TableId(type = IdType.AUTO)
    private Long id;

    /** 登录用户名，唯一 */
    private String username;

    /** PBKDF2 密码哈希 */
    @TableField("password_hash")
    private String passwordHash;

    /** 展示昵称 */
    @TableField("display_name")
    private String displayName;

    /** 用户状态：ACTIVE / DISABLED */
    private String status;

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
