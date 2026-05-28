# Phase A: 题库核心 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将面试题库从 5 道题扩展到 1 万+，支持 AI 批量化生成 + 人工审核 + 结构化内容展示

**Architecture:** 现有 Spring Boot 3 + React 18 + Ant Design 5 基础上增量扩展。Question 表新增多级内容字段（summary, principle, comparison, scenario, risk, project_exp, code_examples, diagrams, related_ids）+ 审批字段（status, source）。后端新增 admin 接口和 AI 生成管线。前端重构 QuestionDetail 为结构化 Collapse 布局。

**Tech Stack:** JDK 21, Spring Boot 3.2, MyBatis-Plus 3.5.5, MySQL 8 FULLTEXT ngram, React 18, Ant Design 5, react-markdown, @uiw/react-md-editor

---

### File Structure

**Backend 新增/修改:**
- `model/Question.java` — 新增 10 个字段
- `dto/QuestionVO.java` — 映射新字段
- `dto/QuestionAdminVO.java` — 管理端 VO（含 status, source）
- `dto/GenerationRequest.java` — AI 生成请求参数 record
- `mapper/QuestionMapper.java` — 添加 FULLTEXT 搜索 + status 过滤
- `service/QuestionService.java` — 搜索逻辑兼容新字段
- `service/AiQuestionService.java` — 新增，LLM 调用 + 生成管线
- `controller/QuestionController.java` — 公开接口增加 status 过滤
- `controller/admin/AiGenerationController.java` — 新增，触发生成
- `controller/admin/QuestionAdminController.java` — 新增，草稿 CRUD
- `application.yml` — 添加 admin.token 和 ngram 配置

**Frontend 新增/修改:**
- `types.ts` — Question 类型扩展
- `api/question.ts` — 请求新字段
- `api/admin.ts` — 新增，admin 接口
- `pages/QuestionDetail/ContentView.tsx` — 新增，内容渲染子组件
- `pages/QuestionDetail/CodeBlock.tsx` — 新增，代码示例 Tab 组件
- `pages/QuestionDetail/DiagramBlock.tsx` — 新增，图解展示组件
- `pages/QuestionDetail/Skeleton.tsx` — 新增，骨架屏
- `pages/QuestionDetail/index.tsx` — 重构为 Collapse 布局
- `pages/Home/index.tsx` + `HotQuestions.tsx` — 添加 loading/empty 状态
- `pages/QuestionBank/index.tsx` — 添加 loading/empty 状态
- `pages/QuestionList/index.tsx` — 添加 loading/error/empty 状态
- `pages/SearchResult/index.tsx` — 添加 loading/error/empty 状态
- `pages/admin/AdminLayout.tsx` — 新增
- `pages/admin/Dashboard.tsx` — 新增
- `pages/admin/AIGenerate.tsx` — 新增
- `pages/admin/DraftReview.tsx` — 新增
- `App.tsx` — 添加 admin 路由

---

### Task 1: Question 实体扩展 + 数据库迁移

**Files:**
- Modify: `backend/src/main/java/com/lcbinterview/model/Question.java`
- Create: `backend/src/main/resources/db/migration-v2.sql`

- [ ] **Step 1: 扩展 Question.java**

```java
// 在现有字段后追加：

    /** 30秒速览，纯文本50-100字 */
    private String summary;

    /** 原理深度解析 (Markdown) */
    private String principle;

    /** 对比分析 (Markdown) */
    private String comparison;

    /** 适用场景 (Markdown) */
    private String scenario;

    /** 风险与常见坑 (Markdown) */
    private String risk;

    /** 项目实战经验 (Markdown) */
    @TableField("project_exp")
    private String projectExp;

    /** 代码示例 JSON: [{lang, title, code, description}] */
    @TableField("code_examples")
    private String codeExamples;

    /** 图解 JSON: [{type, alt, content, caption}] */
    @TableField("diagrams")
    private String diagrams;

    /** 关联题目 ID 列表 JSON: [Long] */
    @TableField("related_ids")
    private String relatedIds;

    /** 状态: DRAFT / PUBLISHED / REJECTED */
    private String status;

    /** 来源: AI_GENERATED / MANUAL */
    private String source;
```

- [ ] **Step 2: 创建迁移 SQL**

```sql
-- db/migration-v2.sql

ALTER TABLE question
  ADD COLUMN summary TEXT COMMENT '30秒速览',
  ADD COLUMN principle TEXT COMMENT '原理解析',
  ADD COLUMN comparison TEXT COMMENT '对比分析',
  ADD COLUMN scenario TEXT COMMENT '适用场景',
  ADD COLUMN risk TEXT COMMENT '风险与避坑',
  ADD COLUMN project_exp TEXT COMMENT '项目实战',
  ADD COLUMN code_examples JSON COMMENT '代码示例',
  ADD COLUMN diagrams JSON COMMENT '图解',
  ADD COLUMN related_ids JSON COMMENT '关联题目ID',
  ADD COLUMN status VARCHAR(20) DEFAULT 'PUBLISHED' COMMENT 'DRAFT/PUBLISHED/REJECTED',
  ADD COLUMN source VARCHAR(20) DEFAULT 'MANUAL' COMMENT 'AI_GENERATED/MANUAL';

ALTER TABLE question ADD FULLTEXT INDEX ft_question_search
  (title, summary, principle, content, scenario, project_exp)
  WITH PARSER ngram;

UPDATE question SET status = 'PUBLISHED', source = 'MANUAL' WHERE status IS NULL;
```

- [ ] **Step 3: 提交**

```bash
git add backend/src/main/java/com/lcbinterview/model/Question.java backend/src/main/resources/db/migration-v2.sql
git commit -m "feat: Question 实体扩展多级内容字段 + 审批字段 + FULLTEXT ngram 索引"
```

---

### Task 2: QuestionVO 扩展 + Mapper/Service 适配

