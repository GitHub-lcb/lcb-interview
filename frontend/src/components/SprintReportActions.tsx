import { Button } from 'antd'
import { emitFeedbackSuccess, emitFeedbackWarning } from '../utils/feedbackMessage'
import { CopyOutlined } from '@ant-design/icons'
import { prepRoutes } from '../data/freeSuperiority'
import type { StudyProgress } from '../types'
import { buildSprintReportMarkdown } from '../utils/sprintReport'

interface SprintReportActionsProps {
  progress: StudyProgress
}

export default function SprintReportActions({ progress }: SprintReportActionsProps) {
  const handleCopyReport = async () => {
    const markdown = buildSprintReportMarkdown(prepRoutes, progress)
    const copied = await copyMarkdown(markdown)

    if (copied) {
      emitFeedbackSuccess('面试冲刺报告已复制')
      return
    }

    downloadMarkdown(markdown, buildFileName(progress.targetRole))
    emitFeedbackWarning('剪贴板不可用，已下载 Markdown 报告')
  }

  return (
    <Button icon={<CopyOutlined />} onClick={handleCopyReport}>
      复制报告
    </Button>
  )
}

async function copyMarkdown(markdown: string): Promise<boolean> {
  if (!navigator.clipboard?.writeText) {
    return false
  }

  try {
    await navigator.clipboard.writeText(markdown)
    return true
  } catch {
    return false
  }
}

function downloadMarkdown(markdown: string, fileName: string): void {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

function buildFileName(targetRole: string): string {
  const safeRole = targetRole.trim().replace(/[\\/:*?"<>|]/g, '-')
  return `${safeRole || '面试'}-冲刺报告.md`
}
