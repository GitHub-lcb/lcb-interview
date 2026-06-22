# Free Superiority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first visible phase of a fully free interview preparation system that is stronger than a plain question-bank clone.

**Architecture:** Add a shared static data module for free-access promises, preparation routes, and interview scenario sets. Use new React pages for `/routes` and `/experiences`, then wire them into the existing lazy route tree and header. Keep all data local and reuse existing question bank, search, study, and practice routes.

**Tech Stack:** React 18, Vite, TypeScript, Ant Design 5, Vitest.

---

## File Structure

- Create `frontend/src/data/freeSuperiority.ts`: shared product data for free promise items, prep routes, and experience sets.
- Create `frontend/src/data/freeSuperiority.test.ts`: tests that prevent accidental paywall/VIP wording in the free promise.
- Create `frontend/src/pages/PrepRoutes/index.tsx`: route-oriented study page.
- Create `frontend/src/pages/Experiences/index.tsx`: company/scenario interview preparation page.
- Modify `frontend/src/App.tsx`: add lazy imports and routes for `/routes` and `/experiences`.
- Modify `frontend/src/components/Layout/Header.tsx`: add nav items for routes and experiences with readable labels.
- Modify `frontend/src/pages/Home/index.tsx`: add a free-access band above question-bank entry.
- Modify `frontend/src/pages/QuestionDetail/index.tsx`: add a small free-access cue near the question actions.
- Modify `frontend/src/styles/global.css`: add responsive styles for the new pages and band.

## Task 1: Shared Free Product Data

**Files:**
- Create: `frontend/src/data/freeSuperiority.ts`
- Create: `frontend/src/data/freeSuperiority.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, expect, it } from 'vitest'
import { freePromiseItems, prepRoutes, experienceSets } from './freeSuperiority'

describe('freeSuperiority data', () => {
  it('keeps public learning promises free and ungated', () => {
    const combinedText = freePromiseItems
      .flatMap(item => [item.title, item.description])
      .join(' ')

    expect(combinedText).toContain('免费')
    expect(combinedText).not.toMatch(/VIP|会员专属|付费解锁|购买/)
  })

  it('defines actionable preparation routes and experience sets', () => {
    expect(prepRoutes.length).toBeGreaterThanOrEqual(4)
    expect(experienceSets.length).toBeGreaterThanOrEqual(4)
    expect(prepRoutes.every(route => route.actions.length > 0)).toBe(true)
    expect(experienceSets.every(set => set.actions.length > 0)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the failing test**

Run: `cd frontend && npm run test -- freeSuperiority`

Expected: fail because `frontend/src/data/freeSuperiority.ts` does not exist.

- [ ] **Step 3: Implement the data module**

Create `frontend/src/data/freeSuperiority.ts` exporting:

```ts
export interface ActionLink {
  label: string
  to: string
}

export interface FreePromiseItem {
  metric: string
  title: string
  description: string
}

export interface PrepRoute {
  id: string
  title: string
  role: string
  duration: string
  summary: string
  stages: string[]
  categories: string[]
  actions: ActionLink[]
}

export interface ExperienceSet {
  id: string
  title: string
  companyType: string
  summary: string
  drills: string[]
  actions: ActionLink[]
}

export const freePromiseItems: FreePromiseItem[] = [
  {
    metric: '0',
    title: '无会员墙',
    description: '题目、答案、追问、路线和模拟面试都保持免费开放。',
  },
  {
    metric: '6386',
    title: '当前题量',
    description: '覆盖 46 个方向，并继续扩充到更完整的岗位知识图谱。',
  },
  {
    metric: '100%',
    title: '答案可看',
    description: '不设置付费解锁，优先把每道题打磨成可直接开口回答的结构。',
  },
  {
    metric: 'AI+规则',
    title: '免费评分',
    description: 'AI 不可用时自动降级为本地规则评分，练习不中断。',
  },
]

