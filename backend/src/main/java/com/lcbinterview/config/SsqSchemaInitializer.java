package com.lcbinterview.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;

/**
 * 双色球表结构初始化器，在应用接受请求前执行幂等建表脚本。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SsqSchemaInitializer implements InitializingBean {

    private final DataSource dataSource;

    /**
     * 执行 JAR 内的幂等双色球建表脚本，兼容新库和已有数据卷升级。
     */
    @Override
    public void afterPropertiesSet() {
        ResourceDatabasePopulator populator = new ResourceDatabasePopulator(
                new ClassPathResource("db/lcb-ssq-migration.sql"));
        populator.setContinueOnError(false);
        populator.execute(dataSource);
        log.info("双色球数据库迁移检查完成");
    }
}
