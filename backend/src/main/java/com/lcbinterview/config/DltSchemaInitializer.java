package com.lcbinterview.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;

/**
 * 大乐透表结构初始化器，在应用接受请求前执行幂等建表脚本。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DltSchemaInitializer implements InitializingBean {

    private final DataSource dataSource;

    /**
     * 执行 JAR 内的幂等大乐透建表脚本，兼容新库和已有数据卷升级。
     */
    @Override
    public void afterPropertiesSet() {
        ResourceDatabasePopulator populator = new ResourceDatabasePopulator(
                new ClassPathResource("db/lcb-dlt-migration.sql"));
        populator.setContinueOnError(false);
        populator.execute(dataSource);
        log.info("大乐透数据库迁移检查完成");
    }
}
