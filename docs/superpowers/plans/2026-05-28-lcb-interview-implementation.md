# LCB Interview — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 搭建公开面试题库网站 MVP，支持题库浏览、刷题、搜索功能。

**架构：** Spring Boot 3 后端提供 REST API（JPA/MySQL/Redis），React 18 前端使用 Ant Design 5，Nginx 部署。

**技术栈：** Spring Boot 3 + JDK 21 (Virtual Threads), Spring Data JPA, MySQL 8, Redis, React 18, Vite, Ant Design 5, react-markdown, Axios

---

## JDK 21 特性使用说明

| 特性 | 使用位置 |
|------|----------|
| **Record** | 所有 DTO / VO（ApiResponse, QuestionVO, PageResult, QuestionQuery） |
| **Builder 模式** | QuestionQuery 用 `@Builder` 构建可选参数 |
| **Text Block** | Mapper XML 或 @Select 中复杂 SQL 多行字符串 |
| **Virtual Threads** | application.yml 全局开启，处理 I/O 密集型请求 |
| **SequencedCollection** | Entity 中有序集合使用 `SequencedSet` 接口 |
| **Stream.toList()** | 返回不可变 List，替代 `.collect(Collectors.toList())` |
| **@Transactional(readOnly=true)** | 查询方法标记只读事务，提升性能 |

## 设计模式

| 模式 | 使用位置 | 说明 |
|------|----------|------|
| **DTO / VO 模式** | `dto/` 包 | Entity 与前端 VO 分离，避免暴露内部结构 |
| **Builder 模式** | `QuestionQuery` | 多可选参数场景，链式构造 |
| **Facade 模式** | Service 层 | 聚合 Repository 操作，对外提供统一接口 |
| **策略模式** | `Question.Difficulty` Enum | 难度枚举封装判断逻辑 |
| **全局异常处理** | `@RestControllerAdvice` | 统一异常处理，避免 try-catch 散落 |
| **模板方法** | `@PrePersist` / `@PreUpdate` | Entity 生命周期回调自动设置时间 |

## 性能优化要点

| 优化项 | 说明 |
|--------|------|
| **Virtual Threads** | JDK 21 虚拟线程，大幅降低 I/O 等待开销 |
| **@Transactional(readOnly=true)** | 查询方法跳过事务写日志，减少锁竞争 |
| **Redis 缓存** | 分类列表和热门题目缓存 10 分钟 |
| **view_count 批量写入** | 内存累积 5 分钟定期 flush，避免热点行锁 |
| **分页查询** | 默认 20 条，避免全量加载 |
| **FetchType.LAZY** | 关联对象懒加载，避免 N+1 |
| **HikariCP** | Spring Boot 默认连接池，高性能 |
| **Stream.toList()** | 不可变列表，减少 GC 压力 |

---

```
lcb-interview/
├── backend/
│   ├── pom.xml
│   └── src/main/java/com/lcbinterview/
│       ├── LcbInterviewApplication.java
│       ├── common/
│       │   ├── ApiResponse.java        -- 统一响应结构
│       │   ├── BusinessException.java  -- 业务异常
│       │   └── GlobalExceptionHandler.java -- 全局异常处理
│       ├── config/
│       │   ├── CorsConfig.java
│       │   ├── CacheConfig.java
│       │   ├── SwaggerConfig.java
│       │   └── MyBatisPlusConfig.java
│       ├── model/
│       │   ├── Category.java
│       │   ├── Tag.java
│       │   └── Question.java
│       ├── mapper/
│       │   ├── CategoryMapper.java
│       │   ├── TagMapper.java
│       │   └── QuestionMapper.java
│       ├── service/
│       │   ├── CategoryService.java
│       │   ├── QuestionService.java
│       │   └── ViewCountService.java
│       ├── controller/
│       │   ├── CategoryController.java
│       │   ├── QuestionController.java
│       │   └── TagController.java
│       └── dto/
│           ├── QuestionQuery.java      -- 查询参数 DTO
│           ├── QuestionVO.java         -- 返回给前端的视图对象
│           └── PageResult.java         -- 通用分页
│   └── src/main/resources/
│       ├── application.yml
│       ├── schema.sql
│       └── data.sql
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── nginx.conf
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/
│       │   ├── index.ts
│       │   ├── category.ts
│       │   ├── question.ts
│       │   └── tag.ts
│       ├── components/
│       │   └── Layout/
│       │       ├── index.tsx
│       │       ├── Header.tsx
│       │       └── SideMenu.tsx
│       ├── pages/
│       │   ├── Home/
│       │   │   ├── index.tsx
│       │   │   ├── CategoryGrid.tsx
│       │   │   └── HotQuestions.tsx
│       │   ├── QuestionBank/
│       │   │   └── index.tsx
│       │   ├── QuestionList/
│       │   │   └── index.tsx
│       │   ├── QuestionDetail/
│       │   │   └── index.tsx
│       │   └── SearchResult/
│       │       └── index.tsx
│       └── styles/
│           └── theme.ts
```

---

### 任务 1：后端项目初始化 + Maven 依赖

**文件：**
- 创建：`backend/pom.xml`
- 创建：`backend/src/main/java/com/lcbinterview/LcbInterviewApplication.java`
- 创建：`backend/src/main/resources/application.yml`

- [ ] **步骤 1：创建 pom.xml（JDK 21 + validation、swagger 等规范依赖）**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.2.0</version>
    </parent>
    <groupId>com.lcbinterview</groupId>
    <artifactId>lcb-interview</artifactId>
    <version>0.0.1-SNAPSHOT</version>
    <properties>
        <java.version>21</java.version>
    </properties>
    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-redis</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-validation</artifactId>
        </dependency>
        <dependency>
            <groupId>com.baomidou</groupId>
            <artifactId>mybatis-plus-spring-boot3-starter</artifactId>
            <version>3.5.5</version>
        </dependency>
        <dependency>
            <groupId>com.mysql</groupId>
            <artifactId>mysql-connector-j</artifactId>
            <scope>runtime</scope>
        </dependency>
        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <optional>true</optional>
        </dependency>
        <dependency>
            <groupId>org.springdoc</groupId>
            <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
            <version>2.3.0</version>
        </dependency>
    </dependencies>
    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
        </plugins>
    </build>
</project>
```

- [ ] **步骤 2：创建主启动类**

```java
package com.lcbinterview;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
public class LcbInterviewApplication {
    public static void main(String[] args) {
        SpringApplication.run(LcbInterviewApplication.class, args);
    }
}
```

- [ ] **步骤 3：创建 application.yml**

```yaml
server:
  port: 8080

spring:
  datasource:
    url: jdbc:mysql://localhost:3306/lcb_interview?useUnicode=true&characterEncoding=utf-8&createDatabaseIfNotExist=true
    username: root
    password: root
  # MyBatis-Plus 配置
mybatis-plus:
  global-config:
    db-config:
      id-type: auto
      logic-delete-field: is_deleted
      logic-delete-value: 1
      logic-not-delete-value: 0
  configuration:
    log-impl: org.apache.ibatis.logging.stdout.StdOutImpl
    map-underscore-to-camel-case: true
  data:
    redis:
      host: localhost
      port: 6379
  sql:
    init:
      mode: never

spring:
  threads:
    virtual:
      enabled: true

springdoc:
  api-docs:
    path: /api-docs
  swagger-ui:
    path: /swagger-ui.html

logging:
  level:
    com.lcbinterview: info
```

- [ ] **步骤 4：验证项目启动**

```bash
cd backend
mvn spring-boot:run
```
预期：Spring Boot 启动成功，访问 `http://localhost:8080/swagger-ui.html` 可看到 Swagger 页面。

---

### 任务 2：统一响应结构 + 全局异常处理 + Swagger 配置

