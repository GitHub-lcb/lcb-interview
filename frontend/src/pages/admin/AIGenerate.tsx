import { useState, useEffect, useRef } from 'react'
import { Card, Form, Select, InputNumber, Input, Button, Progress, Alert, message, Segmented, Tag, Divider, Statistic, Row, Col, Collapse, List, Badge, Space } from 'antd'
import { batchGenerate, getBatchStatus, streamGenerate, streamFillAnswer } from '../../api/admin'
import { getCategories } from '../../api/category'
import { listDrafts } from '../../api/admin'
import type { Category, BatchProgress, StreamEvent } from '../../types'

export default function AIGenerate() {
  const [mode, setMode] = useState<'batch' | 'stream' | 'streamFill'>('stream')
  const [categories, setCategories] = useState<Category[]>([])
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null)
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

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {})
    getBatchStatus().then(p => setBatchProgress(p as any)).catch(() => {})
    listDrafts(0, 1).then((res: any) => setDraftCount(res.total || 0)).catch(() => {})
  }, [])

  const categoryOptions = categories.map(c => ({ value: c.name, label: c.name }))

  const onBatchFinish = async (values: any) => {
    setBatchLoading(true)
    try {
      await batchGenerate({ countPerCategory: values.countPerCategory ?? 10, categoryName: values.categoryName, delaySeconds: values.delaySeconds ?? 3 })
      message.success('批量任务已启动')
      pollBatchStatus()
    } catch { message.error('启动失败'); setBatchLoading(false) }
  }

  const pollBatchStatus = () => {
    const timer = setInterval(async () => {
      try {
        const p = await getBatchStatus()
        setBatchProgress(p)
        if (p.status === 'IDLE') { clearInterval(timer); setBatchLoading(false); message.success('批量任务完成') }
      } catch { clearInterval(timer); setBatchLoading(false) }
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
        message.success(`全部完成！成功 ${JSON.parse(event.data).success} 题`)
        break
      case 'error':
        setStreamStatus('error')
        message.error(event.data)
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
          renderItem={item => (
            <List.Item>
              <Badge status={item.status === 'completed' ? 'success' : 'error'} />
              <span style={{ marginLeft: 8 }}>
                <Tag color="blue">#{item.current}</Tag>
                {item.title || `题目 ID: ${item.questionId}`}
              </span>
            </List.Item>
          )}
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

  return (
    <Card title="AI 题目生成 — 1M上下文 + Max模式">
      <Segmented
        value={mode}
        onChange={v => setMode(v as any)}
        options={[
          { value: 'stream', label: '流式生成' },
          { value: 'streamFill', label: '流式补答案' },
          { value: 'batch', label: '批量生成' },
        ]}
        style={{ marginBottom: 24 }}
      />

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
                disabled={streamStatus === 'connecting' || streamStatus === 'streaming'}>
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
          <Alert type="info" showIcon message="逐题补答案" description="每道题独立发送 AI 请求，实时展示思考过程和补全内容，可随时取消。" style={{ marginBottom: 16 }} />
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col>
              <Statistic title="待补草稿" value={draftCount} suffix="题" />
            </Col>
          </Row>
          <Form layout="vertical" onFinish={onStreamFillFinish} style={{ maxWidth: 500 }}>
            <Form.Item name="categoryId" label="分类（留空则补所有分类）">
              <Select allowClear options={categories.map(c => ({ value: c.id, label: c.name }))} showSearch placeholder="选择分类" />
            </Form.Item>
            <Form.Item name="count" label="补全数量" initialValue={5} tooltip="一次最多补 20 道">
              <InputNumber min={1} max={20} />
            </Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={streamStatus === 'connecting' || streamStatus === 'streaming'}
                disabled={streamStatus === 'connecting' || streamStatus === 'streaming'}>
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
            <Button type="primary" htmlType="submit" loading={batchLoading} danger>启动批量生成</Button>
          </Form>
          <Divider />
          <Alert type="info" showIcon message="批量生成说明"
            description={<ul style={{ margin: 0, paddingLeft: 20 }}>
              <li>每个分类调用一次 AI 接口，间隔时间防止限流</li>
              <li>已有足够题目的分类自动跳过</li>
              <li>生成的题目直接发布（PUBLISHED），无需审核</li>
            </ul>} />
        </>
      )}
    </Card>
  )
}
