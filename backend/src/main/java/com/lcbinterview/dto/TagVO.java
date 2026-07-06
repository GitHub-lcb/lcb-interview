package com.lcbinterview.dto;

import com.lcbinterview.model.Tag;

/**
 * 标签前端展示对象，避免公开接口直接暴露 Entity。
 *
 * @param id 标签 ID
 * @param name 标签名称
 */
public record TagVO(Long id, String name) {

    /**
     * 从标签实体构建前端展示对象。
     *
     * @param tag 标签实体
     * @return 标签展示对象
     */
    public static TagVO from(Tag tag) {
        return new TagVO(tag.getId(), tag.getName());
    }
}