**文件：**
- 创建：`backend/src/main/java/com/lcbinterview/common/ApiResponse.java`
- 创建：`backend/src/main/java/com/lcbinterview/common/BusinessException.java`
- 创建：`backend/src/main/java/com/lcbinterview/common/GlobalExceptionHandler.java`
- 创建：`backend/src/main/java/com/lcbinterview/config/CorsConfig.java`
- 创建：`backend/src/main/java/com/lcbinterview/config/CacheConfig.java`
- 创建：`backend/src/main/java/com/lcbinterview/config/SwaggerConfig.java`

- [ ] **步骤 1：创建 ApiResponse（JDK 21 record，统一响应结构）**

```java
package com.lcbinterview.common;

import org.springframework.http.HttpStatus;

public record ApiResponse<T>(int code, String message, T data) {

    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(200, "success", data);
    }

    public static <T> ApiResponse<T> success() {
        return new ApiResponse<>(200, "success", null);
    }

    public static <T> ApiResponse<T> error(int code, String message) {
        return new ApiResponse<>(code, message, null);
    }

    public static <T> ApiResponse<T> error(HttpStatus status, String message) {
        return new ApiResponse<>(status.value(), message, null);
    }
}
```

- [ ] **步骤 2：创建 BusinessException（业务异常）**

```java
package com.lcbinterview.common;

import lombok.Getter;

@Getter
public class BusinessException extends RuntimeException {
    private final int code;

    public BusinessException(int code, String message) {
        super(message);
        this.code = code;
    }

    public BusinessException(String message) {
        super(message);
        this.code = 400;
    }
}
```

- [ ] **步骤 3：创建 GlobalExceptionHandler（全局异常处理）**

```java
package com.lcbinterview.common;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusiness(BusinessException e) {
        log.warn("业务异常: code={}, message={}", e.code(), e.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error(e.code(), e.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + ": " + f.getDefaultMessage())
                .reduce((a, b) -> a + "; " + b)
                .orElse("参数校验失败");
        log.warn("参数校验失败: {}", msg);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error(400, msg));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleUnknown(Exception e) {
        log.error("未知异常", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error(500, "服务器内部错误"));
    }
}
```

- [ ] **步骤 4：创建 CorsConfig**

```java
package com.lcbinterview.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

@Configuration
public class CorsConfig {

    @Bean
    public CorsFilter corsFilter() {
        CorsConfiguration config = new CorsConfiguration();
        config.addAllowedOriginPattern("*");
        config.addAllowedMethod("*");
        config.addAllowedHeader("*");
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return new CorsFilter(source);
    }
}
```

- [ ] **步骤 5：创建 MyBatisPlus 自动填充处理器 + 分页配置**

```java
package com.lcbinterview.config;

import com.baomidou.mybatisplus.core.handlers.MetaObjectHandler;
import org.apache.ibatis.reflection.MetaObject;
import org.springframework.stereotype.Component;
import java.time.LocalDateTime;

/**
 * MyBatis-Plus 自动填充处理器。
 * 在 insert/update 时自动注入 createTime / updateTime。
 */
@Component
public class FieldMetaObjectHandler implements MetaObjectHandler {

    @Override
    public void insertFill(MetaObject metaObject) {
        this.strictInsertFill(metaObject, "createTime", LocalDateTime::now, LocalDateTime.class);
        this.strictUpdateFill(metaObject, "updateTime", LocalDateTime::now, LocalDateTime.class);
    }

    @Override
    public void updateFill(MetaObject metaObject) {
        this.strictUpdateFill(metaObject, "updateTime", LocalDateTime::now, LocalDateTime.class);
    }
}
```

- [ ] **步骤 6：创建 MyBatisPlusConfig（分页插件 + Mapper 扫描）**

```java
package com.lcbinterview.config;

import com.baomidou.mybatisplus.annotation.DbType;
import com.baomidou.mybatisplus.extension.plugins.MybatisPlusInterceptor;
import com.baomidou.mybatisplus.extension.plugins.inner.PaginationInnerInterceptor;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * MyBatis-Plus 核心配置。
 * 注册分页插件，扫描 mapper 接口。
 */
@Configuration
@MapperScan("com.lcbinterview.mapper")
public class MyBatisPlusConfig {

    /**
     * 分页插件。MyBatis-Plus 自动处理分页 SQL 方言。
     */
    @Bean
    public MybatisPlusInterceptor mybatisPlusInterceptor() {
        MybatisPlusInterceptor interceptor = new MybatisPlusInterceptor();
        interceptor.addInnerInterceptor(new PaginationInnerInterceptor(DbType.MYSQL));
        return interceptor;
    }
}
```

- [ ] **步骤 6：创建 CacheConfig（Redis 缓存配置）**

```java
package com.lcbinterview.config;

import org.springframework.cache.CacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import java.time.Duration;

/**
 * Redis 缓存配置。默认所有缓存 TTL 10 分钟。
 */
@Configuration
public class CacheConfig {

    @Bean
    public CacheManager cacheManager(RedisConnectionFactory factory) {
        RedisCacheConfiguration config = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofMinutes(10));
        return RedisCacheManager.builder(factory)
                .cacheDefaults(config)
                .build();
    }
}
```

- [ ] **步骤 7：创建 SwaggerConfig**

```java
package com.lcbinterview.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Knife4j / SpringDoc OpenAPI 配置。
 * 访问地址：http://localhost:8080/swagger-ui.html
 */
@Configuration
public class SwaggerConfig {

    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("LCB Interview API")
                        .version("1.0")
                        .description("面试题库网站后端接口"));
    }
}
```

---

### 任务 3：实体类（Entity）定义

**说明：** Question 和 Tag 之间使用 `@ManyToMany` 关联，JPA 自动管理中间表 `question_tag`，无需手动创建 QuestionTag 实体。

**文件：**
- 创建：`backend/src/main/java/com/lcbinterview/model/Category.java`
- 创建：`backend/src/main/java/com/lcbinterview/model/Tag.java`
- 创建：`backend/src/main/java/com/lcbinterview/model/Question.java`

- [ ] **步骤 1：创建 Category 实体（MyBatis-Plus + 字段注释）**

```java
package com.lcbinterview.model;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * 题库分类。如 Java 基础、MySQL、Redis 等。
 */
@Data
@TableName("category")
public class Category {

    /** 主键 */
    @TableId(type = IdType.AUTO)
    private Long id;

    /** 分类名称，如 Java 基础、MySQL */
    private String name;

    /** 图标 URL */
    private String icon;

    /** 分类描述 */
    private String description;

    /** 排序权重，越小越靠前 */
    @TableField("sort_order")
    private Integer sortOrder;

    /** 创建时间 */
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    /** 更新时间 */
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    /** 逻辑删除标记（0-正常，1-删除） */
    @TableLogic
    @TableField("is_deleted")
    private Boolean isDeleted;
}
```

- [ ] **步骤 2：创建 Tag 实体**

```java
package com.lcbinterview.model;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * 题目标签。对应 question_tag 中间表。
 */
@Data
@TableName("tag")
public class Tag {

    /** 主键 */
    @TableId(type = IdType.AUTO)
    private Long id;

    /** 标签名，唯一，如 Java、Redis、多线程 */
    private String name;

    /** 创建时间 */
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    /** 更新时间 */
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    /** 逻辑删除标记 */
    @TableLogic
    @TableField("is_deleted")
    private Boolean isDeleted;
}
```

- [ ] **步骤 3：创建 Question 实体（MyBatis-Plus 注解 + 难度枚举）**

```java
package com.lcbinterview.model;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * 面试题目。包含题目标题、内容（Markdown）、答案（Markdown）等核心信息。
 */
@Data
@TableName("question")
public class Question {

    /** 主键 */
    @TableId(type = IdType.AUTO)
    private Long id;

    /** 关联分类 ID */
    @TableField("category_id")
    private Long categoryId;

    /** 题目标题 */
    private String title;

    /** 题目内容，Markdown 格式 */
    private String content;

    /** 题目答案，Markdown 格式 */
    private String answer;

    /** 难度：EASY / MEDIUM / HARD */
    private String difficulty;

    /** 浏览次数 */
    @TableField("view_count")
    private Integer viewCount = 0;

    /** 创建时间 */
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    /** 更新时间 */
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    /** 逻辑删除标记 */
    @TableLogic
    @TableField("is_deleted")
    private Boolean isDeleted;
}
```

