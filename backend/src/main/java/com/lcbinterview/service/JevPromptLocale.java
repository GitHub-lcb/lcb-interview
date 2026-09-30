package com.lcbinterview.service;

/**
 * 送给 Jev 的提示词语言。
 *
 * Jev 不生成语言，但它对指令的理解与 RLCD 训练出的概率校准都依赖训练分布，
 * 而 TypeSafe 的训练数据为内部合成，官方文档、SDK 示例与工作流评测均以英文呈现，
 * 未发布过语言支持声明。因此这里把「送模型的文本」与「给人看的文本」分开：
 * 只有前者随本配置切换，面向用户的中文解读、告警与档位标签始终保持中文，
 * 避免切换语言时前端文案跟着漂移。
 */
public enum JevPromptLocale {

    /** 中文提示词，默认值，与既有接入行为一致。 */
    ZH("zh"),

    /** 英文提示词，用于 A/B 对照。 */
    EN("en");

    private final String code;

    JevPromptLocale(String code) {
        this.code = code;
    }

    /**
     * 解析配置值，无法识别时回退到中文。
     * 语言只影响提示词渲染，配置写错不应导致调用失败，因此这里不做严格校验。
     *
     * @param raw 配置原文
     * @return 语言枚举，未知值回退 {@link #ZH}
     */
    public static JevPromptLocale parse(String raw) {
        if (raw == null) {
            return ZH;
        }
        String trimmed = raw.trim();
        for (JevPromptLocale locale : values()) {
            if (locale.code.equalsIgnoreCase(trimmed)) {
                return locale;
            }
        }
        return ZH;
    }

    /**
     * 语言代码。
     *
     * @return zh 或 en
     */
    public String code() {
        return code;
    }
}
