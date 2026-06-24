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
 * AI 运行时配置。系统只使用 id=1 的单例配置，用于覆盖环境变量中的默认 AI 参数。
 */
@Data
@TableName("ai_config")
public class AiConfig {

    /** 主键，固定使用 1 作为当前系统配置 */
    @TableId(type = IdType.INPUT)
    private Long id;

    /** OpenAI 兼容服务 API Key，数据库保存原文，接口永不返回原文 */
    @TableField("api_key")
    private String apiKey;

    /** OpenAI 兼容模型名称 */
    private String model;

    /** OpenAI 兼容 chat completions 接口地址 */
    @TableField("api_url")
    private String apiUrl;

    /** 是否启用面试训练 AI 评分；题目生成只依赖 key/model/url 是否完整 */
    @TableField("interview_enabled")
    private Boolean interviewEnabled;

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
