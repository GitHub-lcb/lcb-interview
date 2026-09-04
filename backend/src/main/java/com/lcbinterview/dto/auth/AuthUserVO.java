package com.lcbinterview.dto.auth;

import com.lcbinterview.model.AppUser;

/**
 * 普通用户前端展示信息。
 *
 * @param id              用户 ID
 * @param username        登录用户名
 * @param displayName     展示昵称
 * @param membershipLevel 会员等级冗余列：FREE / PRO
 */
public record AuthUserVO(Long id, String username, String displayName, String membershipLevel) {

    /**
     * 从用户实体创建展示对象。
     *
     * @param user 用户实体
     * @return 普通用户展示对象
     */
    public static AuthUserVO from(AppUser user) {
        return new AuthUserVO(user.getId(), user.getUsername(), user.getDisplayName(),
                user.getMembershipLevel() == null ? "FREE" : user.getMembershipLevel());
    }
}
