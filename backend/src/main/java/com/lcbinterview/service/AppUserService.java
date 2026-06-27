package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.lcbinterview.common.BusinessException;
import com.lcbinterview.dto.auth.AuthTokenVO;
import com.lcbinterview.dto.auth.AuthUserVO;
import com.lcbinterview.dto.auth.LoginRequest;
import com.lcbinterview.dto.auth.RegisterRequest;
import com.lcbinterview.mapper.AppUserMapper;
import com.lcbinterview.model.AppUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.regex.Pattern;

/**
 * 普通用户服务，负责注册、登录和当前用户读取。
 */
@Service
@RequiredArgsConstructor
public class AppUserService {

    private static final Pattern USERNAME_PATTERN = Pattern.compile("^[A-Za-z0-9_]{3,32}$");
    private static final String STATUS_ACTIVE = "ACTIVE";

    private final AppUserMapper appUserMapper;
    private final AuthTokenService authTokenService;
    private final PasswordHashService passwordHashService;

    /**
     * 注册普通用户并返回访问令牌。
     *
     * @param request 注册请求
     * @return 登录令牌和用户信息
     */
    @Transactional
    public AuthTokenVO register(RegisterRequest request) {
        String username = normalizeUsername(request.username());
        if (!USERNAME_PATTERN.matcher(username).matches()) {
            throw new BusinessException(400, "用户名只能包含字母、数字、下划线，长度 3 到 32 位");
        }
        if (request.password() == null || request.password().length() < 8) {
            throw new BusinessException(400, "密码长度不能少于 8 位");
        }
        Long exists = appUserMapper.selectCount(Wrappers.<AppUser>lambdaQuery()
                .eq(AppUser::getUsername, username));
        if (exists != null && exists > 0) {
            throw new BusinessException(409, "用户名已存在");
        }
        AppUser user = new AppUser();
        user.setUsername(username);
        user.setPasswordHash(passwordHashService.hash(request.password()));
        user.setDisplayName(resolveDisplayName(request.displayName(), username));
        user.setStatus(STATUS_ACTIVE);
        appUserMapper.insert(user);
        return tokenFor(user);
    }

    /**
     * 校验用户名密码并返回访问令牌。
     *
     * @param request 登录请求
     * @return 登录令牌和用户信息
     */
    @Transactional(readOnly = true)
    public AuthTokenVO login(LoginRequest request) {
        AppUser user = findByUsername(normalizeUsername(request.username()));
        if (!STATUS_ACTIVE.equals(user.getStatus())) {
            throw new BusinessException(403, "账号已停用");
        }
        if (!passwordHashService.matches(request.password(), user.getPasswordHash())) {
            throw new BusinessException(401, "用户名或密码错误");
        }
        return tokenFor(user);
    }

    /**
     * 根据用户 ID 查询当前用户展示信息。
     *
     * @param userId 普通用户 ID
     * @return 用户展示信息
     */
    @Transactional(readOnly = true)
    public AuthUserVO currentUser(Long userId) {
        AppUser user = appUserMapper.selectById(userId);
        if (user == null || !STATUS_ACTIVE.equals(user.getStatus())) {
            throw new BusinessException(401, "登录状态已失效");
        }
        return AuthUserVO.from(user);
    }

    private AppUser findByUsername(String username) {
        AppUser user = appUserMapper.selectOne(Wrappers.<AppUser>lambdaQuery()
                .eq(AppUser::getUsername, username));
        if (user == null) {
            throw new BusinessException(401, "用户名或密码错误");
        }
        return user;
    }

    private AuthTokenVO tokenFor(AppUser user) {
        return new AuthTokenVO(authTokenService.issueToken(user.getId()), AuthUserVO.from(user));
    }

    private String normalizeUsername(String username) {
        return username == null ? "" : username.trim();
    }

    private String resolveDisplayName(String displayName, String username) {
        if (!StringUtils.hasText(displayName)) {
            return username;
        }
        return displayName.trim();
    }
}
