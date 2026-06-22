# Backend Interview Coach Phase 5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move interview scoring behind a backend API while keeping the frontend local scoring fallback.

**Architecture:** The backend exposes `POST /api/interview/evaluate` with request/response records and a deterministic `InterviewCoachService`. The frontend calls the API through a small isolated client and falls back to `evaluateInterviewAnswer` if the backend is unavailable or returns a non-200 payload.

**Tech Stack:** Spring Boot 3, Java 21 records, Jakarta Validation, MockMvc, React 18, Axios, Vitest.

---

### Task 1: Backend Scoring Contract

**Files:**
- Create: `backend/src/main/java/com/lcbinterview/dto/InterviewEvaluateRequest.java`
- Create: `backend/src/main/java/com/lcbinterview/dto/InterviewCriterionVO.java`
- Create: `backend/src/main/java/com/lcbinterview/dto/InterviewFeedbackVO.java`
- Create: `backend/src/main/java/com/lcbinterview/service/InterviewCoachService.java`
- Test: `backend/src/test/java/com/lcbinterview/service/InterviewCoachServiceTest.java`

- [ ] Write service tests for blank, strong, and shallow answers.
- [ ] Implement deterministic scoring with coverage, structure, specificity, and risk criteria.
- [ ] Return `source = "RULE_BASED"` so the frontend can show whether the backend was used.

### Task 2: Backend API Endpoint

**Files:**
- Create: `backend/src/main/java/com/lcbinterview/controller/InterviewCoachController.java`
- Test: `backend/src/test/java/com/lcbinterview/controller/InterviewCoachControllerTest.java`

- [ ] Write MockMvc test for `POST /api/interview/evaluate`.
- [ ] Implement controller returning `ResponseEntity<ApiResponse<InterviewFeedbackVO>>`.
- [ ] Add Swagger annotations and validation on request body.

### Task 3: Frontend Remote Evaluation

**Files:**
- Create: `frontend/src/api/interview.ts`
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/pages/Practice/index.tsx`

- [ ] Add request/response types that map to existing `InterviewFeedback`.
- [ ] Call backend first from `submitAnswer`.
- [ ] On request failure, call local `evaluateInterviewAnswer` and tag feedback as local fallback.
- [ ] Keep attempt persistence unchanged.

### Task 4: Verification

**Commands:**
- `mvn test`
- `npm run test`
- `npm run build`
- Browser QA with backend unavailable: submit answer, confirm local fallback still renders.
- `git diff --check`
