# Personal Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multi-user personal tools area with username/password auth, a backend-persisted reading excerpt library, and a 福彩快乐8选5 AI recommendation tool.

**Architecture:** Add a minimal ordinary-user auth layer separate from the existing admin token, then add focused Spring services for reading excerpts, lottery draw sync, feature extraction, AI recommendations, rule validation, and fallback. The React app gets login/register routes, a `/tools` entry, typed API wrappers, and Ant Design panels that use the backend as the source of truth.

**Tech Stack:** Spring Boot 3.2, MyBatis-Plus, JDK 21, JDK PBKDF2 password hashing, Java HttpClient, React 18, Vite, TypeScript, Ant Design 5, Vitest, JUnit 5.

---

## File Structure

### Backend

- Modify `backend/pom.xml`: keep dependencies unchanged and use JDK PBKDF2 for password hashing.
- Modify `backend/src/main/resources/application.yml`: add `app.auth.secret` and `app.auth.token-ttl-hours`.
- Modify `backend/scripts/sql/init.sql`: create `app_user`, `reading_excerpt`, `lottery_kl8_draw`, `lottery_kl8_recommendation`.
- Create `backend/src/main/java/com/lcbinterview/model/AppUser.java`: ordinary user entity.
- Create `backend/src/main/java/com/lcbinterview/model/ReadingExcerpt.java`: reading excerpt entity.
- Create `backend/src/main/java/com/lcbinterview/model/LotteryKl8Draw.java`: draw entity.
- Create `backend/src/main/java/com/lcbinterview/model/LotteryKl8Recommendation.java`: recommendation history entity.
- Create `backend/src/main/java/com/lcbinterview/mapper/AppUserMapper.java`, `ReadingExcerptMapper.java`, `LotteryKl8DrawMapper.java`, `LotteryKl8RecommendationMapper.java`.
- Create `backend/src/main/java/com/lcbinterview/dto/auth/*`: auth request and VO records.
- Create `backend/src/main/java/com/lcbinterview/dto/tools/*`: reading and lottery request/VO records.
- Create `backend/src/main/java/com/lcbinterview/config/AuthUserContext.java`: request-scoped ordinary user context.
- Create `backend/src/main/java/com/lcbinterview/config/UserAuthInterceptor.java`: protects `/api/tools/**` and `/api/auth/me`.
- Create `backend/src/main/java/com/lcbinterview/config/WebMvcAuthConfig.java`: registers the interceptor.
- Create `backend/src/main/java/com/lcbinterview/service/AuthTokenService.java`: HMAC token creation and parsing.
- Create `backend/src/main/java/com/lcbinterview/service/AppUserService.java`: registration/login/current-user service.
- Create `backend/src/main/java/com/lcbinterview/service/ReadingExcerptService.java`: reading CRUD/search/export service.
- Create `backend/src/main/java/com/lcbinterview/service/LotteryKl8DrawFetcher.java`: fetcher interface.
- Create `backend/src/main/java/com/lcbinterview/service/ZhcwKl8DrawFetcher.java`: public web page fetcher.
- Create `backend/src/main/java/com/lcbinterview/service/LotteryKl8SyncService.java`: scheduled/manual sync service.
- Create `backend/src/main/java/com/lcbinterview/service/LotteryKl8FeatureService.java`: feature extraction.
- Create `backend/src/main/java/com/lcbinterview/service/LotteryKl8RecommendationPolicy.java`: AI output validation and fallback generation.
- Create `backend/src/main/java/com/lcbinterview/service/LotteryKl8AiRecommendationService.java`: AI call using existing runtime config.
- Create `backend/src/main/java/com/lcbinterview/service/LotteryKl8RecommendationService.java`: recommendation orchestration.
- Create `backend/src/main/java/com/lcbinterview/controller/AuthController.java`.
- Create `backend/src/main/java/com/lcbinterview/controller/tools/ReadingToolController.java`.
- Create `backend/src/main/java/com/lcbinterview/controller/tools/LotteryKl8Controller.java`.
- Create focused backend tests under `backend/src/test/java/com/lcbinterview/service/`.

### Frontend

