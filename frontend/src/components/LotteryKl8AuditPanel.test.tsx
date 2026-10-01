import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getKl8Audit } from '../api/tools'
import type { LotteryKl8AuditReport } from '../types'
import LotteryKl8AuditPanel from './LotteryKl8AuditPanel'

// antd 响应式组件（Row/Col）依赖 matchMedia，jsdom 未实现需要打桩
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => { /* 兼容旧 API */ },
    removeListener: () => { /* 兼容旧 API */ },
    addEventListener: () => { /* noop */ },
    removeEventListener: () => { /* noop */ },
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

vi.mock('../api/tools', () => ({
  getKl8Audit: vi.fn(),
}))

vi.mock('../utils/feedbackMessage', () => ({
  emitFeedbackSuccess: vi.fn(),
  emitFeedbackWarning: vi.fn(),
}))

const mockedGetKl8Audit = vi.mocked(getKl8Audit)

/**
 * 构造随机性审计报告。核心检验项与 80 项逐号码游程检验分开构造，
 * 以便断言面板对二者的差异化呈现。
 */
function auditReport(overrides: Partial<LotteryKl8AuditReport> = {}): LotteryKl8AuditReport {
  const runsChecks = Array.from({ length: 80 }, (_, index) => ({
    name: `游程检验 号码${index + 1}`,
    statistic: 0.12,
    degreesOfFreedom: 2000,
    pValue: 0.42,
    conclusion: '该号码未表现出冷热惯性',
  }))
  return {
    issueCount: 2000,
    latestIssueNo: '2026252',
    checks: [
      {
        name: '卡方拟合优度',
        statistic: 57.206,
        degreesOfFreedom: 79,
        pValue: 0.9693,
        conclusion: '分布与均匀分布一致（自由度 79），未见号码层面的系统性偏差',
      },
      {
        name: '相邻两期重号数',
        statistic: -0.0227,
        degreesOfFreedom: 1999,
        pValue: 0.9819,
        conclusion: '重号数与超几何期望一致，上一期不影响下一期',
      },
      {
        name: '间隔 1 期的重号自相关',
        statistic: 0.0449,
        degreesOfFreedom: 1999,
        pValue: 0.0412,
        conclusion: '偏差达到 5% 显著水平，单次偶然的可能性较大',
      },
      ...runsChecks,
    ],
    checkCount: 83,
    bonferroniThreshold: 0.000602,
    significantCount: 5,
    correctedSignificantCount: 0,
    invalidNumberCounts: [],
    conclusion: '未发现任何通过多重比较校正的偏差，期望贡献恒为 0。',
    disclaimer: '随机性审计只回答数据是否可信，不预测任何号码。',
    ...overrides,
  }
}

describe('LotteryKl8AuditPanel', () => {
  beforeEach(() => {
    mockedGetKl8Audit.mockReset()
    mockedGetKl8Audit.mockResolvedValue(auditReport())
  })

  afterEach(() => {
    cleanup()
  })

  it('挂载后自动拉取审计报告', async () => {
    render(<LotteryKl8AuditPanel />)
    await waitFor(() => expect(mockedGetKl8Audit).toHaveBeenCalledWith({ issueCount: 2000 }))
    expect(await screen.findByText('这批开奖数据本身可信吗')).toBeInTheDocument()
  })

  it('展示 Bonferroni 校正阈值，并区分名义显著与通过校正', async () => {
    render(<LotteryKl8AuditPanel />)
    await waitFor(() => expect(mockedGetKl8Audit).toHaveBeenCalled())

    // toExponential(2) 不补前导零，0.000602 → "6.02e-4"
    expect(await screen.findByText(/Bonferroni 校正阈值 p < 6\.02e-4/)).toBeInTheDocument()
    expect(screen.getByText('通过校正')).toBeInTheDocument()
    // 滞后 1 自相关 p=0.0412 落在名义 5% 水平，应标为「名义显著」而非异常
    expect(screen.getByText('名义显著')).toBeInTheDocument()
    // 「未显著」会出现在其余所有检验项上，因此用 getAllByText
    expect(screen.getAllByText('未显著').length).toBeGreaterThan(1)
  })

  it('核心检验与逐号码游程检验分开呈现', async () => {
    render(<LotteryKl8AuditPanel />)
    await waitFor(() => expect(mockedGetKl8Audit).toHaveBeenCalled())

    expect(await screen.findByText('核心检验')).toBeInTheDocument()
    expect(await screen.findByText('逐号码游程检验（80 项）')).toBeInTheDocument()
    expect(await screen.findByText('80 个号码的游程检验全部未通过校正')).toBeInTheDocument()
  })

  it('展示数据质量问题并优先告警', async () => {
    mockedGetKl8Audit.mockResolvedValue(auditReport({
      invalidNumberCounts: [19, 21],
      conclusion: '数据质量检查未通过。',
    }))
    render(<LotteryKl8AuditPanel />)

    expect(await screen.findByText('数据质量检查未通过：2 期号码个数不等于 20')).toBeInTheDocument()
    expect(screen.getByText('数据质量检查未通过。')).toBeInTheDocument()
  })

  it('校正后存在显著项时以错误级别告警', async () => {
    mockedGetKl8Audit.mockResolvedValue(auditReport({
      correctedSignificantCount: 1,
      conclusion: '1 项检验通过校正。',
    }))
    render(<LotteryKl8AuditPanel />)

    expect(await screen.findByText('总结论')).toBeInTheDocument()
    expect(await screen.findByText('1 项检验通过校正。')).toBeInTheDocument()
  })

  it('切换审计期数后按新期数重新请求', async () => {
    render(<LotteryKl8AuditPanel />)
    await waitFor(() => expect(mockedGetKl8Audit).toHaveBeenCalledTimes(1))
    await userEvent.click(screen.getByText('500 期'))
    await waitFor(() => expect(mockedGetKl8Audit).toHaveBeenCalledTimes(2))
    expect(mockedGetKl8Audit).toHaveBeenLastCalledWith({ issueCount: 500 })
  })

  it('接口失败时不渲染陈旧结果，交给全局拦截器提示', async () => {
    mockedGetKl8Audit.mockRejectedValue(new Error('network down'))
    render(<LotteryKl8AuditPanel />)
    await waitFor(() => expect(mockedGetKl8Audit).toHaveBeenCalled())
    expect(screen.queryByText('核心检验')).not.toBeInTheDocument()
    // 请求失败后 loading 已复位，因此展示「暂无审计结果」而非「正在运行检验」
    expect(await screen.findByText('暂无审计结果')).toBeInTheDocument()
  })
})
