import type { Question, QuestionSnapshot } from '../types'

export type RoleFocusKey = 'backend' | 'frontend' | 'ai' | 'architecture' | 'general'

const ROLE_KEYWORDS: Record<RoleFocusKey, string[]> = {
  backend: [
    'Java', 'JVM', 'Spring', 'MyBatis', 'MySQL', 'Redis', 'MongoDB', '消息队列',
    'RabbitMQ', 'Kafka', 'Dubbo', 'Elasticsearch', 'Netty', '后端', '系统设计',
    '设计模式', '算法', '计算机网络', '操作系统',
  ],
  frontend: [
    'JavaScript', 'TypeScript', 'Vue', 'React', '前端', 'HTML', 'CSS', 'Webpack',
  ],
  ai: ['AI', '大模型', 'RAG', 'Agent', 'Python', 'LangChain', 'Prompt'],
  architecture: [
    '系统设计', '架构', '后端场景', 'Docker', 'K8s', 'Nginx', 'Linux', 'DevOps',
    '运维', '网络', '消息队列', 'Kafka', 'Redis', 'Elasticsearch', 'Dubbo',
  ],
  general: [],
}

/**
 * 将岗位名称归一化为首页推荐使用的能力方向。
 *
 * @param targetRole 用户选择的目标岗位
 * @return 岗位能力方向
 */
export function resolveRoleFocus(targetRole: string): RoleFocusKey {
  const role = targetRole.trim().toLowerCase()
  if (role.includes('前端') || role.includes('全栈')) {
    return 'frontend'
  }
  if (role.includes('ai') || role.includes('大模型') || role.includes('算法')) {
    return 'ai'
  }
  if (role.includes('架构') || role.includes('运维')) {
    return 'architecture'
  }
  if (role.includes('java') || role.includes('后端')) {
    return 'backend'
  }
  return 'general'
}

/**
 * 判断题目是否与目标岗位直接相关。
 *
 * @param targetRole 用户选择的目标岗位
 * @param question 题目或题目快照
 * @return 是否属于岗位优先范围
 */
export function isQuestionRelevantToRole(
  targetRole: string,
  question: Pick<Question | QuestionSnapshot, 'categoryName' | 'title' | 'tags'>,
): boolean {
  const focus = resolveRoleFocus(targetRole)
  if (focus === 'general') {
    return true
  }
  const haystack = [question.categoryName, question.title, ...(question.tags ?? [])]
    .join(' ')
    .toLowerCase()
  return ROLE_KEYWORDS[focus].some(keyword => haystack.includes(keyword.toLowerCase()))
}

/**
 * 将岗位相关题排在前面，同时保留其他高频题作为候补，避免候选不足时无法开始摸底。
 *
 * @param targetRole 用户选择的目标岗位
 * @param questions 候选题
 * @return 稳定排序后的候选题
 */
export function prioritizeQuestionsForRole<T extends Pick<Question, 'categoryName' | 'title' | 'tags'>>(
  targetRole: string,
  questions: T[],
): T[] {
  return [...questions]
    .map((question, index) => ({
      question,
      index,
      relevant: isQuestionRelevantToRole(targetRole, question),
    }))
    .sort((left, right) => Number(right.relevant) - Number(left.relevant) || left.index - right.index)
    .map(item => item.question)
}