- Modify `frontend/src/types.ts`: add auth, reading, draw, sync, and recommendation types.
- Modify `frontend/src/api/index.ts`: attach ordinary user token to `/tools/**` and `/auth/me`; handle 401 by clearing token.
- Create `frontend/src/api/auth.ts`: register/login/me wrappers.
- Create `frontend/src/api/tools.ts`: reading and lottery wrappers.
- Create `frontend/src/utils/authToken.ts`: localStorage helpers.
- Create `frontend/src/pages/Auth/Login.tsx` and `Register.tsx`.
- Create `frontend/src/pages/Tools/index.tsx`.
- Create `frontend/src/components/ReadingExcerptPanel.tsx`.
- Create `frontend/src/components/LotteryKl8Panel.tsx`.
- Modify `frontend/src/App.tsx`: add auth and tools routes.
- Modify `frontend/src/components/Layout/Header.tsx`: add “工具” nav item.
- Modify `frontend/src/styles/global.css`: add responsive tool, auth, reading, lottery styles.
- Create focused frontend tests for token helpers, routes, and panels.

## Task 1: Schema, Dependency, And Config

**Files:**
- Modify: `backend/pom.xml`
- Modify: `backend/src/main/resources/application.yml`
- Modify: `backend/scripts/sql/init.sql`

- [ ] Keep `backend/pom.xml` free of new security dependencies; implement password hashing with JDK `PBKDF2WithHmacSHA256`.

- [ ] Add ordinary-user auth configuration to `application.yml`.

```yaml
app:
  auth:
    secret: ${APP_AUTH_SECRET:dev-user-auth-secret-change-me}
    token-ttl-hours: ${APP_AUTH_TOKEN_TTL_HOURS:168}
```

- [ ] Insert four `CREATE TABLE IF NOT EXISTS` statements in `backend/scripts/sql/init.sql` after `ai_config`, and add matching `DROP TABLE IF EXISTS` lines before existing drops.
- [ ] Run `cd backend && mvn test -DskipTests=false` after compilation code exists; before Task 2 this may fail because entities do not exist yet.

## Task 2: Auth Backend

**Files:**
- Create: `model/AppUser.java`
- Create: `mapper/AppUserMapper.java`
- Create: `dto/auth/RegisterRequest.java`, `LoginRequest.java`, `AuthUserVO.java`, `AuthTokenVO.java`
- Create: `service/AuthTokenService.java`, `service/AppUserService.java`
- Create: `config/AuthUserContext.java`, `config/UserAuthInterceptor.java`, `config/WebMvcAuthConfig.java`
- Create: `controller/AuthController.java`
- Test: `service/AuthTokenServiceTest.java`, `service/AppUserServiceTest.java`

- [ ] Write `AuthTokenServiceTest` first for token round trip, bad signature, and expired token.
- [ ] Implement `AuthTokenService` using `HmacSHA256`, Base64 URL encoding, `userId:expiresAt:signature` payload, and `BusinessException(401, "登录状态已失效")` for invalid tokens.
- [ ] Write `AppUserServiceTest` for registration, duplicate username, login success, login password failure, and disabled user rejection.
- [ ] Implement `AppUserService` with username pattern `^[A-Za-z0-9_]{3,32}$`, minimum password length 8, and PBKDF2 password hashing.
- [ ] Implement `AuthController` returning `ResponseEntity<ApiResponse<AuthTokenVO>>` for register/login and `AuthUserVO` for `/api/auth/me`.
- [ ] Implement `UserAuthInterceptor` to read `Authorization: Bearer <token>`, resolve user id, set `AuthUserContext`, and clear it in `afterCompletion`.
- [ ] Register the interceptor only for `/api/tools/**` and `/api/auth/me`, leaving public question APIs and `/api/admin/**` untouched.
- [ ] Run `cd backend && mvn test -Dtest=AuthTokenServiceTest,AppUserServiceTest`.