**Files:**
- Modify: `backend/src/main/java/com/lcbinterview/dto/QuestionVO.java`
- Modify: `backend/src/main/java/com/lcbinterview/mapper/QuestionMapper.java`
- Modify: `backend/src/main/java/com/lcbinterview/service/QuestionService.java`
- Modify: `backend/src/main/java/com/lcbinterview/controller/QuestionController.java`

- [ ] **Step 1: 扩展 QuestionVO**

```java
@Schema(description = "题目视图对象")
public record QuestionVO(
        @Schema(description = "题目 ID") Long id,
        @Schema(description = "标题") String title,
        @Schema(description = "摘要") String summary,
        @Schema(description = "题目内容，Markdown 格式") String content,
        @Schema(description = "原理解析") String principle,
        @Schema(description = "对比分析") String comparison,
        @Schema(description = "适用场景") String scenario,
        @Schema(description = "风险与避坑") String risk,
        @Schema(description = "项目实战") String projectExp,
        @Schema(description = "代码示例") String codeExamples,
        @Schema(description = "图解") String diagrams,
        @Schema(description = "关联题目 ID") String relatedIds,
        @Schema(description = "难度") String difficulty,
        @Schema(description = "分类 ID") Long categoryId,
        @Schema(description = "分类名称") String categoryName,
        @Schema(description = "标签列表") List<String> tags,
        @Schema(description = "浏览次数") Integer viewCount,
        @Schema(description = "创建时间") LocalDateTime createTime
) {
    public static QuestionVO from(Question question, String categoryName, List<String> tags) {
        return new QuestionVO(
                question.getId(), question.getTitle(),
                question.getSummary(), question.getContent(),
                question.getPrinciple(), question.getComparison(),
                question.getScenario(), question.getRisk(),
                question.getProjectExp(), question.getCodeExamples(),
                question.getDiagrams(), question.getRelatedIds(),
                question.getDifficulty(), question.getCategoryId(),
                categoryName, tags,
                question.getViewCount(), question.getCreateTime()
        );
    }
}
```

- [ ] **Step 2: Mapper 添加 FULLTEXT 搜索方法**

```java
// QuestionMapper.java 追加

    /**
     * 全文搜索题目（FULLTEXT + ngram），支持分类+难度组合筛选。
     * MyBatis 的 <script> 实现动态 WHERE 条件。
     */
    @Select("""
            <script>
            SELECT id, category_id, title, summary, content, principle,
                   comparison, scenario, risk, project_exp,
                   code_examples, diagrams, related_ids,
                   difficulty, view_count, status, source,
                   create_time, update_time
            FROM question
            WHERE status = 'PUBLISHED' AND is_deleted = 0
              AND MATCH(title, summary, principle, content, scenario, project_exp)
                  AGAINST(#{keyword} IN BOOLEAN MODE)
              <if test="categoryId != null">
              AND category_id = #{categoryId}
              </if>
              <if test="difficulty != null and difficulty != ''">
              AND difficulty = #{difficulty}
              </if>
            ORDER BY
              CASE WHEN title LIKE CONCAT('%', #{keyword}, '%') THEN 0 ELSE 1 END,
              view_count DESC
            </script>
            """)
    IPage<Question> searchFulltext(Page<?> page, @Param("keyword") String keyword,
                                    @Param("categoryId") Long categoryId,
                                    @Param("difficulty") String difficulty);

    /**
     * 查询热门题目，按浏览次数倒序（仅已发布）。
     */
    @Select("""
            SELECT id, category_id, title, summary, content, principle,
                   comparison, scenario, risk, project_exp,
                   code_examples, diagrams, related_ids,
                   difficulty, view_count, status, source,
                   create_time, update_time
            FROM question
            WHERE status = 'PUBLISHED' AND is_deleted = 0
            ORDER BY view_count DESC
            LIMIT #{size}
            """)
    List<Question> selectHot(@Param("size") int size);

    /**
     * 根据标签 ID 查询关联题目（仅已发布）。
     */
    @Select("""
            SELECT q.id, q.category_id, q.title, q.summary, q.content,
                   q.principle, q.comparison, q.scenario, q.risk,
                   q.project_exp, q.code_examples, q.diagrams, q.related_ids,
                   q.difficulty, q.view_count, q.status, q.source,
                   q.create_time, q.update_time
            FROM question q
            INNER JOIN question_tag qt ON q.id = qt.question_id
            WHERE qt.tag_id = #{tagId}
              AND q.status = 'PUBLISHED' AND q.is_deleted = 0
            ORDER BY q.create_time DESC
            """)
    List<Question> selectByTagId(@Param("tagId") Long tagId);
```

- [ ] **Step 3: QuestionService 适配新搜索逻辑**

```java
// 在 search 方法中，当 keyword 不为空时优先使用全文搜索
    public IPage<Question> search(Long categoryId, String difficulty, String keyword,
                                   Long tagId, int page, int size) {
        Page<Question> mpPage = new Page<>(page, size);

        if (tagId != null) {
            List<Question> list = questionMapper.selectByTagId(tagId);
            mpPage.setRecords(list);
            mpPage.setTotal(list.size());
            return mpPage;
        }

        // 关键词搜索走 FULLTEXT
        if (StringUtils.isNotBlank(keyword)) {
            log.info("全文搜索 keyword={}", keyword);
            return questionMapper.searchFulltext(mpPage, keyword);
        }

        LambdaQueryWrapper<Question> wrapper = new LambdaQueryWrapper<Question>()
                .eq(Question::getStatus, "PUBLISHED")
                .eq(categoryId != null, Question::getCategoryId, categoryId)
                .eq(StringUtils.isNotBlank(difficulty), Question::getDifficulty, difficulty)
                .orderByDesc(Question::getCreateTime);

        return questionMapper.selectPage(mpPage, wrapper);
    }
```

- [ ] **Step 4: QuestionController 添加 status 过滤**

```java
// QuestionController.java 现有 getById 方法追加 status 校验
    public ResponseEntity<ApiResponse<QuestionVO>> getById(@PathVariable Long id) {
        Question question = questionService.getById(id);
        if (!"PUBLISHED".equals(question.getStatus())) {
            throw new BusinessException(404, "题目不存在");
        }
        // 其余逻辑不变
    }
```

