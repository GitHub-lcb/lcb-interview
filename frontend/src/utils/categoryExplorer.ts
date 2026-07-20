import type { Category } from '../types'
import type { RoleFocusKey } from './roleFocus'

export type CategoryGroupKey = 'backend' | 'frontend' | 'ai' | 'ops' | 'general'

const FRONTEND_KEYWORDS = ['JavaScript', 'TypeScript', 'Vue', 'React', '前端']
const AI_KEYWORDS = ['AI ', 'AI大', 'AI 大', '大模型', '机器学习']
const OPS_KEYWORDS = ['运维', 'DevOps', 'Docker', 'K8s', 'Nginx', 'Linux', '网络']
const BACKEND_KEYWORDS = [
  'Java', 'JVM', 'Spring', 'MyBatis', 'MySQL', 'Redis', 'MongoDB', '消息队列',
  'RabbitMQ', 'Kafka', 'Dubbo', 'Elasticsearch', 'Netty', '后端', '系统设计',
  '设计模式', '数据库',
]

/**
 * 将题库分类归入首页使用的五个技术方向。
 *
 * @param category 分类数据
 * @return 首页方向
 */
export function resolveCategoryGroup(category: Pick<Category, 'name'>): CategoryGroupKey {
  const name = category.name
  if (FRONTEND_KEYWORDS.some(keyword => name.includes(keyword))) {
    return 'frontend'
  }
  if (AI_KEYWORDS.some(keyword => name.includes(keyword))) {
    return 'ai'
  }
  if (OPS_KEYWORDS.some(keyword => name.includes(keyword))) {
    return 'ops'
  }
  if (BACKEND_KEYWORDS.some(keyword => name.includes(keyword))) {
    return 'backend'
  }
  return 'general'
}

/**
 * 将目标岗位方向映射为首页默认分类页签。
 *
 * @param focus 岗位能力方向
 * @return 分类页签
 */
export function categoryGroupForRole(focus: RoleFocusKey): CategoryGroupKey {
  if (focus === 'architecture') {
    return 'ops'
  }
  if (focus === 'frontend' || focus === 'ai' || focus === 'backend') {
    return focus
  }
  return 'backend'
}