## Task 3: Frontend Auth

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/api/index.ts`
- Create: `frontend/src/api/auth.ts`
- Create: `frontend/src/utils/authToken.ts`
- Create: `frontend/src/pages/Auth/Login.tsx`
- Create: `frontend/src/pages/Auth/Register.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/utils/authToken.test.ts`, `frontend/src/pages/Auth/Login.test.tsx`, `Register.test.tsx`

- [ ] Add `AuthUser`, `AuthTokenResponse`, `LoginRequest`, and `RegisterRequest` types.
- [ ] Implement `authToken.ts` with `readUserToken()`, `writeUserToken(token)`, and `clearUserToken()`.
- [ ] Update `api/index.ts` request interceptor so ordinary user tokens attach only to `/tools/` and `/auth/me`, while admin tokens still attach only to `/admin/`.
- [ ] Update response interceptor so HTTP 401 clears ordinary user token and emits the existing feedback message.
- [ ] Build login and register pages with Ant Design `Form`, `Input`, and `Button`; successful login/register writes token and navigates to `/tools`.
- [ ] Add lazy routes `/auth/login` and `/auth/register`.
- [ ] Run `cd frontend && npm run test -- authToken Login Register globalError`.

## Task 4: Reading Backend

**Files:**
- Create: `model/ReadingExcerpt.java`
- Create: `mapper/ReadingExcerptMapper.java`
- Create: `dto/tools/ReadingExcerptCreateRequest.java`, `ReadingExcerptUpdateRequest.java`, `ReadingExcerptVO.java`, `ReadingExcerptQuery.java`, `MarkdownExportVO.java`
- Create: `service/ReadingExcerptService.java`
- Create: `controller/tools/ReadingToolController.java`
- Test: `service/ReadingExcerptServiceTest.java`

- [ ] Write service tests for create, update owner check, delete owner check, keyword search, tag filter, and Markdown export.
- [ ] Implement entity with field comments and Javadoc.
- [ ] Store tags as comma-separated normalized text in the table; expose tags as `List<String>` in DTOs.
- [ ] Use `LambdaQueryWrapper` with `userId` in every query and update path.
- [ ] For export, return Markdown grouped by book title with excerpt, note, tags, chapter, and page number.
- [ ] Add controller endpoints under `/api/tools/reading/excerpts`.
- [ ] Run `cd backend && mvn test -Dtest=ReadingExcerptServiceTest`.

## Task 5: Reading Frontend

**Files:**
- Modify: `frontend/src/types.ts`
- Create or extend: `frontend/src/api/tools.ts`
- Create: `frontend/src/components/ReadingExcerptPanel.tsx`
- Create: `frontend/src/pages/Tools/index.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Layout/Header.tsx`
- Modify: `frontend/src/styles/global.css`
- Test: `frontend/src/components/ReadingExcerptPanel.test.tsx`, `frontend/src/pages/Tools/index.test.tsx`

- [ ] Add reading API wrappers for list/create/update/delete/export.
- [ ] Build `/tools` as a protected page: if no ordinary user token is present, navigate to `/auth/login`.
- [ ] Build `ReadingExcerptPanel` with keyword search, tag input, book title input, list, modal form, delete confirmation, and Markdown export download.
- [ ] Add “工具” nav item with `ToolOutlined` or the closest available Ant Design icon.
- [ ] Add responsive styles using 8px card radius, restrained dashboard-like layout, and no nested card containers.
- [ ] Run `cd frontend && npm run test -- ReadingExcerptPanel Tools`.

## Task 6: Lottery Draw Sync Backend

**Files:**
- Create: `model/LotteryKl8Draw.java`
- Create: `mapper/LotteryKl8DrawMapper.java`
- Create: `dto/tools/LotteryKl8DrawVO.java`, `LotteryKl8SyncStatusVO.java`, `LotteryKl8SyncResultVO.java`
- Create: `service/LotteryKl8DrawFetcher.java`
- Create: `service/ZhcwKl8DrawFetcher.java`
- Create: `service/LotteryKl8SyncService.java`
- Extend: `controller/tools/LotteryKl8Controller.java`
- Test: `service/LotteryKl8SyncServiceTest.java`

- [ ] Write parser tests using an inline HTML fixture with issue number, date, and 20 numbers.
- [ ] Implement `LotteryKl8DrawFetcher` so production can fetch public HTML and tests can inject fixed HTML.
- [ ] Implement `ZhcwKl8DrawFetcher` with Java `HttpClient`, timeout, and HTML parsing tolerant of whitespace and tags.
- [ ] Implement sync service with issue-number de-duplication and stale-data status.
- [ ] Add `@Scheduled` daily sync method; scheduling is already enabled if the app has `@EnableScheduling`, otherwise add it to `LcbInterviewApplication`.
- [ ] Add endpoints for sync, sync-status, and draw list.
- [ ] Run `cd backend && mvn test -Dtest=LotteryKl8SyncServiceTest`.

## Task 7: Lottery Feature, AI Recommendation, And Fallback

**Files:**
- Create: `model/LotteryKl8Recommendation.java`
- Create: `mapper/LotteryKl8RecommendationMapper.java`
- Create: `dto/tools/LotteryKl8RecommendationRequest.java`, `LotteryKl8RecommendationVO.java`, `LotteryKl8RecommendationGroupVO.java`
- Create: `service/LotteryKl8FeatureService.java`
- Create: `service/LotteryKl8RecommendationPolicy.java`
- Create: `service/LotteryKl8AiRecommendationService.java`
- Create: `service/LotteryKl8RecommendationService.java`
- Extend: `controller/tools/LotteryKl8Controller.java`
- Test: `LotteryKl8FeatureServiceTest.java`, `LotteryKl8RecommendationPolicyTest.java`, `LotteryKl8RecommendationServiceTest.java`

- [ ] Write feature tests for hot numbers, cold numbers, missing count, odd/even ratio, range distribution, and tail distribution.
- [ ] Implement `LotteryKl8FeatureService` from recent draws sorted by newest issue.
- [ ] Write policy tests for valid AI JSON, invalid range, duplicate in group, duplicate full group, missing reason, and fallback generation.
- [ ] Implement policy validation to always return exactly 5 groups of 5 valid numbers or throw before fallback.
- [ ] Implement `LotteryKl8AiRecommendationService` using `AiRuntimeConfigService.current()`, same OpenAI-compatible chat-completions shape as `DeepSeekInterviewClient`, and a JSON-only prompt.
- [ ] Implement recommendation service: require at least 20 draws, call AI, validate, fallback on any exception, persist history with source `AI` or `RULE_BASED`.
- [ ] Add recommendation create/list endpoints.
- [ ] Run `cd backend && mvn test -Dtest=LotteryKl8FeatureServiceTest,LotteryKl8RecommendationPolicyTest,LotteryKl8RecommendationServiceTest`.

## Task 8: Lottery Frontend

**Files:**
- Modify: `frontend/src/types.ts`
- Extend: `frontend/src/api/tools.ts`
- Create: `frontend/src/components/LotteryKl8Panel.tsx`
- Modify: `frontend/src/pages/Tools/index.tsx`
- Modify: `frontend/src/styles/global.css`
- Test: `frontend/src/components/LotteryKl8Panel.test.tsx`

- [ ] Add lottery types and API wrappers.
- [ ] Build sync status card with latest issue, draw date, draw count, stale flag, and manual sync button.
- [ ] Build recommendation action with base issue count selector and “AI 推荐 5 组” button.
- [ ] Render exactly 5 group cards with 5 number pills each, source label, reason, latest issue, and disclaimer.
- [ ] Render recommendation history and latest draws.
- [ ] Ensure disclaimer is visible before and after generating recommendations.
- [ ] Run `cd frontend && npm run test -- LotteryKl8Panel Tools`.

## Task 9: Integration, Docs, And Verification

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md` only if new commands or conventions are required; otherwise leave untouched.
- All changed files.

- [ ] Update README core capabilities, environment variables, routes, and API overview for ordinary auth, tools, reading excerpts, and lottery recommendation.
- [ ] Run `cd backend && mvn test`.
- [ ] Run `cd frontend && npm run test`.
- [ ] Run `cd frontend && npm run build`.
- [ ] Run `git diff --check`.
- [ ] Manually inspect `git status --short` and ensure only intended files changed.
- [ ] Commit implementation with Chinese message `功能：新增个人工具与快乐8推荐`.

## Self-Review

- Spec coverage: this plan covers ordinary auth, backend persistence, reading excerpt CRUD/search/export, public web draw sync, scheduled and manual sync, AI recommendation with existing model config, backend validation, rule fallback, recommendation history, frontend routes, disclaimer, and tests.
- Open-marker scan: no unresolved or deferred implementation markers are present.
- Type consistency: DTO names, route paths, table names, and frontend type names match the design document.
- Scope control: no betting, payment, OAuth, password reset, third-party paid API, or admin/user permission merger is included.