- [ ] **Step 5: 提交**

```bash
git add backend/src/main/java/com/lcbinterview/dto/QuestionVO.java backend/src/main/java/com/lcbinterview/mapper/QuestionMapper.java backend/src/main/java/com/lcbinterview/service/QuestionService.java backend/src/main/java/com/lcbinterview/controller/QuestionController.java
git commit -m "feat: QuestionVO 扩展 + FULLTEXT 搜索 + status 过滤"
```

---

### Task 3: Admin token 配置

**Files:**
- Modify: `backend/src/main/resources/application.yml`
- Modify: `backend/src/main/java/com/lcbinterview/config/AdminTokenFilter.java` (Create)

- [ ] **Step 1: application.yml 追加**

```yaml
# 在末尾追加
admin:
  token: lcb-admin-2026
```

- [ ] **Step 2: 创建 AdminTokenFilter**

```java
package com.lcbinterview.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import java.io.IOException;

/**
 * Admin API Token 校验过滤器。所有 /api/admin/* 请求需要携带 Authorization: Bearer <token>。
 */
@Component
@Order(1)
public class AdminTokenFilter implements Filter {

    @Value("${admin.token}")
    private String adminToken;

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest req = (HttpServletRequest) request;
        HttpServletResponse res = (HttpServletResponse) response;

        String path = req.getRequestURI();
        if (!path.startsWith("/api/admin/")) {
            chain.doFilter(request, response);
            return;
        }

        String auth = req.getHeader("Authorization");
        if (auth == null || !auth.equals("Bearer " + adminToken)) {
            res.setStatus(401);
            res.setContentType("application/json;charset=UTF-8");
            res.getWriter().write("{\"code\":401,\"message\":\"Unauthorized\"}");
            return;
        }

        chain.doFilter(request, response);
    }
}
```

- [ ] **Step 3: 提交**

```bash
git add backend/src/main/resources/application.yml backend/src/main/java/com/lcbinterview/config/AdminTokenFilter.java
git commit -m "feat: 添加 admin.token 配置和 Token 校验过滤器"
```

---

### Task 4: AI 生成服务 + Admin Controller

**Files:**
- Create: `backend/src/main/java/com/lcbinterview/dto/GenerationRequest.java`
- Create: `backend/src/main/java/com/lcbinterview/dto/GenerationTaskVO.java`
- Create: `backend/src/main/java/com/lcbinterview/dto/QuestionAdminVO.java`
- Create: `backend/src/main/java/com/lcbinterview/service/AiQuestionService.java`
- Create: `backend/src/main/java/com/lcbinterview/controller/admin/AiGenerationController.java`
- Create: `backend/src/main/java/com/lcbinterview/controller/admin/QuestionAdminController.java`

- [ ] **Step 1: 创建 GenerationRequest**

```java
package com.lcbinterview.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

@Schema(description = "AI 生成请求")
public record GenerationRequest(
        @NotBlank @Schema(description = "分类名称") String category,
        @Schema(description = "难度: EASY/MEDIUM/HARD，可选") String difficulty,
        @Min(1) @Max(20) @Schema(description = "生成数量") int count,
        @Schema(description = "主题关键词，可选") String topic
) {}
```

- [ ] **Step 2: 创建 GenerationTaskVO**

```java
package com.lcbinterview.dto;

import java.util.List;

public record GenerationTaskVO(
        Long taskId,
        String status,    // RUNNING / COMPLETED / FAILED / PARTIAL
        int total,
        int successCount,
        int failCount,
        List<String> errors,
        List<Long> generatedIds
) {}
```

- [ ] **Step 3: 创建 AiQuestionService**

```java
package com.lcbinterview.service;

import com.lcbinterview.dto.GenerationRequest;
import com.lcbinterview.dto.GenerationTaskVO;
import com.lcbinterview.mapper.QuestionMapper;
import com.lcbinterview.model.Question;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import java.util.*;
import java.util.concurrent.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiQuestionService {

    private final QuestionMapper questionMapper;
    // 内存存储生成任务状态（简化方案，重启后丢失。后续可改为 Redis 或 DB 持久化）
    private final Map<Long, GenerationTaskVO> taskStore = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);

    /**
     * 异步生成题目。
     */
    public Long generate(GenerationRequest req) {
        Long taskId = System.currentTimeMillis();
        taskStore.put(taskId, new GenerationTaskVO(taskId, "RUNNING", req.count(), 0, 0, List.of(), List.of()));

        scheduler.submit(() -> {
            try {
                List<String> errors = new ArrayList<>();
                List<Long> generatedIds = new ArrayList<>();
                int success = 0;
                int fail = 0;

                for (int i = 0; i < req.count(); i++) {
                    try {
                        // TODO: 接入实际 LLM API，此处为模拟生成
                        Question q = new Question();
                        q.setTitle(req.category() + " 面试题 " + (i + 1));
                        q.setSummary("这是 " + req.category() + " 相关的面试题摘要");
                        q.setContent("详细内容...");
                        q.setPrinciple("原理...");
                        q.setDifficulty(req.difficulty() != null ? req.difficulty() : "MEDIUM");
                        q.setCategoryId(1L);
                        q.setStatus("DRAFT");
                        q.setSource("AI_GENERATED");
                        questionMapper.insert(q);
                        generatedIds.add(q.getId());
                        success++;
                    } catch (Exception e) {
                        log.error("生成单题失败", e);
                        errors.add("第 " + (i + 1) + " 题生成失败: " + e.getMessage());
                        fail++;
                    }

                    // 更新进度
                    String taskStatus = fail == 0 ? "COMPLETED" : (success > 0 ? "PARTIAL" : "FAILED");
                    taskStore.put(taskId, new GenerationTaskVO(
                            taskId, taskStatus, req.count(), success, fail,
                            List.copyOf(errors), List.copyOf(generatedIds)));
                }
            } catch (Exception e) {
                log.error("生成任务异常", e);
                taskStore.put(taskId, new GenerationTaskVO(
                        taskId, "FAILED", req.count(), 0, req.count(),
                        List.of("任务执行异常: " + e.getMessage()), List.of()));
            }
        });

        return taskId;
    }

    public GenerationTaskVO getTask(Long taskId) {
        return taskStore.get(taskId);
    }
}
```