- [ ] **步骤 4：难度枚举常量（在 QuestionService 中配合模式匹配使用）**

不单独创建枚举文件，用常数字符串表示难度，方便 MyBatis-Plus 查询：
- `"EASY"` — 简单
- `"MEDIUM"` — 中等
- `"HARD"` — 困难

- [ ] **步骤 2：Tag 实体**

```java
package com.lcbinterview.model;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "tag")
public class Tag {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String name;
}
```

- [ ] **步骤 3：Question 实体（含 @ManyToMany 关联 Tag）**

```java
package com.lcbinterview.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.SequencedSet;

@Data
@Entity
@Table(name = "question")
public class Question {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;

    @Column(nullable = false, length = 500)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(columnDefinition = "TEXT")
    private String answer;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Difficulty difficulty;

    @Column(name = "view_count")
    private Integer viewCount = 0;

    @Column(name = "create_time", updatable = false)
    private LocalDateTime createTime;

    @Column(name = "update_time")
    private LocalDateTime updateTime;

    @ManyToMany
    @JoinTable(name = "question_tag",
            joinColumns = @JoinColumn(name = "question_id"),
            inverseJoinColumns = @JoinColumn(name = "tag_id"))
    private SequencedSet<Tag> tags = new LinkedHashSet<>();

    public enum Difficulty {
        EASY, MEDIUM, HARD
    }

    @PrePersist
    protected void onCreate() {
        createTime = LocalDateTime.now();
        updateTime = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updateTime = LocalDateTime.now();
    }
}
```

---

### 任务 4：Mapper 层

MyBatis-Plus BaseMapper 提供内置 CRUD，只需继承即可。复杂查询使用 `@Select` 注解 + 多行 Text Block SQL。

**文件：**
- 创建：`backend/src/main/java/com/lcbinterview/mapper/CategoryMapper.java`
- 创建：`backend/src/main/java/com/lcbinterview/mapper/TagMapper.java`
- 创建：`backend/src/main/java/com/lcbinterview/mapper/QuestionMapper.java`

- [ ] **步骤 1：CategoryMapper**

```java
package com.lcbinterview.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lcbinterview.model.Category;

/**
 * 分类 Mapper。BaseMapper 提供 insert / deleteById / selectById / selectList / updateById 等。
 */
public interface CategoryMapper extends BaseMapper<Category> {
}
```

- [ ] **步骤 2：TagMapper**

```java
package com.lcbinterview.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lcbinterview.model.Tag;

/**
 * 标签 Mapper。
 */
public interface TagMapper extends BaseMapper<Tag> {
}
```

- [ ] **步骤 3：QuestionMapper（含自定义 @Select 查询）**

```java
package com.lcbinterview.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lcbinterview.model.Question;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import java.util.List;

/**
 * 题目 Mapper。复杂查询用 @Select 注解 + Text Block SQL。
 */
public interface QuestionMapper extends BaseMapper<Question> {

    /**
     * 查询热门题目，按浏览次数倒序。
     *
     * @param size 取前 N 条
     * @return 热门题目列表
     */
    @Select("""
            SELECT id, category_id, title, content, answer,
                   difficulty, view_count, create_time, update_time
            FROM question
            WHERE is_deleted = 0
            ORDER BY view_count DESC
            LIMIT #{size}
            """)
    List<Question> selectHot(@Param("size") int size);

    /**
     * 根据标签 ID 查询关联题目。
     *
     * @param tagId 标签 ID
     * @return 题目列表
     */
    @Select("""
            SELECT q.id, q.category_id, q.title, q.content, q.answer,
                   q.difficulty, q.view_count, q.create_time, q.update_time
            FROM question q
            INNER JOIN question_tag qt ON q.id = qt.question_id
            WHERE qt.tag_id = #{tagId} AND q.is_deleted = 0
            ORDER BY q.create_time DESC
            """)
    List<Question> selectByTagId(@Param("tagId") Long tagId);
}
```

---

### 任务 5：Service 层

**文件：**
- 创建：`backend/src/main/java/com/lcbinterview/service/CategoryService.java`
- 创建：`backend/src/main/java/com/lcbinterview/service/QuestionService.java`
- 创建：`backend/src/main/java/com/lcbinterview/service/ViewCountService.java`

- [ ] **步骤 1：CategoryService（MyBatis-Plus QueryWrapper + 日志）**

```java
package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.lcbinterview.common.BusinessException;
import com.lcbinterview.mapper.CategoryMapper;
import com.lcbinterview.model.Category;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import java.util.List;

/**
 * 分类 Service。缓存全部分类列表，支持按 ID 查询。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CategoryService {

    private final CategoryMapper categoryMapper;

    /**
     * 获取全部分类，按 sortOrder 升序。
     * 结果缓存到 Redis，TTL 10 分钟。
     */
    @Cacheable(value = "categories")
    public List<Category> getAll() {
        log.info("缓存未命中，从数据库加载全部分类");
        LambdaQueryWrapper<Category> wrapper = new LambdaQueryWrapper<Category>()
                .orderByAsc(Category::getSortOrder);
        return categoryMapper.selectList(wrapper);
    }

    /**
     * 根据 ID 获取分类详情。
     *
     * @throws BusinessException 分类不存在时抛 404
     */
    public Category getById(Long id) {
        Category category = categoryMapper.selectById(id);
        if (category == null) {
            log.warn("分类不存在，id={}", id);
            throw new BusinessException(404, "分类不存在");
        }
        return category;
    }
}
```

- [ ] **步骤 2：QuestionService（MyBatis-Plus 分页 + LambdaQueryWrapper）**

```java
package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.core.toolkit.StringUtils;
import com.lcbinterview.common.BusinessException;
import com.lcbinterview.mapper.QuestionMapper;
import com.lcbinterview.model.Question;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 题目 Service。处理题目的分页搜索、详情查看、热门排行等业务。
 * 查询方法标记 @Transactional(readOnly = true) 提升性能。
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class QuestionService {

    private final QuestionMapper questionMapper;
    private final ViewCountService viewCountService;

    /**
     * 分页搜索题目。支持分类筛选、难度筛选、关键词模糊搜索、标签筛选。
     * 所有筛选条件均为可选，动态拼接 SQL（MyBatis-Plus LambdaQueryWrapper）。
     */
    public IPage<Question> search(Long categoryId, String difficulty, String keyword,
                                   Long tagId, int page, int size) {
        Page<Question> mpPage = new Page<>(page, size);

        // 标签筛选走自定义 JOIN SQL
        if (tagId != null) {
            log.info("按标签筛选题目，tagId={}, page={}, size={}", tagId, page, size);
            List<Question> list = questionMapper.selectByTagId(tagId);
            mpPage.setRecords(list);
            mpPage.setTotal(list.size());
            return mpPage;
        }

        // 通用搜索用 LambdaQueryWrapper 动态条件
        LambdaQueryWrapper<Question> wrapper = new LambdaQueryWrapper<Question>()
                .eq(categoryId != null, Question::getCategoryId, categoryId)
                .eq(StringUtils.isNotBlank(difficulty), Question::getDifficulty, difficulty)
                .and(StringUtils.isNotBlank(keyword), w ->
                        w.like(Question::getTitle, keyword)
                         .or()
                         .like(Question::getContent, keyword)
                )
                .orderByDesc(Question::getCreateTime);

        log.info("搜索题目: categoryId={}, difficulty={}, keyword={}, page={}, size={}",
                categoryId, difficulty, keyword, page, size);
        return questionMapper.selectPage(mpPage, wrapper);
    }

    /**
     * 获取题目详情。同时异步累加浏览次数。
     *
     * @throws BusinessException 题目不存在时抛 404
     */
    public Question getById(Long id) {
        Question question = questionMapper.selectById(id);
        if (question == null) {
            log.warn("题目不存在，id={}", id);
            throw new BusinessException(404, "题目不存在");
        }
        viewCountService.increment(id);
        log.info("查看题目详情，id={}, title={}", id, question.getTitle());
        return question;
    }

    /**
     * 获取热门题目 Top N。结果缓存到 Redis，TTL 10 分钟。
     */
    @Cacheable(value = "hotQuestions")
    public List<Question> getHot(int size) {
        log.info("缓存未命中，从数据库加载热门题目 Top {}", size);
        return questionMapper.selectHot(size);
    }
}

    public Category getById(Long id) {
        return categoryRepository.findById(id)
                .orElseThrow(() -> new BusinessException(404, "分类不存在"));
    }
}
```

