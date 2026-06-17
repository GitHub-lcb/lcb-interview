import type { ActionLink, ExperienceSet } from '../data/freeSuperiority'

/**
 * 构建真实面试场景包 Markdown，便于用户把公司类型、追问主题和训练入口复制到外部面试清单。
 *
 * @param experienceSets 面试场景组配置
 * @param targetRole 目标岗位
 * @param now 生成时间，默认取当前时间
 * @returns 可复制或下载的 Markdown 场景包
 */
export function buildExperiencePlaybookMarkdown(
  experienceSets: ExperienceSet[],
  targetRole: string,
  now = new Date().toISOString(),
): string {
  return [
    `# ${sanitizeMarkdownValue(targetRole, '岗位')} 真实面试场景包`,
    '',
    `生成时间：${formatMarkdownDate(now)}`,
    '',
    renderExperienceOverview(experienceSets),
    renderExperienceItems(experienceSets),
  ].join('\n').trimEnd()
}

function renderExperienceOverview(experienceSets: ExperienceSet[]): string {
  const companyTypes = [...new Set(experienceSets.map(set => sanitizeMarkdownValue(set.companyType, '未分类')))]

  return [
    '## 场景总览',
    `- 场景组：${experienceSets.length} 组`,
    `- 覆盖公司类型：${companyTypes.length > 0 ? companyTypes.join('、') : '暂无'}`,
    `- 主训练入口：${primaryPracticeEntry(experienceSets)}`,
    '',
  ].join('\n')
}

function renderExperienceItems(experienceSets: ExperienceSet[]): string {
  if (experienceSets.length === 0) {
    return [
      '## 场景题单',
      '1. 暂无面试场景组',
      '   - 下一步：先确认目标岗位，再补充至少一组场景题单。',
      '   - 入口：/practice',
    ].join('\n')
  }

  const lines = ['## 场景题单']
  experienceSets.forEach((set, index) => {
    lines.push(
      `${index + 1}. ${sanitizeMarkdownValue(set.title, `场景组 #${index + 1}`)}`,
      `   - 公司类型：${sanitizeMarkdownValue(set.companyType, '未分类')}`,
      `   - 摘要：${sanitizeMarkdownValue(set.summary, '暂无摘要')}`,
      `   - 追问主题：${renderTextList(set.drills, '待补充')}`,
      `   - 行动入口：${renderActions(set.actions)}`,
    )
  })

  return [...lines, ''].join('\n')
}

function primaryPracticeEntry(experienceSets: ExperienceSet[]): string {
  return experienceSets
    .flatMap(set => set.actions)
    .find(action => action.to === '/practice')?.to
    ?? experienceSets[0]?.actions[0]?.to
    ?? '/practice'
}

function renderActions(actions: ActionLink[]): string {
  if (actions.length === 0) {
    return '开始模拟面试（/practice）'
  }
  return actions
    .map(action => `${sanitizeMarkdownValue(action.label, '开始训练')}（${sanitizeMarkdownValue(action.to, '/practice')}）`)
    .join('；')
}

function renderTextList(values: string[], fallback: string): string {
  const normalized = values.map(value => value.trim()).filter(Boolean)
  return normalized.length > 0 ? normalized.join('、') : fallback
}

function formatMarkdownDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10)
  }
  return date.toISOString().slice(0, 10)
}

function sanitizeMarkdownValue(value: string | undefined, fallback: string): string {
  const normalized = value?.trim()
  return normalized ? normalized : fallback
}