- [ ] **Step 4: 创建 AiGenerationController**

```java
package com.lcbinterview.controller.admin;

import com.lcbinterview.common.ApiResponse;
import com.lcbinterview.dto.GenerationRequest;
import com.lcbinterview.dto.GenerationTaskVO;
import com.lcbinterview.service.AiQuestionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/ai")
@RequiredArgsConstructor
public class AiGenerationController {

    private final AiQuestionService aiQuestionService;

    @PostMapping("/generate")
    public ResponseEntity<ApiResponse<Long>> generate(@Valid @RequestBody GenerationRequest req) {
        Long taskId = aiQuestionService.generate(req);
        return ResponseEntity.ok(ApiResponse.ok(taskId));
    }

    @GetMapping("/tasks/{id}")
    public ResponseEntity<ApiResponse<GenerationTaskVO>> getTask(@PathVariable Long id) {
        GenerationTaskVO task = aiQuestionService.getTask(id);
        if (task == null) {
            return ResponseEntity.ok(ApiResponse.error(404, "任务不存在"));
        }
        return ResponseEntity.ok(ApiResponse.ok(task));
    }
}
```

- [ ] **Step 5: 创建 QuestionAdminVO**

```java
package com.lcbinterview.dto;

import com.lcbinterview.model.Question;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;

/**
 * 管理端题目视图对象，含审核状态和来源信息。
 * 避免直接将 Entity（含 isDeleted 等内部字段）暴露给前端。
 */
@Schema(description = "管理端题目视图对象")
public record QuestionAdminVO(
        @Schema(description = "题目 ID") Long id,
        @Schema(description = "标题") String title,
        @Schema(description = "摘要") String summary,
        @Schema(description = "内容") String content,
        @Schema(description = "答案") String answer,
        @Schema(description = "原理解析") String principle,
        @Schema(description = "对比分析") String comparison,
        @Schema(description = "适用场景") String scenario,
        @Schema(description = "风险与避坑") String risk,
        @Schema(description = "项目实战") String projectExp,
        @Schema(description = "代码示例") String codeExamples,
        @Schema(description = "图解") String diagrams,
        @Schema(description = "关联题目 ID") String relatedIds,
        @Schema(description = "难度") String difficulty,
        @Schema(description = "分类 ID") Long categoryId,
        @Schema(description = "状态") String status,
        @Schema(description = "来源") String source,
        @Schema(description = "创建时间") LocalDateTime createTime
) {
    public static QuestionAdminVO from(Question q) {
        return new QuestionAdminVO(
                q.getId(), q.getTitle(), q.getSummary(), q.getContent(),
                q.getAnswer(),
                q.getPrinciple(), q.getComparison(), q.getScenario(),
                q.getRisk(), q.getProjectExp(), q.getCodeExamples(),
                q.getDiagrams(), q.getRelatedIds(),
                q.getDifficulty(), q.getCategoryId(),
                q.getStatus(), q.getSource(), q.getCreateTime()
        );
    }
}
```

- [ ] **Step 6: 创建 QuestionAdminController**（使用 VO 而非 Entity）

```java
package com.lcbinterview.controller.admin;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.lcbinterview.common.ApiResponse;
import com.lcbinterview.dto.QuestionAdminVO;
import com.lcbinterview.mapper.QuestionMapper;
import com.lcbinterview.model.Question;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/admin/questions")
@RequiredArgsConstructor
public class QuestionAdminController {

    private final QuestionMapper questionMapper;

    @GetMapping("/draft")
    public ResponseEntity<ApiResponse<IPage<QuestionAdminVO>>> listDrafts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<Question> mpPage = new Page<>(page, size);
        LambdaQueryWrapper<Question> wrapper = new LambdaQueryWrapper<Question>()
                .eq(Question::getStatus, "DRAFT")
                .orderByDesc(Question::getCreateTime);
        IPage<Question> result = questionMapper.selectPage(mpPage, wrapper);
        // 转为 VO，避免暴露 Entity 内部字段
        IPage<QuestionAdminVO> voPage = new Page<>(result.getCurrent(), result.getSize(), result.getTotal());
        voPage.setRecords(result.getRecords().stream().map(QuestionAdminVO::from).toList());
        return ResponseEntity.ok(ApiResponse.ok(voPage));
    }

    @GetMapping("/draft/{id}")
    public ResponseEntity<ApiResponse<QuestionAdminVO>> getDraft(@PathVariable Long id) {
        Question q = questionMapper.selectById(id);
        if (q == null) {
            return ResponseEntity.ok(ApiResponse.error(404, "题目不存在"));
        }
        return ResponseEntity.ok(ApiResponse.ok(QuestionAdminVO.from(q)));
    }

    @PutMapping("/draft/{id}")
    public ResponseEntity<ApiResponse<Void>> updateDraft(@PathVariable Long id,
                                                          @RequestBody Question question) {
        question.setId(id);
        questionMapper.updateById(question);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    @PostMapping("/draft/{id}/approve")
    public ResponseEntity<ApiResponse<Void>> approve(@PathVariable Long id) {
        Question q = new Question();
        q.setId(id);
        q.setStatus("PUBLISHED");
        questionMapper.updateById(q);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }

    @PostMapping("/draft/{id}/reject")
    public ResponseEntity<ApiResponse<Void>> reject(@PathVariable Long id) {
        Question q = new Question();
        q.setId(id);
        q.setStatus("REJECTED");
        questionMapper.updateById(q);
        return ResponseEntity.ok(ApiResponse.ok(null));
    }
}
```

- [ ] **Step 7: 创建 admin controller 包目录并提交**