- [ ] **步骤 2：QuestionService（MyBatis-Plus 分页 + LambdaQueryWrapper + 日志）**

```java
package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.core.toolkit.StringUtils;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.lcbinterview.common.BusinessException;
import com.lcbinterview.mapper.QuestionMapper;
import com.lcbinterview.model.Question;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

/**
 * 题目 Service。处理题目的分页搜索、详情查看、热门排行等业务。
 * 查询方法标记 @Transactional(readOnly = true) 提升性能。
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class QuestionService {

    private final QuestionMapper questionMapper;
    private final ViewCountService viewCountService;

    /**
     * 分页搜索题目。支持分类筛选、难度筛选、关键词模糊搜索、标签筛选。
     * 所有筛选条件均为可选，动态拼接 SQL（MyBatis-Plus LambdaQueryWrapper）。
     */
    public IPage<Question> search(Long categoryId, String difficulty, String keyword,
                                   Long tagId, int page, int size) {
        Page<Question> mpPage = new Page<>(page, size);

        // 标签筛选走自定义 JOIN SQL
        if (tagId != null) {
            log.info("按标签筛选题目，tagId={}, page={}, size={}", tagId, page, size);
            List<Question> list = questionMapper.selectByTagId(tagId);
            mpPage.setRecords(list);
            mpPage.setTotal(list.size());
            return mpPage;
        }

        // 通用搜索用 LambdaQueryWrapper 动态拼条件
        LambdaQueryWrapper<Question> wrapper = new LambdaQueryWrapper<Question>()
                .eq(categoryId != null, Question::getCategoryId, categoryId)
                .eq(StringUtils.isNotBlank(difficulty), Question::getDifficulty, difficulty)
                .and(StringUtils.isNotBlank(keyword), w ->
                        w.like(Question::getTitle, keyword)
                         .or()
                         .like(Question::getContent, keyword)
                )
                .orderByDesc(Question::getCreateTime);

        log.info("搜索题目: categoryId={}, difficulty={}, keyword={}, page={}, size={}",
                categoryId, difficulty, keyword, page, size);
        return questionMapper.selectPage(mpPage, wrapper);
    }

    /**
     * 获取题目详情。同时异步累加浏览次数。
     *
     * @throws BusinessException 题目不存在时抛 404
     */
    public Question getById(Long id) {
        Question question = questionMapper.selectById(id);
        if (question == null) {
            log.warn("题目不存在，id={}", id);
            throw new BusinessException(404, "题目不存在");
        }
        viewCountService.increment(id);
        log.info("查看题目详情，id={}, title={}", id, question.getTitle());
        return question;
    }

    /**
     * 获取热门题目 Top N。结果缓存到 Redis，TTL 10 分钟。
     */
    @Cacheable(value = "hotQuestions")
    public List<Question> getHot(int size) {
        log.info("缓存未命中，从数据库加载热门题目 Top {}", size);
        return questionMapper.selectHot(size);
    }
}
```

- [ ] **步骤 3：ViewCountService（生产者-消费者模式 + 定时批量写入防热点）**

```java
package com.lcbinterview.service;

import com.lcbinterview.mapper.QuestionMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 浏览次数计数器。
 * <p>
 * 采用生产者-消费者模式避免高并发下热点行锁：
 * <ul>
 *   <li>生产者 — increment() 每次浏览请求触发，内存累加无锁竞争</li>
 *   <li>消费者 — flush() 每隔 5 分钟批量写入 DB</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ViewCountService {

    private final QuestionMapper questionMapper;
    private final Map<Long, Integer> buffer = new ConcurrentHashMap<>();

    /**
     * 累加题目浏览次数。线程安全，无锁。
     *
     * @param questionId 题目 ID
     */
    public void increment(Long questionId) {
        buffer.merge(questionId, 1, Integer::sum);
    }

    /**
     * 定时批量写入浏览数到数据库。每 5 分钟执行一次。
     * 使用 Map.copyOf 创建快照后清空 buffer，避免写操作阻塞读请求。
     */
    @Scheduled(fixedRate = 300_000)
    @Transactional
    public void flush() {
        if (buffer.isEmpty()) {
            return;
        }
        var snapshot = Map.copyOf(buffer);
        buffer.clear();
        int updated = 0;
        for (var entry : snapshot.entrySet()) {
            Question question = questionMapper.selectById(entry.getKey());
            if (question != null) {
                question.setViewCount(question.getViewCount() + entry.getValue());
                questionMapper.updateById(question);
                updated++;
            }
        }
        log.info("定时刷新浏览数完成，共更新 {} 道题（缓存 {} 道）", updated, snapshot.size());
    }
}
```

---

### 任务 6：DTO 和 Controller 层

**文件：**
- 创建：`backend/src/main/java/com/lcbinterview/dto/QuestionQuery.java`
- 创建：`backend/src/main/java/com/lcbinterview/dto/QuestionVO.java`
- 创建：`backend/src/main/java/com/lcbinterview/dto/PageResult.java`
- 创建：`backend/src/main/java/com/lcbinterview/controller/CategoryController.java`
- 创建：`backend/src/main/java/com/lcbinterview/controller/QuestionController.java`
- 创建：`backend/src/main/java/com/lcbinterview/controller/TagController.java`

- [ ] **步骤 1：QuestionQuery（JDK 21 record + Builder 模式）**

```java
package com.lcbinterview.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Builder;

@Builder
@Schema(description = "题目查询参数")
public record QuestionQuery(
        @Schema(description = "分类 ID") Long category,
        @Schema(description = "难度：EASY / MEDIUM / HARD") String difficulty,
        @Schema(description = "搜索关键词") String keyword,
        @Schema(description = "标签 ID") Long tag,
        @Builder.Default @Schema(description = "页码（从 0 开始）") Integer page,
        @Builder.Default @Schema(description = "每页条数") Integer size
) {
    public QuestionQuery {
        if (page == null) { page = 0; }
        if (size == null) { size = 20; }
    }
}
```

- [ ] **步骤 2：PageResult（JDK 21 record）**

```java
package com.lcbinterview.dto;

import com.baomidou.mybatisplus.core.metadata.IPage;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(description = "分页结果")
public record PageResult<T>(
        @Schema(description = "数据列表") List<T> content,
        @Schema(description = "当前页码") int page,
        @Schema(description = "每页大小") int size,
        @Schema(description = "总记录数") long total,
        @Schema(description = "总页数") int totalPages
) {
    public static <T> PageResult<T> of(IPage<?> page, List<T> content) {
        return new PageResult<>(
                content, (int) page.getCurrent(), (int) page.getSize(),
                page.getTotal(), (int) page.getPages());
    }
}
```

- [ ] **步骤 3：QuestionVO（JDK 21 record）**

