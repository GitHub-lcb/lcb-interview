package com.lcbinterview.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;

/**
 * 高频考点表结构初始化器，在应用接受请求前执行幂等升级脚本。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class KnowledgeSchemaInitializer implements InitializingBean {

    private final DataSource dataSource;

    /**
     * 执行 JAR 内的幂等知识体系迁移，兼容新库和已有数据卷升级。
     */
    @Override
    public void afterPropertiesSet() {
        ResourceDatabasePopulator populator = new ResourceDatabasePopulator(
                new ClassPathResource("db/lcb-knowledge-migration.sql"));
        populator.setContinueOnError(false);
        populator.execute(dataSource);
        log.info("高频考点数据库迁移检查完成");
    }
}
