import type { PracticeQueueItem, QuestionSnapshot } from '../types'

export type PracticeAnswerScaffoldBulletKey = 'conclusion' | 'mechanism' | 'scenario' | 'risk'

export interface PracticeAnswerScaffoldBullet {
  key: PracticeAnswerScaffoldBulletKey
  label: string
  prompt: string
  hint: string
}

export interface PracticeAnswerScaffold {
  title: string
  summary: string
  bullets: PracticeAnswerScaffoldBullet[]
  answerTemplate: string
}

interface DomainHints {
  mechanism: string
  scenario: string
  risk: string
}

const BULLET_LABELS: Record<PracticeAnswerScaffoldBulletKey, string> = {
  conclusion: '先给结论',
  mechanism: '补核心机制',
  scenario: '带项目场景',
  risk: '收边界风险',
}

/**
 * 构建模拟面试提交前的答题脚手架，帮助用户先形成可开口的结构化草稿。
 *
 * @param question 当前练习题目
 * @param targetRole 目标岗位，用于把场景提示贴近用户求职方向
 * @returns 四段式口述提纲和可直接带入回答框的模板
 */
export function buildPracticeAnswerScaffold(
  question: PracticeQueueItem | QuestionSnapshot,
  targetRole: string,
): PracticeAnswerScaffold {
  const role = sanitizeText(targetRole, '目标岗位')
  const title = sanitizeText(question.title, '当前题目')
  const hints = resolveDomainHints(question)

  return {
    title: '先搭好 4 句回答',
    summary: '按“结论 -> 机制 -> 场景 -> 边界”组织，提交评分前先把空回答变成可开口版本。',
    bullets: [
      {
        key: 'conclusion',
        label: BULLET_LABELS.conclusion,
        prompt: `用一句话直接回答「${title}」的核心判断。`,
        hint: '先给结论，不从背景铺垫开始，避免面试官追问“所以答案是什么”。',
      },
      {
        key: 'mechanism',
        label: BULLET_LABELS.mechanism,
        prompt: '补 2 到 3 个关键机制或关键名词。',
        hint: hints.mechanism,
      },
      {
        key: 'scenario',
        label: BULLET_LABELS.scenario,
        prompt: `放到 ${role} 项目里说明触发条件、处理动作和验证指标。`,
        hint: hints.scenario,
      },
      {
        key: 'risk',
        label: BULLET_LABELS.risk,
        prompt: '收一个边界、失败场景或替代方案。',
        hint: hints.risk,
      },
    ],
    answerTemplate: buildAnswerTemplate(title, role, hints),
  }
}

/**
 * 构建单题答题脚手架 Markdown，便于用户复制到离线笔记或面试前口述清单。
 *
 * @param question 当前练习题目
 * @param targetRole 目标岗位
 * @param now 生成时间，用于测试时固定日期
 * @returns 可复制或下载的 Markdown 脚手架
 */
export function buildPracticeAnswerScaffoldMarkdown(
  question: PracticeQueueItem | QuestionSnapshot,
  targetRole: string,
  now: Date | string = new Date(),
): string {
  const scaffold = buildPracticeAnswerScaffold(question, targetRole)
  const title = sanitizeText(question.title, '当前题目')

  return [
    `# ${title} 答题脚手架`,
    '',
    `生成时间：${formatMarkdownDate(now)}`,
    `目标岗位：${sanitizeText(targetRole, '目标岗位')}`,
    `分类：${sanitizeText(question.categoryName, '未分类')}`,
    `难度：${sanitizeText(question.difficulty, '未知')}`,
    '',
    '## 口述提纲',
    ...scaffold.bullets.map((item, index) => [
      `${index + 1}. ${item.label}`,
      `   - 开口提示：${item.prompt}`,
      `   - 补强提示：${item.hint}`,
    ].join('\n')),
    '',
    '## 可带入回答框的模板',
    '',
    scaffold.answerTemplate,
  ].join('\n').trimEnd()
}

function buildAnswerTemplate(title: string, role: string, hints: DomainHints): string {
  return [
    `结论：`,
    `我会先说明「${title}」的核心结论：...`,
    '',
    '机制：',
    `这里的关键机制是 ${hints.mechanism} 我会按 2 到 3 个要点讲清楚它为什么成立。`,
    '',
    '场景：',
    `在 ${role} 项目里，我会把它放到 ${hints.scenario} 并说明触发条件、处理动作和验证指标。`,
    '',
    '边界：',
    `需要注意的是 ${hints.risk} 最后补一个替代方案或兜底策略。`,
  ].join('\n')
}