```java
package com.lcbinterview.dto;

import com.lcbinterview.model.Question;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 题目视图对象，对外展示不暴露 Entity 内部结构。
 * 由 Service 层组装 categoryName 和 tags。
 */
@Schema(description = "题目视图对象")
public record QuestionVO(
        @Schema(description = "题目 ID") Long id,
        @Schema(description = "标题") String title,
        @Schema(description = "题目内容，Markdown 格式") String content,
        @Schema(description = "答案，Markdown 格式") String answer,
        @Schema(description = "难度") String difficulty,
        @Schema(description = "分类 ID") Long categoryId,
        @Schema(description = "分类名称") String categoryName,
        @Schema(description = "标签列表") List<String> tags,
        @Schema(description = "浏览次数") Integer viewCount,
        @Schema(description = "创建时间") LocalDateTime createTime
) {
    /**
     * 从 Question 实体创建 VO，需要外部传入分类名称和标签列表。
     */
    public static QuestionVO from(Question question, String categoryName, List<String> tags) {
        return new QuestionVO(
                question.getId(), question.getTitle(),
                question.getContent(), question.getAnswer(),
                question.getDifficulty(), question.getCategoryId(),
                categoryName, tags,
                question.getViewCount(), question.getCreateTime()
        );
    }
}
```

- [ ] **步骤 4：CategoryController（统一使用 ResponseEntity + ApiResponse）**

```java
package com.lcbinterview.controller;

import com.lcbinterview.common.ApiResponse;
import com.lcbinterview.model.Category;
import com.lcbinterview.service.CategoryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

/**
 * 分类管理接口。
 */
@Slf4j
@Tag(name = "分类管理")
@RestController
@RequestMapping("/api/categories")
@RequiredArgsConstructor
public class CategoryController {

    private final CategoryService categoryService;

    @Operation(summary = "获取全部分类")
    @GetMapping
    public ResponseEntity<ApiResponse<List<Category>>> getAll() {
        List<Category> list = categoryService.getAll();
        log.info("查询全部分类，共 {} 条", list.size());
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @Operation(summary = "获取分类详情")
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<Category>> getById(@PathVariable Long id) {
        Category category = categoryService.getById(id);
        return ResponseEntity.ok(ApiResponse.success(category));
    }
}
```

- [ ] **步骤 5：QuestionController（MyBatis-Plus IPage）**

```java
package com.lcbinterview.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.lcbinterview.common.ApiResponse;
import com.lcbinterview.dto.PageResult;
import com.lcbinterview.dto.QuestionQuery;
import com.lcbinterview.dto.QuestionVO;
import com.lcbinterview.model.Question;
import com.lcbinterview.service.QuestionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

/**
 * 题目管理接口。提供分页搜索、详情查看、热门排行。
 */
@Slf4j
@Tag(name = "题目管理")
@RestController
@RequestMapping("/api/questions")
@RequiredArgsConstructor
public class QuestionController {

    private final QuestionService questionService;

    @Operation(summary = "分页查询题目（含搜索、筛选）")
    @GetMapping
    public ResponseEntity<ApiResponse<PageResult<QuestionVO>>> list(@Valid QuestionQuery query) {
        IPage<Question> page = questionService.search(
                query.category(), query.difficulty(), query.keyword(),
                query.tag(), query.page(), query.size());
        List<QuestionVO> list = page.getRecords().stream()
                .map(q -> QuestionVO.from(q, null, List.of()))
                .toList();
        log.info("搜索题目返回 {} 条（共 {} 条）", list.size(), page.getTotal());
        return ResponseEntity.ok(ApiResponse.success(PageResult.of(page, list)));
    }

    @Operation(summary = "获取题目详情")
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<QuestionVO>> getById(@PathVariable Long id) {
        Question question = questionService.getById(id);
        return ResponseEntity.ok(ApiResponse.success(
                QuestionVO.from(question, null, List.of())));
    }

    @Operation(summary = "获取热门题目排行")
    @GetMapping("/hot")
    public ResponseEntity<ApiResponse<List<QuestionVO>>> getHot(
            @RequestParam(defaultValue = "10") int size) {
        List<Question> list = questionService.getHot(size);
        List<QuestionVO> vos = list.stream()
                .map(q -> QuestionVO.from(q, null, List.of()))
                .toList();
        log.info("查询热门题目 Top {}", size);
        return ResponseEntity.ok(ApiResponse.success(vos));
    }
}
```

- [ ] **步骤 6：TagController**

```java
package com.lcbinterview.controller;

import com.lcbinterview.common.ApiResponse;
import com.lcbinterview.mapper.TagMapper;
import com.lcbinterview.model.Tag;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

/**
 * 标签管理接口。
 */
@Slf4j
@Tag(name = "标签管理")
@RestController
@RequestMapping("/api/tags")
@RequiredArgsConstructor
public class TagController {

    private final TagMapper tagMapper;

    @Operation(summary = "获取所有标签")
    @GetMapping
    public ResponseEntity<ApiResponse<List<Tag>>> getAll() {
        List<Tag> list = tagMapper.selectList(null);
        log.info("查询全部分类 Tag，共 {} 条", list.size());
        return ResponseEntity.ok(ApiResponse.success(list));
    }
}
```

---

### 任务 7：数据库建表 + 种子数据（手动执行）

**说明：** 本任务需要手动在 MySQL 中创建数据库并执行 SQL 脚本，不通过 Spring Boot 自动执行。

MyBatis-Plus 不自动建表（区别于 JPA 的 ddl-auto），需手动执行 SQL 脚本初始化数据库。

**文件：**
- 创建：`backend/src/main/resources/schema.sql`
- 创建：`backend/src/main/resources/data.sql`

- [ ] **步骤 1：创建 schema.sql（建表 DDL，含完整字段定义和索引）**

```sql
-- 题库分类表
CREATE TABLE IF NOT EXISTS category (
    id          BIGINT       AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
    name        VARCHAR(50)  NOT NULL UNIQUE            COMMENT '分类名称',
    icon        VARCHAR(255) DEFAULT ''                 COMMENT '图标 URL',
    description VARCHAR(500) DEFAULT ''                 COMMENT '分类描述',
    sort_order  INT          DEFAULT 0                  COMMENT '排序权重',
    create_time DATETIME     NOT NULL                   COMMENT '创建时间',
    update_time DATETIME     NOT NULL                   COMMENT '更新时间',
    is_deleted  TINYINT(1)   DEFAULT 0                  COMMENT '逻辑删除标记',
    INDEX idx_sort_order (sort_order)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '题库分类';

-- 标签表
CREATE TABLE IF NOT EXISTS tag (
    id          BIGINT       AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
    name        VARCHAR(50)  NOT NULL UNIQUE            COMMENT '标签名称',
    create_time DATETIME     NOT NULL                   COMMENT '创建时间',
    update_time DATETIME     NOT NULL                   COMMENT '更新时间',
    is_deleted  TINYINT(1)   DEFAULT 0                  COMMENT '逻辑删除标记'
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '题目标签';

-- 题目表
CREATE TABLE IF NOT EXISTS question (
    id          BIGINT       AUTO_INCREMENT PRIMARY KEY COMMENT '主键',
    category_id BIGINT       NOT NULL                   COMMENT '关联分类 ID',
    title       VARCHAR(500) NOT NULL                   COMMENT '题目标题',
    content     TEXT         NOT NULL                   COMMENT '题目内容（Markdown）',
    answer      TEXT         NOT NULL                   COMMENT '题目答案（Markdown）',
    difficulty  VARCHAR(20)  NOT NULL DEFAULT 'MEDIUM'  COMMENT '难度：EASY/MEDIUM/HARD',
    view_count  INT          DEFAULT 0                  COMMENT '浏览次数',
    create_time DATETIME     NOT NULL                   COMMENT '创建时间',
    update_time DATETIME     NOT NULL                   COMMENT '更新时间',
    is_deleted  TINYINT(1)   DEFAULT 0                  COMMENT '逻辑删除标记',
    INDEX idx_category (category_id),
    INDEX idx_difficulty (difficulty),
    INDEX idx_view_count (view_count DESC),
    INDEX idx_create_time (create_time DESC)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '面试题目';

-- 题目-标签关联表
CREATE TABLE IF NOT EXISTS question_tag (
    question_id BIGINT NOT NULL COMMENT '题目 ID',
    tag_id      BIGINT NOT NULL COMMENT '标签 ID',
    PRIMARY KEY (question_id, tag_id),
    INDEX idx_tag_id (tag_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = '题目标签关联';
```