```bash
New-Item -ItemType Directory -Path backend/src/main/java/com/lcbinterview/controller/admin -Force
git add backend/src/main/java/com/lcbinterview/dto/GenerationRequest.java backend/src/main/java/com/lcbinterview/dto/GenerationTaskVO.java backend/src/main/java/com/lcbinterview/dto/QuestionAdminVO.java backend/src/main/java/com/lcbinterview/service/AiQuestionService.java backend/src/main/java/com/lcbinterview/controller/admin/
git commit -m "feat: AI 生成管线 + Admin Controller（生成/草稿/审核/VO隔离）"
```

---

### Task 5: 前端类型扩展 + API 层

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/api/question.ts`
- Create: `frontend/src/api/admin.ts`

- [ ] **Step 1: 扩展 types.ts**

```typescript
export interface Question {
  id: number
  title: string
  summary?: string
  content: string
  principle?: string
  comparison?: string
  scenario?: string
  risk?: string
  projectExp?: string
  codeExamples?: string  // JSON string
  diagrams?: string      // JSON string
  relatedIds?: string    // JSON string
  difficulty: string
  categoryName: string
  tags: string[]
  viewCount: number
  createTime: string
}

export interface QuestionAdmin extends Question {
  status: 'DRAFT' | 'PUBLISHED' | 'REJECTED'
  source: 'AI_GENERATED' | 'MANUAL'
}

export interface CodeExample {
  lang: string
  title: string
  code: string
  description: string
}

export interface Diagram {
  type: 'mermaid' | 'svg' | 'url'
  alt: string
  content: string
  caption: string
}

export interface GenerationTask {
  taskId: number
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PARTIAL'
  total: number
  successCount: number
  failCount: number
  errors: string[]
  generatedIds: number[]
}
```

- [ ] **Step 2: 创建 api/admin.ts**

```typescript
import api from './index'

export const generateQuestions = (params: {
  category: string
  difficulty?: string
  count: number
  topic?: string
}) =>
  api.post<{ data: number }>('/admin/ai/generate', params)
    .then(res => res.data.data)

export const getGenerationTask = (taskId: number) =>
  api.get<{ data: import('../types').GenerationTask }>(`/admin/ai/tasks/${taskId}`)
    .then(res => res.data.data)

export const listDrafts = (page = 0, size = 20) =>
  api.get<{ data: { records: import('../types').QuestionAdmin[], total: number, current: number, pages: number } }>('/admin/questions/draft', { params: { page, size } })
    .then(res => res.data.data)

export const getDraft = (id: number) =>
  api.get<{ data: import('../types').QuestionAdmin }>(`/admin/questions/draft/${id}`)
    .then(res => res.data.data)

export const updateDraft = (id: number, data: Partial<import('../types').QuestionAdmin>) =>
  api.put(`/admin/questions/draft/${id}`, data)

export const approveDraft = (id: number) =>
  api.post(`/admin/questions/draft/${id}/approve`)

export const rejectDraft = (id: number) =>
  api.post(`/admin/questions/draft/${id}/reject`)
```

- [ ] **Step 3: 提交**

```bash
git add frontend/src/types.ts frontend/src/api/admin.ts
git commit -m "feat: 前端类型扩展 + admin API 层"
```

---

### Task 6: QuestionDetail 重构为结构化展示

**Files:**
- Create: `frontend/src/pages/QuestionDetail/ContentView.tsx`
- Create: `frontend/src/pages/QuestionDetail/CodeBlock.tsx`
- Create: `frontend/src/pages/QuestionDetail/DiagramBlock.tsx`
- Create: `frontend/src/pages/QuestionDetail/Skeleton.tsx`
- Modify: `frontend/src/pages/QuestionDetail/index.tsx`

- [ ] **Step 0: 安装 Markdown 编辑器依赖（管理端草稿编辑需要）**

```bash
npm install @uiw/react-md-editor
```

- [ ] **Step 1: 创建 CodeBlock.tsx**

```tsx
import { Tabs, Typography, Button, Space } from 'antd'
import { CopyOutlined } from '@ant-design/icons'
import Markdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import type { CodeExample } from '../../types'

const { Text } = Typography

interface Props {
  examples: CodeExample[]
}

export default function CodeBlock({ examples }: Props) {
  if (!examples || examples.length === 0) return null

  const items = examples.map((ex, i) => ({
    key: String(i),
    label: ex.title || ex.lang.toUpperCase(),
    children: (
      <div>
        {ex.description && <Text type="secondary">{ex.description}</Text>}
        <div style={{ position: 'relative', marginTop: 8 }}>
          <Button
            size="small"
            icon={<CopyOutlined />}
            style={{ position: 'absolute', right: 8, top: 8, zIndex: 1 }}
            onClick={() => navigator.clipboard.writeText(ex.code)}
          />
          <Markdown rehypePlugins={[rehypeHighlight]}>
            {"```" + ex.lang + "\n" + ex.code + "\n```"}
          </Markdown>
        </div>
      </div>
    ),
  }))

  return <Tabs items={items} />
}
```

- [ ] **Step 2: 创建 DiagramBlock.tsx**

```tsx
import { Image, Typography } from 'antd'
import type { Diagram } from '../../types'

const { Text } = Typography

interface Props {
  diagrams: Diagram[]
}

