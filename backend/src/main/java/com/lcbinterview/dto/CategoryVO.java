package com.lcbinterview.dto;

import com.lcbinterview.model.Category;

/**
 * 分类前端展示对象，隔离数据库逻辑删除等内部字段。
 *
 * @param id 分类 ID
 * @param name 分类名称
 * @param icon 图标 URL
 * @param description 分类描述
 * @param sortOrder 排序权重
 */
public record CategoryVO(
        Long id,
        String name,
        String icon,
        String description,
        Integer sortOrder
) {

    /**
     * 从分类实体构建前端展示对象。
     *
     * @param category 分类实体
     * @return 分类展示对象
     */
    public static CategoryVO from(Category category) {
        return new CategoryVO(
                category.getId(),
                category.getName(),
                category.getIcon(),
                category.getDescription(),
                category.getSortOrder());
    }
}