- [ ] **步骤 2：创建 data.sql（种子数据，含 is_deleted = 0 默认值）**

```sql
-- 题库分类
INSERT INTO category (name, icon, description, sort_order, create_time, update_time) VALUES
('Java 基础', 'https://via.placeholder.com/64?text=Java', 'Java 基础面试题，涵盖数据类型、面向对象、集合框架等', 1, NOW(), NOW()),
('MySQL', 'https://via.placeholder.com/64?text=SQL', 'MySQL 数据库面试题，包括索引、事务、SQL 优化等', 2, NOW(), NOW()),
('Redis', 'https://via.placeholder.com/64?text=Redis', 'Redis 缓存面试题，包括数据结构、持久化、集群等', 3, NOW(), NOW()),
('Spring', 'https://via.placeholder.com/64?text=Spring', 'Spring 框架面试题，包括 IoC、AOP、事务管理等', 4, NOW(), NOW());

-- 标签
INSERT INTO tag (name, create_time, update_time) VALUES
('Java', NOW(), NOW()), ('集合', NOW(), NOW()), ('多线程', NOW(), NOW()),
('JVM', NOW(), NOW()), ('索引', NOW(), NOW()), ('事务', NOW(), NOW()),
('缓存', NOW(), NOW()), ('IoC', NOW(), NOW()), ('AOP', NOW(), NOW()),
('分布式', NOW(), NOW()), ('数据结构', NOW(), NOW()), ('算法', NOW(), NOW());

-- 题目
INSERT INTO question (category_id, title, content, answer, difficulty, view_count, create_time, update_time) VALUES
(1, '说说 Java 中 HashMap 的原理？',
'请详细说明 HashMap 的底层数据结构、put 和 get 的流程、扩容机制。',
'## HashMap 原理\n\n### 底层结构\n- JDK 1.7：数组 + 链表\n- JDK 1.8：数组 + 链表 + 红黑树（链表长度 > 8 时转红黑树）\n\n### put 流程\n1. 计算 key 的 hash 值\n2. 对数组长度取模找到桶位置\n3. 如果桶为空，直接放入\n4. 如果桶不为空，遍历链表/红黑树\n   - 如果 key 已存在，覆盖 value\n   - 如果 key 不存在，插入尾部（尾插法）\n5. 插入后检查是否超过阈值，超过则扩容\n\n### 扩容机制\n- 默认初始容量 16，负载因子 0.75\n- 扩容为原来的 2 倍\n- 需要 rehash 重新分配位置',
'MEDIUM', 5326, NOW(), NOW()),
(1, 'Java 中的序列化和反序列化是什么？',
'请解释 Java 序列化和反序列化的概念、用途以及注意事项。',
'## 序列化与反序列化\n\n**序列化**：将 Java 对象转换为字节序列，便于存储或网络传输。\n**反序列化**：将字节序列恢复为 Java 对象。\n\n### 实现方式\n- 实现 `Serializable` 接口\n- 使用 `ObjectOutputStream` / `ObjectInputStream`\n\n### 注意事项\n- 使用 `serialVersionUID` 控制版本兼容性\n- `transient` 关键字标记不需要序列化的字段\n- 静态变量不会被序列化\n- 父类实现了 Serializable，子类自动可序列化',
'EASY', 3350, NOW(), NOW()),
(1, 'Java 中 ConcurrentHashMap 1.7 和 1.8 之间有哪些区别？',
'请对比 ConcurrentHashMap 在 JDK 1.7 和 1.8 中的实现差异。',
'## ConcurrentHashMap 1.7 vs 1.8\n\n### JDK 1.7\n- **分段锁（Segment）**：继承 ReentrantLock，将数据分为多个 Segment\n- 并发度默认为 16\n- 两次 hash 定位（先找 Segment，再找 Entry）\n\n### JDK 1.8\n- **CAS + synchronized**：放弃了 Segment，直接用 Node 数组\n- 锁粒度更细：只锁链表/红黑树的头节点\n- 引入红黑树优化 hash 冲突\n- 并发度更高，性能更好',
'MEDIUM', 2908, NOW(), NOW()),
(2, 'MySQL 索引的最左前缀匹配原则是什么？',
'请解释联合索引的最左前缀匹配原则及其对查询性能的影响。',
'## 最左前缀匹配原则\n\n联合索引 `(a, b, c)` 相当于创建了三个索引：\n- `(a)`\n- `(a, b)`\n- `(a, b, c)`\n\n### 匹配规则\n- 查询条件必须从索引的最左列开始\n- 遇到范围查询（>、<、between、like）会停止匹配\n\n### 示例\n```sql\nWHERE a = 1 AND b = 2 -- 走索引\nWHERE a = 1           -- 走索引\nWHERE b = 2           -- 不走索引（跳过了 a）\nWHERE a = 1 AND c = 3 -- 只用到 a 列索引\n```',
'MEDIUM', 3246, NOW(), NOW()),
(2, 'MySQL 的索引类型有哪些？',
'请列举 MySQL 支持的索引类型及其适用场景。',
'## MySQL 索引类型\n\n1. **B+Tree 索引**：最常用，支持全值匹配、范围查询、排序\n2. **Hash 索引**：Memory 引擎支持，精确匹配快，不支持范围查询\n3. **全文索引（Full-Text）**：用于大文本字段的模糊搜索\n4. **空间索引（R-Tree）**：MyISAM 引擎支持地理空间数据\n\n### 从功能角度分类\n- 主键索引（PRIMARY）\n- 唯一索引（UNIQUE）\n- 普通索引（INDEX）\n- 联合索引（复合索引）\n- 覆盖索引（Extra 显示 Using index）',
'EASY', 2941, NOW(), NOW());

-- 题目-标签关联
INSERT INTO question_tag (question_id, tag_id) VALUES
(1, 1), (1, 2), (2, 1), (3, 1), (3, 3),
(4, 5), (5, 5);
```

---

### 任务 8：前端项目初始化 + 依赖

**文件：**
- 创建：`frontend/package.json`
- 创建：`frontend/vite.config.ts`
- 创建：`frontend/index.html`
- 创建：`frontend/tsconfig.json`
- 创建：`frontend/src/main.tsx`

- [ ] **步骤 1：package.json**

```json
{
  "name": "lcb-interview-frontend",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "antd": "^5.12.0",
    "@ant-design/icons": "^5.2.6",
    "axios": "^1.6.0",
    "react-markdown": "^9.0.0",
    "rehype-highlight": "^7.0.0",
    "remark-gfm": "^4.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}
```

- [ ] **步骤 2：vite.config.ts（代理 API 到后端）**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
```

- [ ] **步骤 3：index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>LCB Interview - Java 面试题库</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

- [ ] **步骤 4：tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"]
}
```

- [ ] **步骤 5：main.tsx（入口，注入 Ant Design 主题 + 路由）**

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import App from './App'
import theme from './styles/theme'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider theme={theme}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ConfigProvider>
  </React.StrictMode>
)
```

- [ ] **步骤 6：安装依赖并验证**

```bash
cd frontend
npm install
npm run dev
```
预期：Vite 启动成功，访问 localhost:3000 看到空白页（路由未配置）。

---

### 任务 9：前端 API 层 + 主题配置

**文件：**
- 创建：`frontend/src/types.ts`
- 创建：`frontend/src/api/index.ts`
- 创建：`frontend/src/api/category.ts`
- 创建：`frontend/src/api/question.ts`
- 创建：`frontend/src/api/tag.ts`
- 创建：`frontend/src/styles/theme.ts`

- [ ] **步骤 1：类型定义（与后端 VO 对齐）**

```typescript
// src/types.ts
export interface Category {
  id: number
  name: string
  icon: string
  description: string
  sortOrder: number
}

export interface Tag {
  id: number
  name: string
}

export interface Question {
  id: number
  title: string
  content: string
  answer: string
  difficulty: string
  categoryName: string
  tags: string[]
  viewCount: number
  createTime: string
}

