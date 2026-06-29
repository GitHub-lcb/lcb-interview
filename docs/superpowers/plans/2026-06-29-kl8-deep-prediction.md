# 快乐8深度预测 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade 福彩快乐8选5 from shallow hot/cold prompting to a persisted, multi-dimensional AI-assisted analysis workflow.

**Architecture:** Keep the existing synchronous Spring service and React panel. Add deep feature records and candidate-pool generation in the backend, feed structured JSON to the existing AI model, persist optional analysis fields, and render richer sections in the frontend.

**Tech Stack:** Spring Boot 3, MyBatis-Plus, JDK 21 records, Jackson, JUnit 5, React 18, Vite, Ant Design 5.

---

## Files

- Create `backend/src/main/java/com/lcbinterview/service/LotteryKl8NumberProfile.java`: per-number feature record.
- Create `backend/src/main/java/com/lcbinterview/service/LotteryKl8CandidateNumber.java`: candidate-pool item record.
- Create `backend/src/main/java/com/lcbinterview/service/LotteryKl8RecommendationEvaluationService.java`: settle recommendations against the next draw.
- Create `backend/src/main/java/com/lcbinterview/service/LotteryKl8StrategyCalibrationService.java`: turn settled hit history into dynamic strategy multipliers.
- Modify `backend/src/main/java/com/lcbinterview/service/LotteryKl8FeatureReport.java`: add deep fields and compatibility constructor use sites.
- Modify `backend/src/main/java/com/lcbinterview/service/LotteryKl8FeatureService.java`: compute deep features.
- Modify `backend/src/main/java/com/lcbinterview/service/LotteryKl8AiRecommendationService.java`: send structured deep analysis prompt.
- Modify `backend/src/main/java/com/lcbinterview/service/LotteryKl8RecommendationPolicy.java`: validate new AI JSON and improve fallback.
- Modify `backend/src/main/java/com/lcbinterview/service/LotteryKl8RecommendationService.java`: persist analysis/candidate fields.
- Modify `backend/src/main/java/com/lcbinterview/model/LotteryKl8Recommendation.java`: add nullable fields.
- Modify `backend/src/main/java/com/lcbinterview/dto/tools/LotteryKl8RecommendationVO.java`: expose analysis and candidate pool JSON.
- Modify `backend/scripts/sql/init.sql`: add new columns for fresh installs.
- Modify deploy migration script if deployment is requested.
- Modify `frontend/src/types.ts`, `frontend/src/api/tools.ts`, `frontend/src/components/LotteryKl8Panel.tsx`, `frontend/src/styles/global.css`: render deep analysis.

## Tasks

- [x] Write failing backend tests for deep feature profile and candidate pool generation.
- [x] Implement deep feature records and calculations.
- [x] Write failing policy tests for the new AI JSON contract.
- [x] Implement new validation, fallback metadata, and backward compatibility.
- [x] Persist analysis JSON, candidate pool JSON, and strategy version.
- [x] Write failing backend tests for hit settlement and feedback calibration.
- [x] Implement next-draw hit settlement and dynamic strategy calibration.
- [x] Update SQL init schema and deploy migration path without data overwrite.
- [x] Update frontend types and panel UI.
- [x] Run `mvn test` in `backend/`.
- [x] Run `npm run build` in `frontend/`.