export const prepRoutes: PrepRoute[] = [
  {
    id: 'java-backend',
    title: 'Java 后端冲刺路线',
    role: 'Java 后端',
    duration: '21 天',
    summary: '从 Java 基础、并发、JVM、Spring、MySQL、Redis 到系统设计，按面试高频顺序推进。',
    stages: ['基础与集合', '并发与 JVM', 'Spring 与中间件', '数据库与缓存', '系统设计与场景题'],
    categories: ['Java 基础', 'Java 并发', 'JVM', 'Spring', 'MySQL', 'Redis', '后端系统设计'],
    actions: [
      { label: '打开 Java 题库', to: '/search?q=Java' },
      { label: '开始模拟面试', to: '/practice' },
    ],
  },
  {
    id: 'frontend',
    title: '前端工程化路线',
    role: '前端开发',
    duration: '18 天',
    summary: '覆盖 JavaScript、TypeScript、Vue、React、手写代码、工程化和性能优化。',
    stages: ['语言基础', '框架原理', '手写代码', '工程化', '性能与场景题'],
    categories: ['JavaScript', 'TypeScript', 'Vue', 'React', '前端工程化', '前端手写代码'],
    actions: [
      { label: '搜索前端题', to: '/search?q=前端' },
      { label: '进入学习计划', to: '/study' },
    ],
  },
  {
    id: 'ai-application',
    title: 'AI 应用开发路线',
    role: 'AI 应用工程师',
    duration: '14 天',
    summary: '集中训练大模型、RAG、Agent、Prompt、LangChain、评测和部署问题。',
    stages: ['大模型基础', 'RAG 检索增强', 'Agent 工程', 'Prompt 与评测', '部署与项目复盘'],
    categories: ['AI 大模型', 'AI 项目实战', 'Python', '系统设计'],
    actions: [
      { label: '打开 AI 题', to: '/search?q=RAG' },
      { label: '练习项目追问', to: '/practice' },
    ],
  },
  {
    id: 'architecture-ops',
    title: '架构与运维路线',
    role: '后端/运维进阶',
    duration: '16 天',
    summary: '把系统设计、线上排查、Docker、K8s、Nginx、Linux、DevOps 连成一条面试线。',
    stages: ['网络与 Linux', '容器与发布', '服务治理', '线上故障', '架构方案表达'],
    categories: ['计算机网络', 'Linux', 'Docker 与 K8s', 'Nginx', 'DevOps', '系统运维'],
    actions: [
      { label: '搜索系统设计', to: '/search?q=系统设计' },
      { label: '复习弱项', to: '/study' },
    ],
  },
]

export const experienceSets: ExperienceSet[] = [
  {
    id: 'big-tech-java',
    title: '大厂 Java 后端面试组',
    companyType: '一二线互联网',
    summary: '按真实面试节奏组合基础、项目、分布式、数据库和缓存追问。',
    drills: ['自我介绍后的项目深挖', 'JVM 与并发追问', '缓存一致性场景', '系统设计表达'],
    actions: [
      { label: '刷后端场景题', to: '/search?q=后端场景' },
      { label: '开始一轮练习', to: '/practice' },
    ],
  },
  {
    id: 'startup-fullstack',
    title: '中小厂全栈实战组',
    companyType: '成长型团队',
    summary: '强调能落地、能排障、能独立推进业务的综合题。',
    drills: ['接口设计', '前后端联调', '性能瓶颈定位', '上线回滚方案'],
    actions: [
      { label: '搜索工程化', to: '/search?q=工程化' },
      { label: '打开学习计划', to: '/study' },
    ],
  },
  {
    id: 'ai-product',
    title: 'AI 项目实战追问组',
    companyType: 'AI 产品团队',
    summary: '围绕 RAG、Agent、评测、成本和稳定性进行项目级追问。',
    drills: ['RAG 召回率优化', 'Agent 工具调用', '模型评测指标', '线上成本控制'],
    actions: [
      { label: '搜索 AI 项目', to: '/search?q=AI 项目' },
      { label: '模拟项目追问', to: '/practice' },
    ],
  },
  {
    id: 'hr-final',
    title: 'HR 与终面表达组',
    companyType: '通用终面',
    summary: '补齐动机、稳定性、协作、冲突处理和职业规划表达。',
    drills: ['离职与求职动机', '项目冲突复盘', '优势劣势表达', '薪资与入职节奏'],
    actions: [
      { label: '搜索 HR 面试', to: '/search?q=HR' },
      { label: '记录练习结果', to: '/study' },
    ],
  },
]
```

- [ ] **Step 4: Run the data test**

Run: `cd frontend && npm run test -- freeSuperiority`

Expected: pass.

## Task 2: New Routes And Experiences Pages

**Files:**
- Create: `frontend/src/pages/PrepRoutes/index.tsx`
- Create: `frontend/src/pages/Experiences/index.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create the route page**

