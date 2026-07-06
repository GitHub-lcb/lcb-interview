# LCB Interview Free Superiority Design

## Background

The product goal is no longer a generic local question-bank clone. The site must become a free interview preparation system that is clearly stronger in the areas a job seeker feels every day: no paywall, structured answers, study routing, simulated interview practice, review queues, and practical interview scenarios.

Current public question-bank product signals checked on 2026-06-17:

- Public question-bank products commonly advertise large interview-question collections, question banks, study routes, AI interview entries, spring recruitment hot topics, real interview experiences, communities, mini program access, and membership.
- Some public question/tag pages show VIP labels on questions.
- The about page positions the product around broad coverage, original explanations, continuous updates, and mobile learning.

LCB Interview already has a Spring Boot + React question bank, 6386 imported questions, study progress, study plan, answer quality panels, and simulated interview scoring. The next step is to present and connect those capabilities as a stronger free workflow.

## Principle

Every public learning feature must be free:

- No VIP-only questions.
- No paid answer unlock.
- No membership gate on study routes, practice, or answer quality views.
- AI evaluation may degrade to local rule-based scoring when the backend AI provider is unavailable, but the user must still get usable feedback for free.

## Recommended Approach

Choose an incremental "free study system" approach:

1. Upgrade public positioning and navigation so the first impression is "free full-access preparation", not a generic question list.
2. Add route and interview-scenario pages that make the existing question data feel curated.
3. Deepen the existing study/practice loop with clear entry points from home, banks, detail, and study pages.

This wins faster than trying to immediately match competitor ecosystem breadth such as mini programs, IDE plugins, and full community features. Those require separate distribution, moderation, and account-system work.

## First Implementation Scope

### Home

Add a compact free-access comparison band near the top:

- 6386 current questions, 46 categories.
- Full answers free.
- Study plan and mock interview free.
- No VIP labels or paid unlocks.

Keep the page as a working study dashboard, not a marketing landing page.

### Navigation

Add first-class routes:

- `/routes`: interview preparation routes.
- `/experiences`: company and scenario interview preparation.
- Existing `/study` and `/practice` remain core workflows.

### Routes Page

Create a route page with practical tracks:

- Java backend.
- Frontend.
- AI application.
- System design and operations.

Each route should show stages, related categories, daily action, and direct links into existing question banks or search. This gives users an organized alternative to browsing categories blindly.

### Experiences Page

Create a free interview-scenario page:

- Company-style question sets.
- Scenario drills such as project deep-dive, online incident analysis, system design, and HR.
- Each set links into existing categories/search/practice rather than requiring a new backend schema.

### Question Detail

Keep the existing structured answer modules and answer quality panel. Strengthen the visible message that the answer, follow-up prompts, weak-point marking, and mock interview entry are free.

### Study And Practice

Keep local progress as the first implementation layer:

- No account dependency.
- Local review queue.
- Local/remote fallback interview scoring.
- Saved attempts per question.

## Later Phases

1. Backend account sync while preserving anonymous local use.
2. Real company interview experience submissions and moderation.
3. Public changelog for content updates.
4. More question coverage to exceed 10k.
5. IDE plugin and mobile/web app only after the web product loop is strong.

## Acceptance Criteria

- The app visibly states that core learning capabilities are free and ungated.
- Header navigation exposes Routes, Experiences, Study, and Practice.
- `/routes` renders curated preparation tracks with actionable links.
- `/experiences` renders company/scenario preparation sets with actionable links.
- Existing question detail, study, and practice flows remain reachable.
- Frontend tests/build pass.
- No backend schema change is required for this phase.