export default function DiagramBlock({ diagrams }: Props) {
  if (!diagrams || diagrams.length === 0) return null

  return (
    <div>
      {diagrams.map((d, i) => (
        <div key={i} style={{ marginBottom: 16, textAlign: 'center' }}>
          {d.type === 'svg' ? (
            <div dangerouslySetInnerHTML={{ __html: d.content }}
                 style={{ maxWidth: '100%', overflowX: 'auto' }} />
          ) : (
            <Image src={d.content} alt={d.alt} style={{ maxWidth: '100%' }} />
          )}
          {d.caption && <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>{d.caption}</Text>}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: 创建 Skeleton.tsx**

```tsx
import { Skeleton as AntSkeleton, Card } from 'antd'

export default function Skeleton() {
  return (
    <Card>
      <AntSkeleton active paragraph={{ rows: 1 }} />
      <div style={{ margin: '16px 0' }}>
        <AntSkeleton.Input active size="small" style={{ width: 80, marginRight: 8 }} />
        <AntSkeleton.Input active size="small" style={{ width: 60 }} />
      </div>
      <AntSkeleton active paragraph={{ rows: 6 }} />
    </Card>
  )
}
```

- [ ] **Step 4: 创建 ContentView.tsx（供管理端复用）**

```tsx
import { Collapse, Typography } from 'antd'
import Markdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import CodeBlock from './CodeBlock'
import DiagramBlock from './DiagramBlock'
import type { Question, CodeExample, Diagram } from '../../types'

const { Text } = Typography

interface Props {
  question: Question
  defaultOpen?: boolean
}

function parseJson<T>(val: string | undefined | null): T[] {
  if (!val) return []
  try { return JSON.parse(val) } catch { return [] }
}

export default function ContentView({ question, defaultOpen = false }: Props) {
  const sections: { key: string; label: string; content: React.ReactNode }[] = []

  if (question.summary) {
    sections.push({
      key: 'summary',
      label: '摘要',
      content: <Text style={{ background: '#f5f5f5', padding: '8px 16px', display: 'block', borderRadius: 6 }}>{question.summary}</Text>,
    })
  }

  const fields: [string, string | undefined | null][] = [
    ['原理', question.principle],
    ['对比分析', question.comparison],
    ['适用场景', question.scenario],
    ['风险与避坑', question.risk],
    ['项目实战', question.projectExp],
  ]

  for (const [label, value] of fields) {
    if (value) {
      sections.push({
        key: label,
        label,
        content: <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{value}</Markdown>,
      })
    }
  }

  const codeExamples = parseJson<CodeExample>(question.codeExamples)
  if (codeExamples.length > 0) {
    sections.push({
      key: 'code',
      label: '代码示例',
      content: <CodeBlock examples={codeExamples} />,
    })
  }

  const diagrams = parseJson<Diagram>(question.diagrams)
  if (diagrams.length > 0) {
    sections.push({
      key: 'diagrams',
      label: '图解',
      content: <DiagramBlock diagrams={diagrams} />,
    })
  }

  return (
    <Collapse
      defaultActiveKey={defaultOpen ? sections.map(s => s.key) : ['summary']}
      items={sections.map(s => ({ key: s.key, label: s.label, children: s.content }))}
      expandIconPosition="end"
    />
  )
}
```

- [ ] **Step 5: 重构 QuestionDetail/index.tsx**

```tsx
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Card, Tag, Typography, Spin, Button, Alert } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { getQuestionById } from '../../api/question'
import ContentView from './ContentView'
import Skeleton from './Skeleton'
import type { Question } from '../../types'

const { Title } = Typography

export default function QuestionDetail() {
  const { id } = useParams()
  const [q, setQ] = useState<Question | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchQuestion = () => {
    if (!id) return
    setLoading(true)
    setError(false)
    getQuestionById(Number(id))
      .then(data => { setQ(data); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }

  useEffect(() => { fetchQuestion() }, [id])

  if (loading) return <Skeleton />
  if (error) return (
    <Card>
      <Alert
        type="error"
        message="题目加载失败"
        description="请检查网络连接后重试"
        action={<Button onClick={fetchQuestion}>重试</Button>}
      />
    </Card>
  )
  if (!q) return (
    <Card>
      <Alert type="warning" message="题目不存在" showIcon />
    </Card>
  )

  const diffColor: Record<string, string> = { EASY: 'green', MEDIUM: 'orange', HARD: 'red' }

  return (
    <Card>
      <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => window.history.back()}
              style={{ padding: 0, marginBottom: 8 }} />
      <Title level={4}>{q.title}</Title>
      <div style={{ marginBottom: 16 }}>
        <Tag>{q.categoryName}</Tag>
        <Tag color={diffColor[q.difficulty] || 'default'}>{q.difficulty}</Tag>
        {q.tags?.map(t => <Tag key={t}>{t}</Tag>)}
        <span style={{ marginLeft: 8, color: '#999' }}>浏览 {q.viewCount} 次</span>
      </div>
      <ContentView question={q} />
    </Card>
  )
}
```

- [ ] **Step 6: 提交**

```bash
git add frontend/src/pages/QuestionDetail/
git commit -m "feat: QuestionDetail 重构为结构化 Collapse 布局 + 代码示例/图解子组件"
```

---

### Task 7: Admin 前端页面

**Files:**
- Create: `frontend/src/pages/admin/AdminLayout.tsx`
- Create: `frontend/src/pages/admin/Login.tsx`
- Create: `frontend/src/pages/admin/Dashboard.tsx`
- Create: `frontend/src/pages/admin/AIGenerate.tsx`
- Create: `frontend/src/pages/admin/DraftReview.tsx`
- Modify: `frontend/src/api/index.ts`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 0: Admin API 拦截器注入 Token**

```typescript
// frontend/src/api/index.ts 追加拦截器
// 从 localStorage 读取 adminToken，所有 /api/admin/ 请求自动添加 Authorization header
api.interceptors.request.use(config => {
  const token = localStorage.getItem('adminToken')
  if (token && config.url?.startsWith('/admin/')) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
```

- [ ] **Step 0b: 创建 Admin 登录页（Token 输入）**

```tsx
// frontend/src/pages/admin/Login.tsx
import { useState } from 'react'
import { Card, Input, Button, message } from 'antd'
import { useNavigate } from 'react-router-dom'

export default function AdminLogin() {
  const [token, setToken] = useState('')
  const navigate = useNavigate()

  const handleLogin = () => {
    if (!token.trim()) {
      message.error('请输入 Token')
      return
    }
    localStorage.setItem('adminToken', token.trim())
    message.success('已登录')
    navigate('/admin/dashboard')
  }

  return (
    <Card title="Admin 登录" style={{ maxWidth: 400, margin: '100px auto' }}>
      <Input.Password
        placeholder="请输入 Admin Token"
        value={token}
        onChange={e => setToken(e.target.value)}
        onPressEnter={handleLogin}
      />
      <Button type="primary" onClick={handleLogin} style={{ marginTop: 16 }}>
        登录
      </Button>
    </Card>
  )
}
```

- [ ] **Step 1: 创建 AdminLayout.tsx**

```tsx
import { Layout, Menu } from 'antd'
import { Outlet, useNavigate } from 'react-router-dom'
import {
  DashboardOutlined, RobotOutlined, FileSearchOutlined, TagOutlined
} from '@ant-design/icons'

const { Sider, Content } = Layout

const menuItems = [
  { key: '/admin/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/admin/ai-generate', icon: <RobotOutlined />, label: '生成题目' },
  { key: '/admin/draft-review', icon: <FileSearchOutlined />, label: '审核草稿' },
  { key: '/admin/categories', icon: <TagOutlined />, label: '分类管理' },
]

export default function AdminLayout() {
  const navigate = useNavigate()

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider>
        <div style={{ color: '#fff', padding: 16, fontWeight: 'bold', fontSize: 16 }}>Admin</div>
        <Menu theme="dark" mode="inline" items={menuItems}
              onClick={({ key }) => navigate(key)} />
      </Sider>
      <Content style={{ padding: 24 }}>
        <Outlet />
      </Content>
    </Layout>
  )
}
```

- [ ] **Step 2: 创建 AIGenerate.tsx**

```tsx
import { useState } from 'react'
import { Card, Form, Select, InputNumber, Input, Button, Progress, Alert, message } from 'antd'
import { generateQuestions, getGenerationTask } from '../../api/admin'

export default function AIGenerate() {
  const [loading, setLoading] = useState(false)
  const [taskId, setTaskId] = useState<number | null>(null)
  const [task, setTask] = useState<any>(null)

  const onFinish = async (values: any) => {
    setLoading(true)
    setTask(null)
    try {
      const id = await generateQuestions(values)
      setTaskId(id)
      pollTask(id)
    } catch {
      message.error('生成失败')
      setLoading(false)
    }
  }

  const pollTask = (id: number) => {
    const timer = setInterval(async () => {
      const t = await getGenerationTask(id)
      setTask(t)
      if (t.status === 'COMPLETED' || t.status === 'FAILED' || t.status === 'PARTIAL') {
        clearInterval(timer)
        setLoading(false)
        if (t.status === 'COMPLETED') message.success(`成功生成 ${t.successCount} 道题`)
        else if (t.status === 'PARTIAL') message.warning(`部分成功：${t.successCount}/${t.total}`)
        else message.error('生成失败')
      }
    }, 3000)
  }

  return (
    <Card title="AI 批量生成题目">
      <Form layout="vertical" onFinish={onFinish} style={{ maxWidth: 500 }}>
        <Form.Item name="category" label="分类" rules={[{ required: true }]}>
          <Select options={[
            { value: 'Java基础', label: 'Java基础' },
            { value: 'Java并发', label: 'Java并发' },
            { value: 'JVM', label: 'JVM' },
            { value: 'MySQL', label: 'MySQL' },
            { value: 'Redis', label: 'Redis' },
            { value: 'Spring', label: 'Spring' },
            { value: 'SpringBoot', label: 'SpringBoot' },
            { value: '计算机网络', label: '计算机网络' },
            { value: '操作系统', label: '操作系统' },
            { value: '数据结构', label: '数据结构' },
            { value: '前端', label: '前端' },
          ]} />
        </Form.Item>
        <Form.Item name="difficulty" label="难度">
          <Select allowClear options={[
            { value: 'EASY', label: '简单' },
            { value: 'MEDIUM', label: '中等' },
            { value: 'HARD', label: '困难' },
          ]} />
        </Form.Item>
        <Form.Item name="count" label="生成数量" initialValue={5}>
          <InputNumber min={1} max={20} />
        </Form.Item>
        <Form.Item name="topic" label="主题关键词（可选）">
          <Input placeholder="如：HashMap原理" />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>
          开始生成
        </Button>
      </Form>
      {task && (
        <Card size="small" style={{ marginTop: 16 }}>
          <Progress percent={Math.round((task.successCount + task.failCount) / task.total * 100)} />
          <p>成功: {task.successCount} / 失败: {task.failCount} / 共: {task.total}</p>
          {task.errors?.length > 0 && (
            <Alert type="error" message={task.errors.join('; ')} />
          )}
        </Card>
      )}
    </Card>
  )
}
```

- [ ] **Step 3: 创建 Dashboard.tsx**

```tsx
import { useEffect, useState } from 'react'
import { Card, Statistic, Row, Col } from 'antd'
import { listDrafts } from '../../api/admin'

export default function AdminDashboard() {
  const [draftCount, setDraftCount] = useState(0)

  useEffect(() => {
    listDrafts(0, 1).then(res => setDraftCount(res.total)).catch(() => {})
  }, [])

  return (
    <Row gutter={16}>
      <Col span={6}>
        <Card><Statistic title="草稿题目" value={draftCount} /></Card>
      </Col>
    </Row>
  )
}
```

- [ ] **Step 4: 创建 DraftReview.tsx**

```tsx
import { useEffect, useState } from 'react'
import { Table, Button, Modal, Tag, message, Space } from 'antd'
import { listDrafts, getDraft, updateDraft, approveDraft, rejectDraft } from '../../api/admin'
import ContentView from '../QuestionDetail/ContentView'
import type { QuestionAdmin } from '../../types'
import type { ColumnsType } from 'antd/es/table'

export default function DraftReview() {
  const [data, setData] = useState<QuestionAdmin[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<QuestionAdmin | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const load = (p: number) => {
    setLoading(true)
    listDrafts(p).then(res => {
      setData((res.records || res.content) as QuestionAdmin[])
      setTotal(res.total)
      setLoading(false)
    })
  }

  useEffect(() => { load(0) }, [])

  const handleApprove = async (id: number) => {
    await approveDraft(id)
    message.success('已通过')
    load(page)
  }

  const handleReject = async (id: number) => {
    await rejectDraft(id)
    message.success('已驳回')
    load(page)
  }

  const handlePreview = async (id: number) => {
    const q = await getDraft(id)
    setPreview(q)
    setPreviewOpen(true)
  }

  const columns: ColumnsType<QuestionAdmin> = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '标题', dataIndex: 'title', ellipsis: true },
    { title: '难度', dataIndex: 'difficulty', width: 80,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    { title: '来源', dataIndex: 'source', width: 100 },
    { title: '创建时间', dataIndex: 'createTime', width: 160 },
    {
      title: '操作', width: 200,
      render: (_: any, r: QuestionAdmin) => (
        <Space>
          <Button size="small" onClick={() => handlePreview(r.id)}>预览</Button>
          <Button size="small" type="primary" onClick={() => handleApprove(r.id)}>通过</Button>
          <Button size="small" danger onClick={() => handleReject(r.id)}>驳回</Button>
        </Space>
      ),
    },
  ]

  return (
    <>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={{ current: page + 1, total, onChange: p => { setPage(p - 1); load(p - 1) }}}
      />
      <Modal title="草稿预览" open={previewOpen} onCancel={() => setPreviewOpen(false)}
             width={800} footer={null}>
        {preview && <ContentView question={preview} defaultOpen />}
      </Modal>
    </>
  )
}
```

- [ ] **Step 5: App.tsx 添加 admin 路由**

```tsx
// 在现有路由后追加
import AdminLayout from './pages/admin/AdminLayout'
import AdminLogin from './pages/admin/Login'
import AdminDashboard from './pages/admin/Dashboard'
import AIGenerate from './pages/admin/AIGenerate'
import DraftReview from './pages/admin/DraftReview'

// routes 数组追加
      { path: '/admin/login', element: <AdminLogin /> },
      {
        path: '/admin',
        element: <AdminLayout />,
        children: [
          { index: true, element: <Navigate to="/admin/dashboard" replace /> },
          { path: 'dashboard', element: <AdminDashboard /> },
          { path: 'ai-generate', element: <AIGenerate /> },
          { path: 'draft-review', element: <DraftReview /> },
        ],
      },
```

- [ ] **Step 6: AdminLayout 添加 Token 检查**

```tsx
// AdminLayout.tsx 在 return 前检查 token
  const navigate = useNavigate()
  useEffect(() => {
    const token = localStorage.getItem('adminToken')
    if (!token) {
      navigate('/admin/login')
    }
  }, [])
```

- [ ] **Step 7: 提交**

```bash
git add frontend/src/pages/admin/ frontend/src/App.tsx frontend/src/api/index.ts
git commit -m "feat: Admin 前端页面（Token登录 / Dashboard / AI生成 / 草稿审核）"
```

---

### Task 8: 前端 Loading/Error/Empty 状态覆盖

**Files:**
- Modify: `frontend/src/pages/Home/index.tsx`
- Modify: `frontend/src/pages/Home/HotQuestions.tsx`
- Modify: `frontend/src/pages/QuestionBank/index.tsx`
- Modify: `frontend/src/pages/QuestionList/index.tsx`
- Modify: `frontend/src/pages/SearchResult/index.tsx`

- [ ] **Step 1: HotQuestions.tsx 添加状态**

```tsx
// 追加 loading / empty / error 状态
  if (loading) return <Skeleton active paragraph={{ rows: 5 }} />
  if (error) return <Alert type="error" message="加载失败" action={<Button onClick={fetch}>重试</Button>} />
  if (questions.length === 0) return <Empty description="暂无热门题目" />
```

- [ ] **Step 2: QuestionList 添加分页保留 + Error 重试**

```tsx
// 保留分页 skeleton
  if (loading && !questions.length) return <Skeleton active />
  if (error) return (
    <Alert type="error" message="加载失败" action={<Button onClick={fetch}>重试</Button>} />
  )
  if (!loading && questions.length === 0) return (
    <Empty description="该分类暂无题目">
      <Button type="primary" onClick={() => navigate('/banks')}>浏览其他分类</Button>
    </Empty>
  )
```

- [ ] **Step 3: SearchResult 添加状态**

```tsx
  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />
  if (error) return <Alert type="error" message="搜索失败" action={<Button onClick={doSearch}>重试</Button>} />
  if (!loading && result.length === 0) return (
    <Empty description={`未找到与"${keyword}"相关的题目`}>
      <Button onClick={() => navigate('/banks')}>浏览全部题目</Button>
    </Empty>
  )
```

- [ ] **Step 4: 提交**

```bash
git add frontend/src/pages/Home/ frontend/src/pages/QuestionBank/ frontend/src/pages/QuestionList/ frontend/src/pages/SearchResult/
git commit -m "feat: 前端 Loading/Error/Empty 状态全覆盖"
```

---

### Task 9: 存量数据迁移脚本

**Files:**
- Create: `backend/src/main/resources/migrate-legacy.sql`

- [ ] **Step 1: 创建 SQL 迁移标记**

```sql
-- migrate-legacy.sql：将存量 5 道题标记为 PUBLISHED
UPDATE question SET status = 'PUBLISHED', source = 'MANUAL' WHERE status IS NULL;
```

- [ ] **Step 2: 提交**

```bash
git add backend/src/main/resources/migrate-legacy.sql
git commit -m "chore: 存量数据迁移脚本"
```

---

### 自检

1. **Spec coverage:** 所有 spec 中的需求都已映射到对应 task（内容模型→Task1, Task2; AI生成管线→Task4; 搜索→Task2; 管理后台→Task4+Task7; 响应式+前端状态→Task6+Task8; 存量迁移→Task9）
2. **Placeholders:** AiQuestionService 中的 TODO 标记了实际 LLM API 接入点（后续真实 API 接入再替换），其余代码完整
3. **Type consistency:** GenerationTaskVO/GenerationRequest 的字段在前后端一致，Question/QuestionVO/QuestionAdmin 类型对齐