Use `prepRoutes` from `frontend/src/data/freeSuperiority.ts`. Render a header, route cards, stage chips, category chips, and action buttons that call `navigate(action.to)`.

- [ ] **Step 2: Create the experiences page**

Use `experienceSets` from `frontend/src/data/freeSuperiority.ts`. Render a header, scenario cards, drill lists, and action buttons that call `navigate(action.to)`.

- [ ] **Step 3: Wire app routes**

Add lazy imports:

```ts
const PrepRoutes = lazy(() => import('./pages/PrepRoutes'))
const Experiences = lazy(() => import('./pages/Experiences'))
```

Add route entries under `AppLayout`:

```tsx
<Route path="/routes" element={<PrepRoutes />} />
<Route path="/experiences" element={<Experiences />} />
```

- [ ] **Step 4: Run build type check**

Run: `cd frontend && npm run build`

Expected: TypeScript compilation reaches Vite build without missing module errors.

## Task 3: Navigation And Home Free Band

**Files:**
- Modify: `frontend/src/components/Layout/Header.tsx`
- Modify: `frontend/src/pages/Home/index.tsx`
- Modify: `frontend/src/pages/QuestionDetail/index.tsx`

- [ ] **Step 1: Add navigation items**

Import icons:

```ts
import {
  AppstoreOutlined,
  BookOutlined,
  CalendarOutlined,
  FireOutlined,
  PlayCircleOutlined,
  ReadOutlined,
  SolutionOutlined,
} from '@ant-design/icons'
```

Set nav labels to readable Chinese:

```ts
const navItems = [
  { path: '/', label: '热门', icon: <FireOutlined /> },
  { path: '/banks', label: '题库', icon: <BookOutlined /> },
  { path: '/routes', label: '路线', icon: <ReadOutlined /> },
  { path: '/experiences', label: '面经', icon: <SolutionOutlined /> },
  { path: '/study', label: '计划', icon: <CalendarOutlined /> },
  { path: '/practice', label: '训练', icon: <PlayCircleOutlined /> },
]
```

Remove unused `AppstoreOutlined` if the final import does not use it.

- [ ] **Step 2: Add home free band**

Import `freePromiseItems` and render a compact grid above the question bank section:

```tsx
import { freePromiseItems } from '../../data/freeSuperiority'
```

Use:

```tsx
<section className="free-promise-band" aria-label="免费承诺">
  {freePromiseItems.map(item => (
    <div key={item.title}>
      <strong>{item.metric}</strong>
      <span>{item.title}</span>
      <p>{item.description}</p>
    </div>
  ))}
</section>
```

- [ ] **Step 3: Add detail free cue**

Add a small cue under question actions:

```tsx
<div className="detail-free-cue">本题答案、追问、质量评分和模拟面试均免费开放。</div>
```

- [ ] **Step 4: Run focused build**

Run: `cd frontend && npm run build`

Expected: build succeeds.

## Task 4: Responsive Styles

**Files:**
- Modify: `frontend/src/styles/global.css`

- [ ] **Step 1: Add styles**

Add styles for `.free-promise-band`, `.prep-page`, `.prep-hero`, `.prep-route-grid`, `.prep-route-card`, `.experience-page`, `.experience-grid`, `.experience-card`, and `.detail-free-cue`. Use 8px radius, neutral backgrounds, restrained blue/green/amber accents, and responsive one-column layout below 760px.

- [ ] **Step 2: Check for mobile overflow**

Run: `cd frontend && npm run build`

Expected: CSS compiles through Vite and no TypeScript errors are introduced.

## Task 5: Final Verification

**Files:**
- All modified frontend files.

- [ ] **Step 1: Run focused data test**

Run: `cd frontend && npm run test -- freeSuperiority`

Expected: pass.

- [ ] **Step 2: Run frontend test suite**

Run: `cd frontend && npm run test`

Expected: pass.

- [ ] **Step 3: Run frontend build**

Run: `cd frontend && npm run build`

Expected: pass.

- [ ] **Step 4: Run backend tests**

Run: `cd backend && mvn test`

Expected: pass or report environment-specific blocker.

- [ ] **Step 5: Check whitespace**

Run: `git diff --check`

Expected: no whitespace errors.

## Self-Review

- Spec coverage: home free promise, routes page, experiences page, header nav, question detail cue, and test/build verification are covered.
- Placeholder scan: no task uses TBD/TODO/later language.
- Type consistency: shared data types are defined before page usage.

