package com.lcbinterview.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;

/**
 * 学习进度云同步表结构初始化器，在应用接受请求前执行幂等建表脚本。
 * 仿照 {@link KnowledgeSchemaInitializer}，保证旧数据卷升级和新库初始化行为一致。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class StudyProgressSchemaInitializer implements InitializingBean {

    private final DataSource dataSource;

    /**
     * 执行 JAR 内的幂等学习进度建表迁移，重复启动不会破坏已有数据。
     */
    @Override
    public void afterPropertiesSet() {
        ResourceDatabasePopulator populator = new ResourceDatabasePopulator(
                new ClassPathResource("db/lcb-study-progress-migration.sql"));
        populator.setContinueOnError(false);
        populator.execute(dataSource);
        log.info("学习进度云同步表结构迁移检查完成");
    }
}
