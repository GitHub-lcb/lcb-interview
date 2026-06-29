# 快乐8预测引擎 V3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将快乐8选5推荐升级为回测驱动的深度预测引擎，并完成验证、提交、推送和远程部署。

**Architecture:** 后端在现有历史特征报告中新增滚动回测摘要、因子表现、组合包优化结果；AI 只负责审稿和解释，号码生成优先由可测试的后端优化器完成。前端复用现有 Tabs，在候选池/反馈区域展示回测命中分布、动态权重和组合包风险。

**Tech Stack:** Spring Boot 3、MyBatis-Plus、JDK 21 records、Jackson、React 18、Vite、Ant Design 5、Vitest、JUnit 5。

---

### Task 1: 回测摘要模型

**Files:**
- Create: `backend/src/main/java/com/lcbinterview/service/LotteryKl8BacktestSummary.java`
- Modify: `backend/src/main/java/com/lcbinterview/service/LotteryKl8FeatureReport.java`
- Test: `backend/src/test/java/com/lcbinterview/service/LotteryKl8FeatureServiceDeepTest.java`

- [ ] **Step 1: Write the failing test**

Add assertions that `report.backtestSummary()` is present, has evaluated issue count, hit distribution, and factor weights.

- [ ] **Step 2: Run test to verify it fails**

Run: `mvn -Dtest=LotteryKl8FeatureServiceDeepTest test`

- [ ] **Step 3: Add records and feature report field**

Create records for backtest summary, factor weights, hit distribution and portfolio diagnostics.

- [ ] **Step 4: Run test to verify it passes**

Run: `mvn -Dtest=LotteryKl8FeatureServiceDeepTest test`

### Task 2: 回测与动态调权

**Files:**
- Modify: `backend/src/main/java/com/lcbinterview/service/LotteryKl8FeatureService.java`
- Test: `backend/src/test/java/com/lcbinterview/service/LotteryKl8FeatureServiceDeepTest.java`

- [ ] **Step 1: Write failing tests**

Assert that a synthetic hot number receives a higher backtest factor weight and that backtest sample count is capped to keep runtime bounded.

- [ ] **Step 2: Run test to verify it fails**

Run: `mvn -Dtest=LotteryKl8FeatureServiceDeepTest test`

- [ ] **Step 3: Implement rolling backtest**

Use chronological historical draws to score factor families against subsequent draw outcomes. Compute weights for hot, missing, trend, decay, pair, and balance. Keep runtime bounded by evaluating recent 180 settled transitions.

- [ ] **Step 4: Run test to verify it passes**

Run: `mvn -Dtest=LotteryKl8FeatureServiceDeepTest test`

### Task 3: 组合包优化

**Files:**
- Create: `backend/src/main/java/com/lcbinterview/service/LotteryKl8OptimizedPortfolio.java`
- Modify: `backend/src/main/java/com/lcbinterview/service/LotteryKl8FeatureReport.java`
- Modify: `backend/src/main/java/com/lcbinterview/service/LotteryKl8RecommendationPolicy.java`
- Test: `backend/src/test/java/com/lcbinterview/service/LotteryKl8RecommendationPolicyTest.java`

- [ ] **Step 1: Write failing tests**

Assert fallback recommendations use optimized portfolio groups, keep 5 groups of 5 unique numbers, reduce overlap, and include optimization evidence in reasons.

- [ ] **Step 2: Run test to verify it fails**

Run: `mvn -Dtest=LotteryKl8RecommendationPolicyTest test`

- [ ] **Step 3: Implement optimized portfolio**

Generate deterministic groups from scored candidate profiles. Penalize group overlap, same range clustering, same tail clustering, parity imbalance, and weak backtest support.

- [ ] **Step 4: Run test to verify it passes**

Run: `mvn -Dtest=LotteryKl8RecommendationPolicyTest test`

### Task 4: AI 输入和前端展示

**Files:**
- Modify: `backend/src/main/java/com/lcbinterview/service/LotteryKl8AiRecommendationService.java`
- Modify: `backend/src/main/java/com/lcbinterview/service/LotteryKl8RecommendationService.java`
- Modify: `frontend/src/components/LotteryKl8Panel.tsx`
- Modify: `frontend/src/types.ts`
- Test: `frontend/src/api/tools.test.ts`

- [ ] **Step 1: Extend serialized analysis**

Include backtest summary and optimized portfolio in `analysisJson` and `candidatePoolJson` compatible structures.

- [ ] **Step 2: Display backtest and portfolio evidence**

Add compact UI sections for evaluated sample count, average/max hit, hit distribution, factor weights, and portfolio diagnostics.

- [ ] **Step 3: Verify frontend**

Run: `npm run test -- src/api/tools.test.ts` and `npm run build`.

### Task 5: Final verification and release

**Files:**
- No source-only file requirement beyond previous tasks.

- [ ] **Step 1: Run full checks**

Run: `mvn test`, `npm run test -- src/api/tools.test.ts`, `npm run build`, `git diff --check`.

- [ ] **Step 2: Commit and push**

Commit with Chinese message and push `codex/personal-tools`.

- [ ] **Step 3: Deploy**

Run `lcb-interview-deploy` script and verify `http://106.12.166.113/`, `/admin/login`, and `/api/categories`.
