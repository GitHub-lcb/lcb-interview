# LCB Interview Phase 1 Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the first set of production-readiness and main-path usability issues in the interview question bank.

**Architecture:** Keep the current Spring Boot + MyBatis-Plus + React structure. Add focused backend tests around admin verification and question read APIs, then implement the smallest service/controller changes needed to make those tests pass. Configuration secrets move to environment-variable placeholders without changing the frontend runtime contract.

**Tech Stack:** Spring Boot 3.2, JDK 21, MyBatis-Plus, JUnit 5, Mockito, React 18, Vite.

---

## File Structure

- Modify `backend/pom.xml`: add Spring Boot test dependency.
- Modify `backend/src/main/resources/application.yml`: remove hardcoded secrets and read runtime values from environment variables.
- Create `backend/src/main/java/com/lcbinterview/controller/admin/AdminAuthController.java`: protected token verification endpoint.
- Modify `backend/src/main/java/com/lcbinterview/mapper/QuestionMapper.java`: add paginated tag query and tag-name query.
- Modify `backend/src/main/java/com/lcbinterview/service/QuestionService.java`: assemble category names and tags for public VOs; use paginated tag search.
- Modify `backend/src/main/java/com/lcbinterview/controller/QuestionController.java`: return enriched `QuestionVO` data.
- Create `backend/src/test/java/com/lcbinterview/controller/admin/AdminAuthControllerTest.java`: prove `/api/admin/verify` works only with valid token.
- Create `backend/src/test/java/com/lcbinterview/service/QuestionServiceTest.java`: prove VO enrichment and tag pagination behavior.

## Task 1: Test Infrastructure and Admin Verification

**Files:**
- Modify: `backend/pom.xml`
- Create: `backend/src/test/java/com/lcbinterview/controller/admin/AdminAuthControllerTest.java`
- Create: `backend/src/main/java/com/lcbinterview/controller/admin/AdminAuthController.java`

- [x] **Step 1: Add the test dependency**

Add `spring-boot-starter-test` with `test` scope to `backend/pom.xml`.

- [x] **Step 2: Write failing admin verification tests**

Create a MockMvc test that expects:
- `GET /api/admin/verify` with `Authorization: Bearer test-token` returns `{"code":200,...}`.
- The same request without a token returns HTTP 401.

- [x] **Step 3: Run the test and verify RED**

Run:

```bash
cd backend
mvn -q -Dtest=AdminAuthControllerTest test
```

Expected before implementation: the authorized request fails because no controller handles `/api/admin/verify`.

- [x] **Step 4: Implement the controller**

Create `AdminAuthController` under `/api/admin` with a `GET /verify` endpoint returning `ApiResponse.success()`. `AdminTokenFilter` remains the enforcement point.

- [x] **Step 5: Run the test and verify GREEN**

Run:

```bash
cd backend
mvn -q -Dtest=AdminAuthControllerTest test
```

Expected: both tests pass.

## Task 2: Secrets and Runtime Configuration

**Files:**
- Modify: `backend/src/main/resources/application.yml`

- [x] **Step 1: Replace hardcoded runtime secrets**

Use environment placeholders:
- `DB_URL`
- `DB_USERNAME`
- `DB_PASSWORD`
- `REDIS_HOST`
- `REDIS_PORT`
- `ADMIN_TOKEN`
- `AI_OPENCODE_API_KEY`
- `AI_DEEPSEEK_MODEL`
- `AI_DEEPSEEK_URL`

- [x] **Step 2: Keep local development usable**

Keep non-sensitive local defaults where reasonable, such as host, port, username, and model. Do not keep the real AI key in source.

- [x] **Step 3: Verify packaging still works**

Run:

```bash
cd backend
mvn -q -DskipTests package
```

Expected: build succeeds without requiring a real AI key.

## Task 3: Question VO Enrichment and Tag Pagination

**Files:**
- Modify: `backend/src/main/java/com/lcbinterview/mapper/QuestionMapper.java`
- Modify: `backend/src/main/java/com/lcbinterview/service/QuestionService.java`
- Modify: `backend/src/main/java/com/lcbinterview/controller/QuestionController.java`
- Create: `backend/src/test/java/com/lcbinterview/service/QuestionServiceTest.java`

- [x] **Step 1: Write failing service tests**

Add tests that verify:
- A list of `Question` entities is converted to `QuestionVO` with category names and tag names.
- `search(..., tagId, page, size)` delegates to a paginated mapper method rather than loading all tag matches.

- [x] **Step 2: Run the test and verify RED**

Run:

```bash
cd backend
mvn -q -Dtest=QuestionServiceTest test
```

Expected before implementation: methods do not exist or VOs still contain null category names and empty tags.

- [x] **Step 3: Add mapper methods**

Add:
- `IPage<Question> selectPageByTagId(Page<?> page, Long tagId)`
- `List<Tag> selectTagsByQuestionIds(List<Long> questionIds)`

- [x] **Step 4: Add service VO assembly methods**

Add:
- `PageResult<QuestionVO> searchVo(...)`
- `QuestionVO getVoById(Long id)`
- `List<QuestionVO> getHotVo(int size)`

These methods load category names and tags in batches and preserve the existing public API response shape.

- [x] **Step 5: Update controller to call service VO methods**

`QuestionController` should stop creating `QuestionVO.from(q, null, List.of())` directly.

- [x] **Step 6: Run the test and verify GREEN**

Run:

```bash
cd backend
mvn -q -Dtest=QuestionServiceTest test
```

Expected: tests pass.

## Task 4: Full Verification

**Files:**
- No new source files unless a failing verification reveals a focused issue.

- [x] **Step 1: Run backend tests**

```bash
cd backend
mvn test
```

- [x] **Step 2: Run backend package**

```bash
cd backend
mvn -q -DskipTests package
```

- [x] **Step 3: Run frontend build**

```bash
cd frontend
npm run build
```

- [x] **Step 4: Inspect git diff**

```bash
git status --short
git diff --stat
```

Expected: only planned files changed.