export interface PageResult<T> {
  content: T[]
  page: number
  size: number
  total: number
  totalPages: number
}
```

- [ ] **步骤 2：API 基础配置（Axios 实例）**

```typescript
// src/api/index.ts
import axios from 'axios'
import { message } from 'antd'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

api.interceptors.response.use(
  (res) => {
    if (res.data.code !== 200) {
      message.error(res.data.message || '请求失败')
      return Promise.reject(new Error(res.data.message))
    }
    return res
  },
  (err) => {
    message.error('网络错误，请稍后重试')
    return Promise.reject(err)
  }
)

export default api
```

- [ ] **步骤 3：分类 API**

```typescript
// src/api/category.ts
import api from './index'
import { Category } from '../types'

export const getCategories = () =>
  api.get<{ data: Category[] }>('/categories').then(res => res.data.data)

export const getCategoryById = (id: number) =>
  api.get<{ data: Category }>(`/categories/${id}`).then(res => res.data.data)
```

- [ ] **步骤 4：题目 API**

```typescript
// src/api/question.ts
import api from './index'
import { Question, PageResult } from '../types'

export interface QuestionQuery {
  category?: number
  difficulty?: string
  keyword?: string
  tag?: number
  page?: number
  size?: number
}

export const getQuestions = (params: QuestionQuery) =>
  api.get<{ data: PageResult<Question> }>('/questions', { params })
    .then(res => res.data.data)

export const getQuestionById = (id: number) =>
  api.get<{ data: Question }>(`/questions/${id}`).then(res => res.data.data)

export const getHotQuestions = (size = 10) =>
  api.get<{ data: PageResult<Question> }>('/questions/hot', { params: { size } })
    .then(res => res.data.data)
```

- [ ] **步骤 5：标签 API**

```typescript
// src/api/tag.ts
import api from './index'
import { Tag } from '../types'

export const getTags = () =>
  api.get<{ data: Tag[] }>('/tags').then(res => res.data.data)
```

- [ ] **步骤 6：Ant Design 5 主题**

```typescript
// src/styles/theme.ts
import type { ThemeConfig } from 'antd'

const theme: ThemeConfig = {
  token: {
    colorPrimary: '#1677ff',
    borderRadius: 8,
    fontSize: 14,
  },
  components: {
    Card: {
      paddingLG: 20,
    },
  },
}

export default theme
```

---

### 任务 10：Layout 组件 + 路由

**文件：**
- 创建：`frontend/src/App.tsx`
- 创建：`frontend/src/components/Layout/index.tsx`
- 创建：`frontend/src/components/Layout/Header.tsx`
- 创建：`frontend/src/components/Layout/SideMenu.tsx`

- [ ] **步骤 1：App.tsx（路由定义）**

```typescript
import { Routes, Route } from 'react-router-dom'
import AppLayout from './components/Layout'
import Home from './pages/Home'
import QuestionBank from './pages/QuestionBank'
import QuestionList from './pages/QuestionList'
import QuestionDetail from './pages/QuestionDetail'
import SearchResult from './pages/SearchResult'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/banks" element={<QuestionBank />} />
        <Route path="/bank/:id" element={<QuestionList />} />
        <Route path="/question/:id" element={<QuestionDetail />} />
        <Route path="/search" element={<SearchResult />} />
      </Route>
    </Routes>
  )
}
```

- [ ] **步骤 2：Layout 壳组件**

```typescript
import { Outlet } from 'react-router-dom'
import { Layout } from 'antd'
import AppHeader from './Header'
import SideMenu from './SideMenu'

const { Content, Sider } = Layout

export default function AppLayout() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <AppHeader />
      <Layout>
        <Sider breakpoint="lg" collapsedWidth={0} style={{ background: '#fff' }}>
          <SideMenu />
        </Sider>
        <Content style={{ padding: '24px', margin: 0, minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
```

- [ ] **步骤 3：AppHeader（Logo + 搜索）**

```typescript
import { Layout, Input, theme } from 'antd'
import { useNavigate } from 'react-router-dom'
import { BookOutlined } from '@ant-design/icons'

const { Header } = Layout

export default function AppHeader() {
  const navigate = useNavigate()
  const { token } = theme.useToken()

  return (
    <Header style={{
      background: token.colorBgContainer,
      display: 'flex',
      alignItems: 'center',
      padding: '0 24px',
      borderBottom: `1px solid ${token.colorBorderSecondary}`,
    }}>
      <div style={{ fontSize: 20, fontWeight: 'bold', cursor: 'pointer', marginRight: 32 }}
           onClick={() => navigate('/')}>
        <BookOutlined /> LCB Interview
      </div>
      <Input.Search
        placeholder="搜索面试题..."
        onSearch={(value) => navigate(`/search?q=${encodeURIComponent(value)}`)}
        style={{ maxWidth: 400 }}
      />
    </Header>
  )
}
```

- [ ] **步骤 4：SideMenu（侧边导航）**

```typescript
import { Menu } from 'antd'
import { useNavigate, useLocation } from 'react-router-dom'
import { BookOutlined, FireOutlined } from '@ant-design/icons'

const items = [
  { key: '/', icon: <FireOutlined />, label: '热门' },
  { key: '/banks', icon: <BookOutlined />, label: '题库' },
]

export default function SideMenu() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <Menu
      mode="inline"
      selectedKeys={[location.pathname]}
      items={items}
      onClick={({ key }) => navigate(key)}
      style={{ borderInlineEnd: 'none' }}
    />
  )
}
```

---

### 任务 11：首页

**文件：**
- 创建：`frontend/src/pages/Home/index.tsx`
- 创建：`frontend/src/pages/Home/CategoryGrid.tsx`
- 创建：`frontend/src/pages/Home/HotQuestions.tsx`

- [ ] **步骤 1：Home 首页**

```typescript
import { Typography } from 'antd'
import CategoryGrid from './CategoryGrid'
import HotQuestions from './HotQuestions'

const { Title } = Typography

export default function Home() {
  return (
    <div>
      <Title level={3}>热门面试题库</Title>
      <CategoryGrid />
      <Title level={4} style={{ marginTop: 32 }}>热门题目排行榜</Title>
      <HotQuestions />
    </div>
  )
}
```

- [ ] **步骤 2：CategoryGrid（题库分类网格）**

```typescript
import { useEffect, useState } from 'react'
import { Card, Row, Col, Spin } from 'antd'
import { useNavigate } from 'react-router-dom'
import { getCategories } from '../../api/category'
import type { Category } from '../../types'

export default function CategoryGrid() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    getCategories().then(data => {
      setCategories(data)
      setLoading(false)
    })
  }, [])

  if (loading) return <Spin />

  return (
    <Row gutter={[16, 16]}>
      {categories.map(cat => (
        <Col xs={24} sm={12} md={8} lg={6} key={cat.id}>
          <Card hoverable onClick={() => navigate(`/bank/${cat.id}`)}>
            <Card.Meta
              avatar={<img src={cat.icon} alt="" style={{ width: 48, height: 48 }} />}
              title={cat.name}
              description={cat.description}
            />
          </Card>
        </Col>
      ))}
    </Row>
  )
}
```

- [ ] **步骤 3：HotQuestions（热门排行榜）**

```typescript
import { useEffect, useState } from 'react'
import { List, Spin, Tag } from 'antd'
import { useNavigate } from 'react-router-dom'
import { getHotQuestions } from '../../api/question'
import type { Question } from '../../types'

