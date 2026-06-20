import type { Question } from '../types'
import { generateFollowUps, getMistakeHint, getQuickAnswer } from './answerQuality'

export interface InterviewAnswerKeyPoint {
  label: '机制' | '场景' | '落地'
  text: string
}

export interface InterviewAnswerScript {
  opening: string
  keyPoints: InterviewAnswerKeyPoint[]
  riskLine: string
  followUps: string[]
}

export function buildInterviewAnswerScript(question: Question): InterviewAnswerScript {
  const opening = cleanLine(getQuickAnswer(question))

  return {
    opening,
    keyPoints: [
      {
        label: '机制',
        text: cleanLine(question.principle) || cleanLine(question.content || question.answer) || opening,
      },
      {
        label: '场景',
        text: cleanLine(question.scenario) || cleanLine(question.comparison) || '先说适用边界，再补充替代方案和取舍理由。',
      },
      {
        label: '落地',
        text: cleanLine(question.projectExp) || '结合项目说清使用场景、踩坑处理和线上验证信号。',
      },
    ],
    riskLine: cleanLine(getMistakeHint(question)),
    followUps: generateFollowUps(question),
  }
}

export function buildInterviewAnswerScriptMarkdown(
  question: Question,
  now = new Date().toISOString(),
): string {
  const script = buildInterviewAnswerScript(question)

  return [
    `# ${question.title} 60 秒面试口径`,
    '',
    `生成时间：${formatMarkdownDate(now)}`,
    '',
    '## 开场口径',
    `- ${script.opening}`,
    '',
    '## 三段展开',
    ...script.keyPoints.map(point => `- ${point.label}：${point.text}`),
    '',
    '## 误区防线',
    `- ${script.riskLine}`,
    '',
    '## 面试官追问',
    ...script.followUps.map((item, index) => `${index + 1}. ${item}`),
  ].join('\n').trimEnd()
}

export function buildInterviewAnswerSpeechText(question: Question): string {
  const script = buildInterviewAnswerScript(question)
  const parts = [
    `题目，${cleanLine(question.title)}`,
    `开场，${script.opening}`,
    ...script.keyPoints.map(point => `${point.label}，${point.text}`),
    `误区防线，${script.riskLine}`,
    `追问预演，${script.followUps[0] || '请用项目经验补充一个追问回答。'}`,
  ]

  return parts
    .map(part => cleanLine(part))
    .filter(Boolean)
    .join('。')
}

function cleanLine(value: string | undefined | null): string {
  if (!value) {
    return ''
  }

  return value
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[#>*_`~-]/g, '')
    .replace(/\[[^\]]*]\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatMarkdownDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10)
  }
  return date.toISOString().slice(0, 10)
}
