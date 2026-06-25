# Batch Fill Answer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a background batch-fill-answer task that can fill all empty draft answers without relying on an SSE connection.

**Architecture:** Add a dedicated `BatchFillAnswerRunner` with an in-memory running lock and progress snapshot. Extract a reusable single-question fill method from `AiQuestionService`, then wire new admin APIs and a management form in the existing AI admin page.

**Tech Stack:** Spring Boot 3, MyBatis-Plus, JUnit 5, Mockito, React 18, Vite, Ant Design 5.

---

### Task 1: Backend API Contract

**Files:**
- Create: `backend/src/main/java/com/lcbinterview/dto/BatchFillAnswerRequest.java`
- Modify: `backend/src/main/java/com/lcbinterview/controller/admin/AiGenerationController.java`
- Test: `backend/src/test/java/com/lcbinterview/controller/admin/AiGenerationControllerTest.java`

- [ ] **Step 1: Write failing controller tests**

Add tests that construct `AiGenerationController` with a mocked `BatchFillAnswerRunner`, then assert:

```java
verify(batchFillAnswerRunner).start(null, null, 3);
```

for an empty request, assert unavailable AI returns `503`, and assert a second running task returns `409`.

- [ ] **Step 2: Run controller test to verify RED**

Run:

```bash
cd backend
mvn -Dtest=AiGenerationControllerTest test
```

Expected: compilation fails because `BatchFillAnswerRunner`, `BatchFillAnswerRequest`, and controller endpoints do not exist.

- [ ] **Step 3: Add minimal DTO and controller endpoints**

Create a request record with defaults:

```java
public record BatchFillAnswerRequest(Long categoryId, Integer maxQuestions, Integer delaySeconds) {
    public BatchFillAnswerRequest {
        if (delaySeconds == null) {
            delaySeconds = 3;
        }
    }
}
```

Add endpoints:

```java
@PostMapping("/fill-answer-batch")
public ResponseEntity<ApiResponse<String>> batchFillAnswers(@Valid @RequestBody BatchFillAnswerRequest req) { ... }

@GetMapping("/fill-answer-batch/status")
public ResponseEntity<ApiResponse<BatchProgressVO>> batchFillAnswerStatus() { ... }
```

- [ ] **Step 4: Run controller test to verify GREEN**

Run the same Maven test and require it to pass.

### Task 2: Reusable Single-Question Fill

**Files:**
- Modify: `backend/src/main/java/com/lcbinterview/service/AiQuestionService.java`
- Test: `backend/src/test/java/com/lcbinterview/service/AiQuestionServiceTest.java`

- [ ] **Step 1: Write failing service test**

Add a test for blank API key:

```java
assertThatThrownBy(() -> context.service.fillAnswerSync(question))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("AI 生成服务未配置密钥");
```

- [ ] **Step 2: Run service test to verify RED**

Run:

```bash
cd backend
mvn -Dtest=AiQuestionServiceTest test
```

Expected: compilation fails because `fillAnswerSync` does not exist.

- [ ] **Step 3: Extract implementation**

Add public result record or class inside `AiQuestionService`:

```java
public record FillAnswerResult(boolean success, Long questionId, Integer qualityScore, int reasoningLength, String error) {}
```

Move existing prompt, retry, parse, quality evaluation, and `updateById` logic into:

```java
public FillAnswerResult fillAnswerSync(Question question)
```

Make `streamFillAnswer` call `fillAnswerSync(q)` inside its loop.

- [ ] **Step 4: Run service test to verify GREEN**

Run the same Maven test and require it to pass.

### Task 3: Batch Runner

**Files:**
- Create: `backend/src/main/java/com/lcbinterview/service/BatchFillAnswerRunner.java`
- Test: `backend/src/test/java/com/lcbinterview/service/BatchFillAnswerRunnerTest.java`

- [ ] **Step 1: Write failing runner tests**

Add tests for:

```java
assertThat(runner.start(null, 2, 0)).isTrue();
assertThat(runner.start(null, 2, 0)).isFalse();
```

and a synchronous test helper that verifies two candidates call `aiQuestionService.fillAnswerSync(...)`, progress counts successes and failures, and `maxQuestions` limits selected candidates.

- [ ] **Step 2: Run runner test to verify RED**

Run:

```bash
cd backend
mvn -Dtest=BatchFillAnswerRunnerTest test
```

Expected: compilation fails because `BatchFillAnswerRunner` does not exist.

- [ ] **Step 3: Implement runner**

Use `AtomicBoolean`, `AtomicReference<BatchProgressVO>`, and a single-thread executor. Query candidates with:

```java
new LambdaQueryWrapper<Question>()
        .eq(Question::getStatus, "DRAFT")
        .and(w -> w.isNull(Question::getContent).or().eq(Question::getContent, ""))
        .eq(categoryId != null, Question::getCategoryId, categoryId)
        .orderByAsc(Question::getId)
        .last(limitSql)
```

Process candidates one at a time and update `BatchProgressVO`.

- [ ] **Step 4: Run runner test to verify GREEN**

Run the runner test and require it to pass.

### Task 4: Frontend Controls

**Files:**
- Modify: `frontend/src/api/admin.ts`
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/pages/admin/AIGenerate.tsx`

- [ ] **Step 1: Add API wrappers and types**

Add:

```ts
export const batchFillAnswers = (params: { categoryId?: number; maxQuestions?: number; delaySeconds?: number }) =>
  api.post<{ data: string }>('/admin/ai/fill-answer-batch', params).then(res => res.data.data)

export const getBatchFillAnswerStatus = () =>
  api.get<{ data: BatchProgress }>('/admin/ai/fill-answer-batch/status').then(res => res.data.data)
```

- [ ] **Step 2: Add page UI**

Add a background batch form under the stream-fill section with category, optional max count, delay seconds, start button, and progress card.

- [ ] **Step 3: Run frontend build**

Run:

```bash
cd frontend
npm run build
```

Expected: TypeScript and Vite build pass.

### Task 5: Final Verification

**Files:**
- No new files.

- [ ] **Step 1: Run backend focused tests**

Run:

```bash
cd backend
mvn -Dtest=AiGenerationControllerTest,AiQuestionServiceTest,BatchFillAnswerRunnerTest test
```

- [ ] **Step 2: Check git diff**

Run:

```bash
git status --short
git diff --stat
```

Expected: only planned files changed, plus the pre-existing user change in `backend/src/main/resources/application.yml`.