function resolveDomainHints(question: PracticeQueueItem | QuestionSnapshot): DomainHints {
  const normalized = normalize([question.title, question.categoryName, ...question.tags].join(' '))

  if (normalized.includes('hashmap')) {
    return {
      mechanism: '重点讲数组、链表/红黑树、hash 冲突、扩容迁移，以及并发写入下的覆盖和结构破坏；可顺带对比 ConcurrentHashMap 的分段/桶级锁思路。',
      scenario: '本地缓存、请求去重或临时索引场景，强调多线程访问时要换成 ConcurrentHashMap 或加外部同步',
      risk: 'HashMap 不适合并发写，扩容期间更容易暴露问题；如果需要线程安全，要说明 ConcurrentHashMap、不可变 Map 或加锁的取舍。',
    }
  }

  if (matchesAny(normalized, ['java', 'jvm', 'spring', 'mybatis', 'dubbo', 'netty'])) {
    return {
      mechanism: '先讲运行链路、关键抽象和生命周期，再补线程安全、扩展点或代理调用的边界。',
      scenario: '接口治理、服务启动、流量高峰或线上故障复盘场景',
      risk: '注意线程池、连接池、事务边界和降级策略，避免只背概念不讲工程后果。',
    }
  }

  if (matchesAny(normalized, ['mysql', 'redis', 'mongodb', 'elasticsearch', '索引', '缓存', '事务'])) {
    return {
      mechanism: '讲清数据结构、读写路径、一致性边界、索引或缓存命中链路。',
      scenario: '慢查询、缓存击穿、数据倾斜或读写峰值场景',
      risk: '补充容量、热点、过期策略、事务隔离和监控指标，避免方案在高并发下失效。',
    }
  }

  if (matchesAny(normalized, ['kafka', 'rabbitmq', '消息队列', 'mq'])) {
    return {
      mechanism: '围绕生产、Broker、消费、确认、重试和位点推进讲清主链路。',
      scenario: '削峰填谷、异步解耦、订单状态流转或日志采集场景',
      risk: '必须说明重复消费、顺序性、消息丢失、积压和补偿机制。',
    }
  }

  if (matchesAny(normalized, ['系统设计', '架构', 'devops', 'docker', 'k8s', 'nginx', '运维'])) {
    return {
      mechanism: '先拆请求链路、容量模型、状态存储和故障隔离，再讲可观测性。',
      scenario: '高峰流量、发布变更、节点故障或跨服务依赖场景',
      risk: '补 SLA、限流降级、回滚、监控告警和单点故障，避免只讲理想路径。',
    }
  }

  if (matchesAny(normalized, ['react', 'vue', 'javascript', 'typescript', '前端', 'webpack'])) {
    return {
      mechanism: '讲清渲染链路、状态流转、事件模型、构建产物或浏览器运行机制。',
      scenario: '复杂表单、长列表、首屏性能、组件复用或多人协作维护场景',
      risk: '补兼容性、可维护性、性能退化和异常状态兜底。',
    }
  }

  if (matchesAny(normalized, ['ai', 'rag', 'llm', '大模型', 'prompt', 'agent'])) {
    return {
      mechanism: '拆成召回、排序、上下文组织、生成、评测和反馈闭环。',
      scenario: '知识库问答、智能体任务编排、客服助手或企业内部检索场景',
      risk: '补幻觉、权限泄露、成本、延迟、评测集和人工兜底。',
    }
  }

  return {
    mechanism: '先讲定义和关键机制，再补一个对比对象或替代方案。',
    scenario: '真实项目、线上故障、性能优化或团队协作场景',
    risk: '说明适用边界、失败场景、常见误区和兜底策略。',
  }
}

function matchesAny(value: string, keywords: string[]): boolean {
  return keywords.some(keyword => value.includes(keyword.toLowerCase()))
}

function sanitizeText(value: string | undefined, fallback: string): string {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim()
  return normalized || fallback
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function formatMarkdownDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10)
  }
  return date.toISOString().slice(0, 10)
}
