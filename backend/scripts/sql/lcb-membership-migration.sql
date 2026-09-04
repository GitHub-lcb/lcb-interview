-- =============================================
-- 会员订阅 + AI 积分计费迁移（幂等，可重复执行）
-- 包含：订阅计划、用户会员、积分余额、积分流水、
-- 配额消耗流水、订单 6 张新表，app_user 冗余会员等级列，
-- 以及订阅计划/积分包种子数据。
-- =============================================

CREATE TABLE IF NOT EXISTS membership_plan (
    id                   BIGINT       AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
    code                 VARCHAR(32)  NOT NULL COMMENT '计划编码，如 PRO_MONTHLY / CREDIT_PACK_100',
    type                 VARCHAR(16)  NOT NULL COMMENT '计划类型：SUBSCRIPTION 订阅 / CREDIT_PACK 积分包',
    name                 VARCHAR(64)  NOT NULL COMMENT '计划名称',
    price_cents          INT          NOT NULL DEFAULT 0 COMMENT '价格，单位分',
    duration_days        INT          NOT NULL DEFAULT 0 COMMENT '订阅时长天数，积分包为 0',
    credit_amount        INT          NOT NULL DEFAULT 0 COMMENT '积分包包含的积分数量',
    monthly_credit_grant INT          NOT NULL DEFAULT 0 COMMENT '订阅开通时赠送的积分数量',
    status               VARCHAR(16)  NOT NULL DEFAULT 'ACTIVE' COMMENT '计划状态：ACTIVE/OFFLINE',
    create_time          DATETIME     NOT NULL COMMENT '创建时间',
    update_time          DATETIME     NOT NULL COMMENT '更新时间',
    is_deleted           TINYINT      DEFAULT 0 COMMENT '逻辑删除标记',
    UNIQUE KEY uk_membership_plan_code (code),
    INDEX idx_membership_plan_type (type)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '会员订阅计划与积分包';

CREATE TABLE IF NOT EXISTS user_membership (
    id          BIGINT      AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
    user_id     BIGINT      NOT NULL COMMENT '所属普通用户 ID',
    plan_code   VARCHAR(32) NOT NULL COMMENT '订阅计划编码',
    start_time  DATETIME    NOT NULL COMMENT '本期订阅开始时间',
    expire_time DATETIME    NOT NULL COMMENT '本期订阅到期时间',
    status      VARCHAR(16) NOT NULL DEFAULT 'ACTIVE' COMMENT '订阅状态：ACTIVE/EXPIRED/CANCELLED',
    auto_renew  TINYINT     NOT NULL DEFAULT 0 COMMENT '是否自动续费：0 否 / 1 是',
    create_time DATETIME    NOT NULL COMMENT '创建时间',
    update_time DATETIME    NOT NULL COMMENT '更新时间',
    is_deleted  TINYINT     DEFAULT 0 COMMENT '逻辑删除标记',
    INDEX idx_user_membership_user (user_id),
    INDEX idx_user_membership_expire (status, expire_time)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '用户会员订阅记录';

CREATE TABLE IF NOT EXISTS user_credit (
    id             BIGINT   AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
    user_id        BIGINT   NOT NULL COMMENT '所属普通用户 ID',
    balance        INT      NOT NULL DEFAULT 0 COMMENT '当前积分余额',
    total_granted  BIGINT   NOT NULL DEFAULT 0 COMMENT '累计获得积分',
    total_consumed BIGINT   NOT NULL DEFAULT 0 COMMENT '累计消耗积分',
    create_time    DATETIME NOT NULL COMMENT '创建时间',
    update_time    DATETIME NOT NULL COMMENT '更新时间',
    UNIQUE KEY uk_user_credit_user (user_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '用户 AI 积分余额';

CREATE TABLE IF NOT EXISTS credit_transaction (
    id            BIGINT      AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
    user_id       BIGINT      NOT NULL COMMENT '所属普通用户 ID',
    type          VARCHAR(16) NOT NULL COMMENT '流水类型：GRANT/PURCHASE/CONSUME/REFUND',
    amount        INT         NOT NULL COMMENT '变动数量，消耗为负数',
    balance_after INT         NOT NULL COMMENT '变动后余额',
    resource      VARCHAR(32) DEFAULT NULL COMMENT '消耗资源类型，仅 CONSUME 流水有值',
    ref_id        VARCHAR(64) DEFAULT NULL COMMENT '关联订单号或业务 ID',
    remark        VARCHAR(200) DEFAULT '' COMMENT '备注说明',
    create_time   DATETIME    NOT NULL COMMENT '创建时间',
    INDEX idx_credit_transaction_user (user_id, create_time)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'AI 积分流水';

CREATE TABLE IF NOT EXISTS user_quota_log (
    id          BIGINT      AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
    user_id     BIGINT      NOT NULL COMMENT '所属普通用户 ID',
    resource    VARCHAR(32) NOT NULL COMMENT '配额资源类型，如 AI_EVALUATE / EXPORT',
    quota_date  DATE        NOT NULL COMMENT '配额归属日期，每日 0 点重置',
    count       INT         NOT NULL DEFAULT 0 COMMENT '当日累计消耗次数',
    create_time DATETIME    NOT NULL COMMENT '创建时间',
    update_time DATETIME    NOT NULL COMMENT '更新时间',
    UNIQUE KEY uk_user_quota_log (user_id, resource, quota_date)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '每日配额消耗流水';

CREATE TABLE IF NOT EXISTS user_order (
    id            BIGINT      AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
    order_no      VARCHAR(40) NOT NULL COMMENT '订单号',
    user_id       BIGINT      NOT NULL COMMENT '所属普通用户 ID',
    type          VARCHAR(16) NOT NULL COMMENT '订单类型：SUBSCRIPTION/CREDIT_PACK',
    plan_code     VARCHAR(32) NOT NULL COMMENT '关联计划编码',
    credit_amount INT         NOT NULL DEFAULT 0 COMMENT '积分包包含的积分数量',
    amount_cents  INT         NOT NULL DEFAULT 0 COMMENT '订单金额，单位分',
    status        VARCHAR(16) NOT NULL DEFAULT 'PENDING' COMMENT '订单状态：PENDING/PAID/CANCELLED/REFUNDED',
    out_trade_no  VARCHAR(64) DEFAULT NULL COMMENT '支付渠道交易号，回调幂等键',
    paid_time     DATETIME    DEFAULT NULL COMMENT '支付完成时间',
    create_time   DATETIME    NOT NULL COMMENT '创建时间',
    update_time   DATETIME    NOT NULL COMMENT '更新时间',
    is_deleted    TINYINT     DEFAULT 0 COMMENT '逻辑删除标记',
    UNIQUE KEY uk_user_order_no (order_no),
    UNIQUE KEY uk_user_order_out_trade (out_trade_no),
    INDEX idx_user_order_user (user_id, create_time)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '会员订阅与积分包订单';

-- app_user 补充会员等级冗余列，仅用于列表展示 VIP 标识，权益判定以 user_membership 有效期为准
SET @member_col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'app_user' AND COLUMN_NAME = 'membership_level');
SET @member_col_ddl = IF(@member_col_exists = 0,
    'ALTER TABLE app_user ADD COLUMN membership_level VARCHAR(16) NOT NULL DEFAULT ''FREE'' COMMENT ''会员等级冗余列：FREE/PRO''',
    'SELECT 1');
PREPARE member_col_stmt FROM @member_col_ddl;
EXECUTE member_col_stmt;
DEALLOCATE PREPARE member_col_stmt;

-- 订阅计划与积分包种子数据，重复执行时仅刷新名称、价格和权益
INSERT INTO membership_plan
    (code, type, name, price_cents, duration_days, credit_amount, monthly_credit_grant, status, create_time, update_time)
VALUES
    ('PRO_MONTHLY', 'SUBSCRIPTION', 'PRO 会员月卡', 2900, 30, 0, 100, 'ACTIVE', NOW(), NOW()),
    ('PRO_YEARLY', 'SUBSCRIPTION', 'PRO 会员年卡', 19900, 365, 0, 500, 'ACTIVE', NOW(), NOW()),
    ('CREDIT_PACK_100', 'CREDIT_PACK', 'AI 积分包 100', 990, 0, 100, 0, 'ACTIVE', NOW(), NOW()),
    ('CREDIT_PACK_500', 'CREDIT_PACK', 'AI 积分包 500', 3990, 0, 500, 0, 'ACTIVE', NOW(), NOW())
ON DUPLICATE KEY UPDATE
    type = VALUES(type),
    name = VALUES(name),
    price_cents = VALUES(price_cents),
    duration_days = VALUES(duration_days),
    credit_amount = VALUES(credit_amount),
    monthly_credit_grant = VALUES(monthly_credit_grant),
    status = VALUES(status),
    update_time = NOW();
