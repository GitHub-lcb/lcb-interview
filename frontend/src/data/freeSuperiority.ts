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
    description: '不设置答案锁，优先把每道题打磨成可直接开口回答的结构。',
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
