import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import { message } from 'antd'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './index'
import { getAdminQualitySummary, listDrafts } from './admin'
import { getHotQuestions, getQuestionById } from './question'

vi.mock('antd', () => ({
  message: {
    error: vi.fn(),
  },
}))

const networkFailureAdapter: AxiosAdapter = config =>
  Promise.reject(Object.assign(new Error('network down'), { config }))

const businessFailureAdapter: AxiosAdapter = config => Promise.resolve({
  data: {
    code: 500,
    message: '热门题后台刷新失败',
  },
  status: 200,
  statusText: 'OK',
  headers: {},
  config: config as InternalAxiosRequestConfig,
})

const detailFailureAdapter: AxiosAdapter = config => Promise.resolve({
  data: {
    code: 404,
    message: '题目详情后台补全失败',
  },
  status: 200,
  statusText: 'OK',
  headers: {},
  config: config as InternalAxiosRequestConfig,
})

const draftListFailureAdapter: AxiosAdapter = config => Promise.resolve({
  data: {
    code: 500,
    message: '草稿列表加载失败',
  },
  status: 200,
  statusText: 'OK',
  headers: {},
  config: config as InternalAxiosRequestConfig,
})

const qualitySummaryFailureAdapter: AxiosAdapter = config => Promise.resolve({
  data: {
    code: 500,
    message: '质量总览加载失败',
  },
  status: 200,
  statusText: 'OK',
  headers: {},
  config: config as InternalAxiosRequestConfig,
})

describe('api global error handling', () => {
  beforeEach(() => {
    vi.mocked(message.error).mockReset()
  })

  it('emits global network error feedback without static AntD message calls', async () => {
    api.defaults.adapter = networkFailureAdapter
    const feedbackMessages: string[] = []
    const onFeedback = (event: Event) => {
      feedbackMessages.push((event as CustomEvent<{ content: string }>).detail.content)
    }
    window.addEventListener('lcb:feedback-message', onFeedback)

    try {
      await expect(api.get('/network-error')).rejects.toThrow('network down')
    } finally {
      window.removeEventListener('lcb:feedback-message', onFeedback)
    }

    expect(feedbackMessages).toEqual(['网络错误，请稍后重试'])
    expect(message.error).not.toHaveBeenCalled()
  })

  it('suppresses global network error feedback for background requests', async () => {
    api.defaults.adapter = networkFailureAdapter

    await expect(api.get('/network-error', { silentGlobalError: true } as never)).rejects.toThrow('network down')

    expect(message.error).not.toHaveBeenCalled()
  })

  it('lets hot question background refresh fail without global feedback', async () => {
    api.defaults.adapter = businessFailureAdapter
    const requestHotQuestions = getHotQuestions as (
      size: number,
      options: { silentGlobalError: boolean },
    ) => Promise<unknown>

    await expect(requestHotQuestions(12, { silentGlobalError: true })).rejects.toThrow('热门题后台刷新失败')

    expect(message.error).not.toHaveBeenCalled()
  })

  it('lets question detail background enrichment fail without global feedback', async () => {
    api.defaults.adapter = detailFailureAdapter
    const requestQuestion = getQuestionById as (
      id: number,
      options: { silentGlobalError: boolean },
    ) => Promise<unknown>

    await expect(requestQuestion(99, { silentGlobalError: true })).rejects.toThrow('题目详情后台补全失败')

    expect(message.error).not.toHaveBeenCalled()
  })

  it('lets draft review list refresh fail without global feedback', async () => {
    api.defaults.adapter = draftListFailureAdapter
    const feedbackMessages: string[] = []
    const onFeedback = (event: Event) => {
      feedbackMessages.push((event as CustomEvent<{ content: string }>).detail.content)
    }
    window.addEventListener('lcb:feedback-message', onFeedback)

    try {
      await expect(listDrafts(0, 20, {}, { silentGlobalError: true })).rejects.toThrow('草稿列表加载失败')
    } finally {
      window.removeEventListener('lcb:feedback-message', onFeedback)
    }

    expect(feedbackMessages).toEqual([])
    expect(message.error).not.toHaveBeenCalled()
  })

  it('lets admin quality summary refresh fail without global feedback', async () => {
    api.defaults.adapter = qualitySummaryFailureAdapter
    const feedbackMessages: string[] = []
    const onFeedback = (event: Event) => {
      feedbackMessages.push((event as CustomEvent<{ content: string }>).detail.content)
    }
    window.addEventListener('lcb:feedback-message', onFeedback)

    try {
      await expect(getAdminQualitySummary({ silentGlobalError: true })).rejects.toThrow('质量总览加载失败')
    } finally {
      window.removeEventListener('lcb:feedback-message', onFeedback)
    }

    expect(feedbackMessages).toEqual([])
    expect(message.error).not.toHaveBeenCalled()
  })
})
