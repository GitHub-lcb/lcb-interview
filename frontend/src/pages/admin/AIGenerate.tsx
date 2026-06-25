import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, Form, Select, InputNumber, Input, Button, Progress, Alert, Segmented, Tag, Divider, Statistic, Row, Col, Collapse, List, Badge, Space, Switch } from 'antd'
import { emitFeedbackError, emitFeedbackSuccess } from '../../utils/feedbackMessage'
import { batchFillAnswers, batchGenerate, getAiConfigStatus, getBatchFillAnswerStatus, getBatchStatus, streamGenerate, streamFillAnswer, streamRewritePublishedAnswers, updateAiConfig } from '../../api/admin'
import { getCategories } from '../../api/category'
import { listDrafts } from '../../api/admin'
import type { AdminAiConfigStatus, AdminAiConfigUpdateRequest, Category, BatchProgress, StreamEvent } from '../../types'
import { getStreamResultMeta } from './aiGenerateResult'

export default function AIGenerate() {
  const [aiConfigForm] = Form.useForm<AdminAiConfigUpdateRequest>()
  const [mode, setMode] = useState<'batch' | 'stream' | 'streamFill' | 'rewritePublished'>('stream')
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryLoadError, setCategoryLoadError] = useState(false)
  const [categoryLoading, setCategoryLoading] = useState(false)
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null)
  const [aiConfigStatus, setAiConfigStatus] = useState<AdminAiConfigStatus | null>(null)
  const [aiConfigLoadError, setAiConfigLoadError] = useState(false)
  const [aiConfigSaving, setAiConfigSaving] = useState(false)
  const [draftCount, setDraftCount] = useState(0)

  const [streamStatus, setStreamStatus] = useState<'idle' | 'connecting' | 'streaming' | 'done' | 'error'>('idle')
  const [streamCurrent, setStreamCurrent] = useState(0)
  const [streamTotal, setStreamTotal] = useState(0)
  const [streamThinking, setStreamThinking] = useState('')
  const [streamContent, setStreamContent] = useState('')
  const [streamResults, setStreamResults] = useState<any[]>([])
  const [streamDoneResult, setStreamDoneResult] = useState<any>(null)
  const streamAbortRef = useRef<AbortController | null>(null)

  const [batchLoading, setBatchLoading] = useState(false)
  const [batchFillProgress, setBatchFillProgress] = useState<BatchProgress | null>(null)
  const [batchFillLoading, setBatchFillLoading] = useState(false)

  const loadCategories = useCallback(() => {
    setCategoryLoading(true)
    setCategoryLoadError(false)
    getCategories({ silentGlobalError: true })
      .then(data => {
        setCategories(data)
        setCategoryLoadError(false)
      })
      .catch(() => {
        setCategories([])
        setCategoryLoadError(true)
      })
      .finally(() => {
        setCategoryLoading(false)
      })
  }, [])

  const applyAiConfigStatus = useCallback((status: AdminAiConfigStatus) => {
    setAiConfigStatus(status)
    aiConfigForm.setFieldsValue({
      apiKey: '',
      model: status.model || '',
      apiUrl: status.apiUrl || '',
      interviewEnabled: status.interviewEnabled ?? true,
    })
  }, [aiConfigForm])

  useEffect(() => {
    loadCategories()
    getAiConfigStatus()
      .then(status => {
        applyAiConfigStatus(status)
        setAiConfigLoadError(false)
      })
      .catch(() => {
        setAiConfigStatus(null)
        setAiConfigLoadError(true)
      })
    getBatchStatus().then(p => setBatchProgress(p as any)).catch(() => {})
    getBatchFillAnswerStatus()
      .then(p => {
        setBatchFillProgress(p)
        setBatchFillLoading(p.status === 'RUNNING')
        if (p.status === 'RUNNING') {
          pollBatchFillAnswerStatus()
        }
      })
      .catch(() => {})
    listDrafts(0, 1).then((res: any) => setDraftCount(res.total || 0)).catch(() => {})
  }, [applyAiConfigStatus, loadCategories])

  const categoryOptions = categories.map(c => ({ value: c.name, label: c.name }))
  const aiOperationDisabled = aiConfigLoadError || aiConfigStatus?.available !== true
  const aiKeyDisplay = aiConfigStatus?.apiKeyConfigured
    ? aiConfigStatus.maskedApiKey || '已配置'
    : '未配置'
  const aiConfigDescription = aiConfigStatus?.available
    ? `密钥：${aiKeyDisplay}；模型：${aiConfigStatus.model || '-'}；端点：${aiConfigStatus.endpointHost || '-'}`
    : aiConfigStatus?.message || '请设置 AI_OPENCODE_API_KEY 后再使用生成、补答案和重写。'

  const onAiConfigFinish = async (values: AdminAiConfigUpdateRequest) => {
    setAiConfigSaving(true)
    try {
      const saved = await updateAiConfig({
        apiKey: values.apiKey?.trim() || undefined,
        model: values.model?.trim() || undefined,
        apiUrl: values.apiUrl?.trim() || undefined,
        interviewEnabled: values.interviewEnabled ?? false,
      })
      applyAiConfigStatus(saved)
      setAiConfigLoadError(false)
      emitFeedbackSuccess('AI 配置已保存')
    } catch {
      emitFeedbackError('AI 配置保存失败')
    } finally {
      setAiConfigSaving(false)
    }
  }

  const onBatchFinish = async (values: any) => {
    setBatchLoading(true)
    try {
      await batchGenerate({ countPerCategory: values.countPerCategory ?? 10, categoryName: values.categoryName, delaySeconds: values.delaySeconds ?? 3 })
      emitFeedbackSuccess('批量任务已启动')
      pollBatchStatus()
    } catch { emitFeedbackError('启动失败'); setBatchLoading(false) }
  }

  const pollBatchStatus = () => {
    const timer = setInterval(async () => {
      try {
        const p = await getBatchStatus()
        setBatchProgress(p)
        if (p.status === 'IDLE') { clearInterval(timer); setBatchLoading(false); emitFeedbackSuccess('批量任务完成') }
      } catch { clearInterval(timer); setBatchLoading(false) }
    }, 3000)
  }

  const onBatchFillAnswerFinish = async (values: any) => {
    setBatchFillLoading(true)
    try {
      await batchFillAnswers({
        categoryId: values.categoryId,
        maxQuestions: values.maxQuestions,
        delaySeconds: values.delaySeconds ?? 3,
      })
      emitFeedbackSuccess('批量补答案任务已启动')
      pollBatchFillAnswerStatus()
    } catch {
      emitFeedbackError('启动失败')
      setBatchFillLoading(false)
    }
  }

  const pollBatchFillAnswerStatus = () => {
    const timer = setInterval(async () => {
      try {
        const p = await getBatchFillAnswerStatus()
        setBatchFillProgress(p)
        if (p.status !== 'RUNNING') {
          clearInterval(timer)
          setBatchFillLoading(false)
          if (p.status === 'COMPLETED') {
            emitFeedbackSuccess('批量补答案任务完成')
          }
        }
      } catch {
        clearInterval(timer)
        setBatchFillLoading(false)
      }
    }, 3000)
  }

  const handleStreamEvent = (event: StreamEvent) => {
    switch (event.type) {
      case 'progress': {
        const p = JSON.parse(event.data)
        if (p.current !== streamCurrent) {
          setStreamThinking('')
          setStreamContent('')
          setStreamCurrent(p.current)
          setStreamTotal(p.total)
        }
        setStreamStatus('streaming')
        break
      }
      case 'thinking':
        setStreamThinking(prev => prev + event.data)
        setStreamStatus('streaming')
        break
      case 'content':
        setStreamContent(prev => prev + event.data)
        setStreamStatus('streaming')
        break
      case 'question_result': {
        const r = JSON.parse(event.data)
        setStreamResults(prev => {
          if (prev.find(x => x.current === r.current)) return prev
          return [...prev, r]
        })
        break
      }
      case 'total':
        setStreamTotal(Number(event.data))
        break
      case 'done':
        setStreamStatus('done')
        setStreamDoneResult(JSON.parse(event.data))
        emitFeedbackSuccess(`全部完成！成功 ${JSON.parse(event.data).success} 题`)
        break
      case 'error':
        setStreamStatus('error')
        emitFeedbackError(event.data)
        break
      case 'info':
        break
    }
  }

  const onStreamFinish = (values: any) => {
    setStreamStatus('connecting')
    setStreamCurrent(0)
    setStreamTotal(0)
    setStreamThinking('')
    setStreamContent('')
    setStreamResults([])
    setStreamDoneResult(null)

    const abort = streamGenerate(
      { category: values.category, difficulty: values.difficulty, count: values.count ?? 5, topic: values.topic },
      handleStreamEvent
    )
    streamAbortRef.current = abort
  }

  const onStreamFillFinish = (values: any) => {
    setStreamStatus('connecting')
    setStreamCurrent(0)
    setStreamTotal(0)
    setStreamThinking('')
    setStreamContent('')
    setStreamResults([])
    setStreamDoneResult(null)

    const abort = streamFillAnswer(
      handleStreamEvent,
      values.categoryId,
      values.count ?? 5
    )
    streamAbortRef.current = abort
  }

  const onRewritePublishedFinish = (values: any) => {
    setStreamStatus('connecting')
    setStreamCurrent(0)
    setStreamTotal(0)
    setStreamThinking('')
    setStreamContent('')
    setStreamResults([])
    setStreamDoneResult(null)

    const abort = streamRewritePublishedAnswers(
      handleStreamEvent,
      values.categoryId,
      values.keyword,
      values.count ?? 5
    )
    streamAbortRef.current = abort
  }

  useEffect(() => {
    return () => { streamAbortRef.current?.abort() }
  }, [])

  const renderStreamResult = () => (
    <Card size="small" style={{ marginTop: 16 }}>
      {streamTotal > 0 && (
        <div style={{ marginBottom: 12 }}>
          <Progress
            percent={Math.round(streamResults.length / streamTotal * 100)}
            format={() => `${streamResults.length}/${streamTotal}`}
          />
        </div>
      )}

      {streamStatus === 'connecting' && <p><Tag color="processing">正在连接 AI...</Tag></p>}
      {streamStatus === 'streaming' && (
        <p><Tag color="processing">正在生成第 {streamCurrent}/{streamTotal} 题...</Tag></p>
      )}
      {streamStatus === 'done' && streamDoneResult && (
        <Alert type="success" showIcon message={`全部完成！成功 ${streamDoneResult.success} 题，失败 ${streamDoneResult.fail} 题`} style={{ marginBottom: 12 }} />
      )}
      {streamStatus === 'error' && <Alert type="error" showIcon message="流式生成失败" />}

      {streamResults.length > 0 && (
        <List
          size="small"
          header={<div>已完成题目</div>}
          dataSource={streamResults}
          renderItem={item => {
            const meta = getStreamResultMeta(item)
            return (
              <List.Item>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, width: '100%' }}>
                  <Badge status={item.status === 'completed' ? 'success' : 'error'} style={{ marginTop: 6 }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div>
                      <Tag color="blue">#{item.current}</Tag>
                      <span>{meta.title}</span>
                      {meta.qualityText && <Tag color={meta.qualityColor} style={{ marginLeft: 8 }}>{meta.qualityText}</Tag>}
                    </div>
                    {meta.detail && (
                      <div style={{ color: '#A16207', marginTop: 4, fontSize: 13, lineHeight: 1.5 }}>
                        {meta.detail}
                      </div>
                    )}
                  </div>
                </div>
              </List.Item>
            )
          }}
          style={{ marginBottom: 12 }}
        />
      )}

      {streamThinking && (
        <Collapse
          size="small"
          defaultActiveKey={['thinking']}
          items={[{
            key: 'thinking',
            label: <span>当前题 AI 思考过程 <Tag color="purple">{streamThinking.length} 字符</Tag></span>,
            children: <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, maxHeight: 400, overflow: 'auto', background: '#f5f5f5', padding: 12, borderRadius: 6 }}>{streamThinking}</pre>,
          }]}
          style={{ marginTop: 8 }}
        />
      )}

      {streamContent && (
        <div style={{ marginTop: 12 }}>
          <h4>当前题生成内容 <Tag color="blue">{streamContent.length} 字符</Tag></h4>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, maxHeight: 500, overflow: 'auto', background: '#fafafa', padding: 12, borderRadius: 6, border: '1px solid #e8e8e8' }}>
            {streamContent}
          </div>
        </div>
      )}
    </Card>
  )

  const renderBatchFillProgress = () => {
    if (!batchFillProgress || batchFillProgress.status === 'IDLE') return null

    const completed = batchFillProgress.completedCategories
    const total = batchFillProgress.totalQuestions
    const percent = total > 0 ? Math.round(completed / total * 100) : 0
    const tagColor = batchFillProgress.status === 'RUNNING'
      ? 'processing'
      : batchFillProgress.status === 'COMPLETED'
        ? 'success'
        : 'error'

    return (
      <Card size="small" style={{ marginTop: 16 }}>
        <Space style={{ marginBottom: 12 }}>
          <span>后台批量状态：</span>
          <Tag color={tagColor}>{batchFillProgress.status === 'RUNNING' ? '运行中' : batchFillProgress.status === 'COMPLETED' ? '已完成' : '失败'}</Tag>
        </Space>
        <Progress percent={percent} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', fontSize: 14, color: '#52525B' }}>
          <span>题目: {completed}/{total}</span>
          <span>成功: {batchFillProgress.generatedQuestions}</span>
          <span>失败: {batchFillProgress.failedCategories}</span>
        </div>
        {batchFillProgress.currentMessage && <p><Tag color={tagColor}>{batchFillProgress.currentMessage}</Tag></p>}
        {batchFillProgress.currentCategory && <p>当前分类: <Tag color="blue">{batchFillProgress.currentCategory}</Tag></p>}
        {batchFillProgress.errors?.length > 0 && (
          <Alert type="warning" message={batchFillProgress.errors.join('; ')} showIcon style={{ marginTop: 12 }} />
        )}
      </Card>
    )
  }

  return (
    <Card title="AI 题目生成 — 质量门禁 + 草稿审核">
      <Segmented
        value={mode}
        onChange={v => setMode(v as any)}
        options={[
          { value: 'stream', label: '流式生成' },
          { value: 'streamFill', label: '流式补答案' },
          { value: 'rewritePublished', label: '重写已发布' },
          { value: 'batch', label: '批量生成' },
        ]}
        style={{ marginBottom: 24 }}
      />

      <div style={{ marginBottom: 16, padding: '12px 16px', border: '1px solid #f0f0f0', borderRadius: 8, background: '#fafafa' }}>
        <Space size={[8, 8]} wrap style={{ marginBottom: 12 }}>
          <Tag color={aiConfigStatus?.available ? 'success' : 'warning'}>
            {aiConfigStatus?.available ? 'AI 已就绪' : 'AI 未配置'}
          </Tag>
          <span>当前 Key：<code>{aiKeyDisplay}</code></span>
          <span>模型：<code>{aiConfigStatus?.model || '-'}</code></span>
          <span>端点：<code>{aiConfigStatus?.endpointHost || '-'}</code></span>
        </Space>
        <Form
          form={aiConfigForm}
          layout="vertical"
          onFinish={onAiConfigFinish}
          initialValues={{ interviewEnabled: true }}
        >
          <Row gutter={12} align="bottom">
            <Col xs={24} md={7}>
              <Form.Item name="apiKey" label="API Key">
                <Input.Password
                  data-testid="ai-config-api-key"
                  autoComplete="new-password"
                  placeholder="留空保留当前 Key"
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={5}>
              <Form.Item name="model" label="模型">
                <Input data-testid="ai-config-model" placeholder="deepseek-v4-pro" />
              </Form.Item>
            </Col>
            <Col xs={24} md={7}>
              <Form.Item name="apiUrl" label="接口地址">
                <Input data-testid="ai-config-url" placeholder="https://.../chat/completions" />
              </Form.Item>
            </Col>
            <Col xs={12} md={2}>
              <Form.Item name="interviewEnabled" label="面试评分" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col xs={12} md={3}>
              <Form.Item label=" ">
                <Button
                  data-testid="ai-config-submit"
                  loading={aiConfigSaving}
                  onClick={() => aiConfigForm.submit()}
                >
                  保存 AI 配置
                </Button>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </div>

      {aiConfigLoadError && (
        <Alert
          type="warning"
          showIcon
          message="AI 配置状态读取失败"
          description="暂时无法确认远程 AI 生成服务是否可用，请稍后刷新页面或检查管理端接口。"
          style={{ marginBottom: 16 }}
        />
      )}

      {aiConfigStatus && (
        <Alert
          type={aiConfigStatus.available ? 'success' : 'warning'}
          showIcon
          message={aiConfigStatus.available ? 'AI 服务已就绪' : 'AI 服务未配置'}
          description={aiConfigDescription}
          style={{ marginBottom: 16 }}
        />
      )}

      {categoryLoadError && (
        <Alert
          type="warning"
          showIcon
          message="分类加载失败"
          description="分类下拉框暂时不可用，可重试加载；不指定分类的批量生成和补答案流程仍可继续。"
          action={<Button size="small" loading={categoryLoading} onClick={loadCategories}>重试加载分类</Button>}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 流式生成 */}
      {mode === 'stream' && (
        <>
          <Alert type="info" showIcon message="逐题生成" description="每道题独立发送 AI 请求，实时展示思考过程和生成内容，可随时取消。" style={{ marginBottom: 16 }} />
          <Form layout="vertical" onFinish={onStreamFinish} style={{ maxWidth: 500 }}>
            <Form.Item name="category" label="分类" rules={[{ required: true }]}>
              <Select options={categoryOptions} showSearch placeholder="选择分类" />
            </Form.Item>
            <Form.Item name="difficulty" label="难度">
              <Select allowClear options={[
                { value: 'EASY', label: '简单' }, { value: 'MEDIUM', label: '中等' }, { value: 'HARD', label: '困难' },
              ]} />
            </Form.Item>
            <Form.Item name="count" label="生成数量" initialValue={5}>
              <InputNumber min={1} max={20} />
            </Form.Item>
            <Form.Item name="topic" label="主题关键词（可选）">
              <Input placeholder="如：HashMap原理" />
            </Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={streamStatus === 'connecting' || streamStatus === 'streaming'}
                disabled={aiOperationDisabled || streamStatus === 'connecting' || streamStatus === 'streaming'}>
                逐题流式生成
              </Button>
              {(streamStatus === 'connecting' || streamStatus === 'streaming') && (
                <Button danger onClick={() => { streamAbortRef.current?.abort(); setStreamStatus('idle') }}>
                  取消
                </Button>
              )}
            </Space>
          </Form>

          {streamStatus !== 'idle' && renderStreamResult()}
        </>
      )}

      {/* 流式补答案 */}
      {mode === 'streamFill' && (
        <>
          <Alert type="info" showIcon message="逐题补答案" description="逐题流式适合小批量观察；后台批量适合补齐全部待补草稿。" style={{ marginBottom: 16 }} />
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col>
              <Statistic title="待补草稿" value={draftCount} suffix="题" />
            </Col>
          </Row>
          <Form layout="vertical" onFinish={onStreamFillFinish} style={{ maxWidth: 500 }}>
            <Form.Item name="categoryId" label="分类（留空则从所有分类选取）">
              <Select allowClear options={categories.map(c => ({ value: c.id, label: c.name }))} showSearch placeholder="选择分类" />
            </Form.Item>
            <Form.Item name="count" label="小批量补全数量" initialValue={5} tooltip="一次最多补 20 道">
              <InputNumber min={1} max={20} />
            </Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={streamStatus === 'connecting' || streamStatus === 'streaming'}
                disabled={aiOperationDisabled || streamStatus === 'connecting' || streamStatus === 'streaming'}>
                逐题流式补答案
              </Button>
              {(streamStatus === 'connecting' || streamStatus === 'streaming') && (
                <Button danger onClick={() => { streamAbortRef.current?.abort(); setStreamStatus('idle') }}>
                  取消
                </Button>
              )}
            </Space>
          </Form>

          {streamStatus !== 'idle' && renderStreamResult()}

          <Divider />

          <Form layout="vertical" onFinish={onBatchFillAnswerFinish} style={{ maxWidth: 500 }}>
            <Form.Item name="categoryId" label="后台分类（留空则补所有分类）">
              <Select allowClear options={categories.map(c => ({ value: c.id, label: c.name }))} showSearch placeholder="选择分类" />
            </Form.Item>
            <Form.Item name="maxQuestions" label="本次最大处理数量" tooltip="留空则补到当前待补草稿清零">
              <InputNumber min={1} />
            </Form.Item>
            <Form.Item name="delaySeconds" label="API 调用间隔（秒）" initialValue={3}>
              <InputNumber min={0} max={300} />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={batchFillLoading}
              disabled={aiOperationDisabled || batchFillLoading || batchFillProgress?.status === 'RUNNING'}
              danger
            >
              启动后台批量补答案
            </Button>
          </Form>

          {renderBatchFillProgress()}
        </>
      )}

      {/* 重写已发布答案 */}
      {mode === 'rewritePublished' && (
        <>
          <Alert
            type="info"
            showIcon
            message="已发布答案重写"
            description="按分类和关键词选取已发布题目，使用当前模型生成新版答案草稿；审核通过后替换原题答案，前台不会出现重复题。"
            style={{ marginBottom: 16 }}
          />
          <Form layout="vertical" onFinish={onRewritePublishedFinish} style={{ maxWidth: 500 }}>
            <Form.Item name="categoryId" label="分类（留空则重写所有分类）">
              <Select allowClear options={categories.map(c => ({ value: c.id, label: c.name }))} showSearch placeholder="选择分类" />
            </Form.Item>
            <Form.Item name="keyword" label="关键词（可选）">
              <Input placeholder="如：线程池、HashMap、缓存击穿" />
            </Form.Item>
            <Form.Item name="count" label="重写数量" initialValue={5} tooltip="一次最多重写 20 道">
              <InputNumber min={1} max={20} />
            </Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={streamStatus === 'connecting' || streamStatus === 'streaming'}
                disabled={aiOperationDisabled || streamStatus === 'connecting' || streamStatus === 'streaming'}>
                逐题流式重写答案
              </Button>
              {(streamStatus === 'connecting' || streamStatus === 'streaming') && (
                <Button danger onClick={() => { streamAbortRef.current?.abort(); setStreamStatus('idle') }}>
                  取消
                </Button>
              )}
            </Space>
          </Form>

          {streamStatus !== 'idle' && renderStreamResult()}
        </>
      )}

      {/* 批量生成 */}
      {mode === 'batch' && (
        <>
          <Space style={{ marginBottom: 16 }}>
            <span>批量任务状态：</span>
            <Tag color={batchProgress?.status === 'RUNNING' ? 'processing' : 'default'}>
              {batchProgress?.status === 'RUNNING' ? '运行中' : '空闲'}
            </Tag>
          </Space>
          {batchProgress?.status === 'RUNNING' && (
            <Card size="small" style={{ marginBottom: 16 }}>
              <Progress percent={batchProgress.totalCategories > 0 ? Math.round(batchProgress.completedCategories / batchProgress.totalCategories * 100) : 0} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', fontSize: 14, color: '#52525B' }}>
                <span>分类: {batchProgress.completedCategories}/{batchProgress.totalCategories}</span>
                <span>题目: {batchProgress.generatedQuestions}/{batchProgress.totalQuestions}</span>
                <span>失败: {batchProgress.failedCategories}</span>
              </div>
              {batchProgress.currentMessage && <p><Tag color="processing">{batchProgress.currentMessage}</Tag></p>}
              {batchProgress.currentCategory && <p>当前分类: <Tag color="blue">{batchProgress.currentCategory}</Tag></p>}
              {batchProgress.errors?.length > 0 && <Alert type="warning" message={batchProgress.errors.join('; ')} showIcon />}
            </Card>
          )}
          <Form layout="vertical" onFinish={onBatchFinish} style={{ maxWidth: 500 }}>
            <Form.Item name="countPerCategory" label="每个分类生成数量" initialValue={10}>
              <InputNumber min={1} max={20} />
            </Form.Item>
            <Form.Item name="categoryName" label="指定分类（留空则生成所有分类）">
              <Select allowClear options={categoryOptions} showSearch placeholder="不选则生成所有分类" />
            </Form.Item>
            <Form.Item name="delaySeconds" label="API 调用间隔（秒）" initialValue={3}>
              <InputNumber min={1} max={30} />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={batchLoading} disabled={aiOperationDisabled} danger>启动批量生成</Button>
          </Form>
          <Divider />
          <Alert type="info" showIcon message="批量生成说明"
            description={<ul style={{ margin: 0, paddingLeft: 20 }}>
              <li>每个分类调用一次 AI 接口，间隔时间防止限流</li>
              <li>已有足够题目的分类自动跳过</li>
              <li>生成的题目进入草稿（DRAFT），通过审核后再发布</li>
            </ul>} />
        </>
      )}
    </Card>
  )
}
