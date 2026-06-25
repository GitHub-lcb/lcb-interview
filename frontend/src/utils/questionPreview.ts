import type { Question } from '../types'

/**
 * 题目摘要预览：优先用 summary，回退到 content / answer；剥离代码块与 markdown 符号后截断。
 *
 * 由于题目原始内容里代码块会显著干扰预览可读性，因此先剥离代码块再剥离行内符号，
 * 避免把 ```等符号当作字符渲染。截断长度固定 120 字，与搜索页历史保持一致。
 */
export function previewQuestion(question: Question): string {
  return (question.summary || question.content || question.answer || '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[#>*_`~-]/g, '')
    .trim()
    .slice(0, 120)
}