export default function HotQuestions() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    getHotQuestions(10).then(res => {
      setQuestions(res.content)
      setLoading(false)
    })
  }, [])

  if (loading) return <Spin />

  return (
    <List
      dataSource={questions}
      renderItem={(q, index) => (
        <List.Item onClick={() => navigate(`/question/${q.id}`)} style={{ cursor: 'pointer' }}>
          <List.Item.Meta
            title={<>{index + 1}. {q.title}</>}
            description={
              <>
                <Tag>{q.difficulty}</Tag>
                <Tag>{q.categoryName}</Tag>
                <span style={{ marginLeft: 8 }}>👁 {q.viewCount}</span>
              </>
            }
          />
        </List.Item>
      )}
    />
  )
}
```

---

### 任务 12：题库列表和题目详情

**文件：**
- 创建：`frontend/src/pages/QuestionBank/index.tsx`
- 创建：`frontend/src/pages/QuestionList/index.tsx`
- 创建：`frontend/src/pages/QuestionDetail/index.tsx`
- 创建：`frontend/src/pages/SearchResult/index.tsx`

- [ ] **步骤 1：QuestionBank（题库列表）**

```typescript
import { useEffect, useState } from 'react'
import { Card, Row, Col, Spin } from 'antd'
import { useNavigate } from 'react-router-dom'
import { getCategories } from '../../api/category'
import type { Category } from '../../types'

export default function QuestionBank() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    getCategories().then(data => {
      setCategories(data)
      setLoading(false)
    })
  }, [])

  if (loading) return <Spin />

  return (
    <Row gutter={[16, 16]}>
      {categories.map(cat => (
        <Col xs={24} sm={12} md={8} key={cat.id}>
          <Card hoverable onClick={() => navigate(`/bank/${cat.id}`)}>
            <Card.Meta title={cat.name} description={cat.description} />
          </Card>
        </Col>
      ))}
    </Row>
  )
}
```

- [ ] **步骤 2：QuestionList（分页 + 难度筛选）**

```typescript
import { useEffect, useState } from 'react'
import { List, Tag, Select, Space, Spin, Pagination } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'
import { getQuestions } from '../../api/question'
import type { Question } from '../../types'

export default function QuestionList() {
  const { id } = useParams()
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [difficulty, setDifficulty] = useState<string>()
  const navigate = useNavigate()

  useEffect(() => {
    setLoading(true)
    getQuestions({ category: Number(id), difficulty, page: page - 1, size: 20 }).then(res => {
      setQuestions(res.content)
      setTotal(res.total)
      setLoading(false)
    })
  }, [id, difficulty, page])

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Select
          placeholder="难度筛选"
          allowClear
          style={{ width: 120 }}
          onChange={(v) => { setDifficulty(v); setPage(1) }}
          options={[
            { value: 'EASY', label: '简单' },
            { value: 'MEDIUM', label: '中等' },
            { value: 'HARD', label: '困难' },
          ]}
        />
      </Space>
      <Spin spinning={loading}>
        <List
          dataSource={questions}
          renderItem={q => (
            <List.Item onClick={() => navigate(`/question/${q.id}`)} style={{ cursor: 'pointer' }}>
              <List.Item.Meta
                title={q.title}
                description={
                  <>
                    <Tag color={q.difficulty === 'EASY' ? 'green' : q.difficulty === 'MEDIUM' ? 'orange' : 'red'}>
                      {q.difficulty === 'EASY' ? '简单' : q.difficulty === 'MEDIUM' ? '中等' : '困难'}
                    </Tag>
                    {q.tags.map(t => <Tag key={t}>{t}</Tag>)}
                    <span style={{ marginLeft: 8 }}>👁 {q.viewCount}</span>
                  </>
                }
              />
            </List.Item>
          )}
        />
        <Pagination
          current={page}
          total={total}
          pageSize={20}
          onChange={p => setPage(p)}
          showTotal={t => `共 ${t} 条`}
        />
      </Spin>
    </div>
  )
}
```

- [ ] **步骤 3：QuestionDetail（Markdown 渲染 + 折叠答案）**

```typescript
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Card, Spin, Collapse, Tag, Typography } from 'antd'
import Markdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import { getQuestionById } from '../../api/question'
import type { Question } from '../../types'

const { Title } = Typography

export default function QuestionDetail() {
  const { id } = useParams()
  const [q, setQ] = useState<Question | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getQuestionById(Number(id)).then(data => {
      setQ(data)
      setLoading(false)
    })
  }, [id])

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />
  if (!q) return <div>题目不存在</div>

  return (
    <Card>
      <Title level={4}>{q.title}</Title>
      <div style={{ marginBottom: 16 }}>
        <Tag>{q.categoryName}</Tag>
        <Tag color={q.difficulty === 'EASY' ? 'green' : 'orange'}>{q.difficulty}</Tag>
        {q.tags.map(t => <Tag key={t}>{t}</Tag>)}
        <span style={{ marginLeft: 8, color: '#999' }}>浏览 {q.viewCount} 次</span>
      </div>
      <div style={{ marginBottom: 24 }}>
        <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
          {q.content}
        </Markdown>
      </div>
      <Collapse
        items={[{
          key: 'answer',
          label: '查看答案',
          children: (
            <div style={{ padding: 16, background: '#f6f8fa', borderRadius: 8 }}>
              <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                {q.answer}
              </Markdown>
            </div>
          ),
        }]}
      />
    </Card>
  )
}
```

- [ ] **步骤 4：SearchResult（搜索结果）**

```typescript
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { List, Spin, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import { getQuestions } from '../../api/question'
import type { Question } from '../../types'

const { Title } = Typography

export default function SearchResult() {
  const [searchParams] = useSearchParams()
  const keyword = searchParams.get('q') || ''
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    if (!keyword) return
    setLoading(true)
    getQuestions({ keyword, page: 0, size: 20 }).then(res => {
      setQuestions(res.content)
      setLoading(false)
    })
  }, [keyword])

  return (
    <div>
      <Title level={4}>搜索：{keyword}</Title>
      <Spin spinning={loading}>
        <List
          dataSource={questions}
          renderItem={q => (
            <List.Item onClick={() => navigate(`/question/${q.id}`)} style={{ cursor: 'pointer' }}>
              <List.Item.Meta title={q.title} description={q.categoryName} />
            </List.Item>
          )}
          locale={{ emptyText: '未找到相关题目' }}
        />
      </Spin>
    </div>
  )
}
```

---

### 任务 13：Nginx 部署配置

**文件：**
- 创建：`frontend/nginx.conf`

- [ ] **步骤 1：nginx.conf（SPA 路由 + API 反向代理 + 静态缓存）**

```nginx
server {
    listen 80;
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html;

    # SPA 路由：所有非文件请求返回 index.html，防止刷新 404
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 反向代理到后端
    location /api/ {
        proxy_pass http://backend:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # 静态资源缓存
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

---

### 任务 14：最终集成验证

- [ ] **步骤 0：手动执行 SQL 初始化数据库**

```sql
-- 1. 创建数据库
CREATE DATABASE IF NOT EXISTS lcb_interview DEFAULT CHARSET utf8mb4;

-- 2. 执行 schema.sql 建表
mysql -u root -p lcb_interview < backend/src/main/resources/schema.sql

-- 3. 执行 data.sql 插入种子数据
mysql -u root -p lcb_interview < backend/src/main/resources/data.sql
```

- [ ] **步骤 1：启动后端**

```bash
cd backend
mvn spring-boot:run
```
预期：访问 `http://localhost:8080/api/categories` 返回 `{"code":200,"message":"success","data":[...]}`

- [ ] **步骤 2：启动前端**

```bash
cd frontend
npm run dev
```
预期：访问 `http://localhost:3000` 看到首页，展示题库分类和热门题目

- [ ] **步骤 3：验证全流程**

1. 首页显示题库分类卡片和热门题目排行榜
2. 点击分类卡片进入该分类题目列表
3. 难度下拉筛选正常，分页正常
4. 点击题目进入详情，Markdown + 代码高亮渲染正确
5. 点击"查看答案"折叠面板展示答案
6. 顶部搜索框输入关键词，搜索结果正确
7. 缩小浏览器窗口，确认响应式布局正常
8. 访问 `http://localhost:8080/swagger-ui.html` 可看到 API 文档

- [ ] **步骤 4：提交代码**

```bash
git add .
git commit -m "feat: mvp 面试题库网站前后端实现"
```
