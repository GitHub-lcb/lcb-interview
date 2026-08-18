package com.lcbinterview.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;

/**
 * 彩种推荐表补列初始化器，执行幂等补列脚本。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LotterySchemaInitializer implements InitializingBean {

    private final DataSource dataSource;

    /**
     * 执行 JAR 内的幂等彩种补列脚本，兼容已有数据卷升级。
     */
    @Override
    public void afterPropertiesSet() {
        ResourceDatabasePopulator populator = new ResourceDatabasePopulator(
                new ClassPathResource("db/lcb-lottery-migration.sql"));
        populator.setContinueOnError(false);
        populator.execute(dataSource);
        log.info("彩种推荐表补列迁移检查完成");
    }
}
