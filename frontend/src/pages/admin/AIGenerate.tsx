import { useState, useEffect } from 'react'
import { Card, Form, Select, InputNumber, Input, Button, Progress, Alert, message, Segmented, Space, Tag, Divider, Statistic, Row, Col } from 'antd'
import { generateQuestions, getGenerationTask, batchGenerate, getBatchStatus, fillAnswers } from '../../api/admin'
import { getCategories } from '../../api/category'
import { listDrafts } from '../../api/admin'
import type { Category, BatchProgress, GenerationTask } from '../../types'

export default function AIGenerate() {
  const [mode, setMode] = useState<'single' | 'batch' | 'fill'>('single')
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [task, setTask] = useState<GenerationTask | null>(null)
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null)
  const [draftCount, setDraftCount] = useState(0)

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {})
    getBatchStatus().then(p => setBatchProgress(p as any)).catch(() => {})
    listDrafts(0, 1).then((res: any) => setDraftCount(res.total || 0)).catch(() => {})
  }, [])

  const categoryOptions = categories.map(c => ({ value: c.name, label: c.name }))

  const pollTask = (id: number) => {
    const timer = setInterval(async () => {
      try {
        const t = await getGenerationTask(id)
        setTask(t)
        if (t.status === 'COMPLETED' || t.status === 'FAILED' || t.status === 'PARTIAL') {
          clearInterval(timer)
          setLoading(false)
          if (t.status === 'COMPLETED') message.success(`成功 ${t.successCount} 道`)
          else if (t.status === 'PARTIAL') message.warning(`部分成功：${t.successCount}/${t.total}`)
          else message.error('失败')
        }
      } catch { clearInterval(timer); setLoading(false) }
    }, 3000)
  }

  const onSingleFinish = async (values: any) => {
    setLoading(true); setTask(null)
    try { const id = await generateQuestions(values); pollTask(id) }
    catch { message.error('生成失败'); setLoading(false) }
  }

  const onBatchFinish = async (values: any) => {
    setLoading(true)
    try {
      await batchGenerate({ countPerCategory: values.countPerCategory ?? 10, categoryName: values.categoryName, delaySeconds: values.delaySeconds ?? 3 })
      message.success('批量任务已启动')
      pollBatchStatus()
    } catch { message.error('启动失败'); setLoading(false) }
  }

  const pollBatchStatus = () => {
    const timer = setInterval(async () => {
      try {
        const p = await getBatchStatus()
        setBatchProgress(p)
        if (p.status === 'IDLE') { clearInterval(timer); setLoading(false); message.success('批量任务完成') }
      } catch { clearInterval(timer); setLoading(false) }
    }, 3000)
  }

  const onFillFinish = async (values: any) => {
    setLoading(true); setTask(null)
    try {
      const id = await fillAnswers({ categoryId: values.categoryId, count: values.count ?? 10 })
      pollTask(id)
    } catch { message.error('补全失败'); setLoading(false) }
  }

  return (
    <Card title="AI 生成题目">
      <Segmented
        value={mode}
        onChange={v => setMode(v as 'single' | 'batch' | 'fill')}
        options={[
          { value: 'single', label: '单分类生成' },
          { value: 'batch', label: '批量生成' },
          { value: 'fill', label: '补全答案' },
        ]}
        style={{ marginBottom: 24 }}
      />

      {mode === 'single' && (
        <Form layout="vertical" onFinish={onSingleFinish} style={{ maxWidth: 500 }}>
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
          <Button type="primary" htmlType="submit" loading={loading}>开始生成</Button>
        </Form>
      )}

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
            <Button type="primary" htmlType="submit" loading={loading} danger>启动批量生成</Button>
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

      {mode === 'fill' && (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col>
              <Statistic title="待补草稿" value={draftCount} suffix="题" />
            </Col>
          </Row>
          <Form layout="vertical" onFinish={onFillFinish} style={{ maxWidth: 500 }}>
            <Form.Item name="categoryId" label="分类（留空则补所有分类）">
              <Select allowClear options={categories.map(c => ({ value: c.id, label: c.name }))} showSearch placeholder="选择分类" />
            </Form.Item>
            <Form.Item name="count" label="补全数量" initialValue={10} tooltip="一次最多补 100 道">
              <InputNumber min={1} max={100} />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>开始补全</Button>
          </Form>

          {task && (
            <Card size="small" style={{ marginTop: 16 }}>
              <Progress percent={task.total > 0 ? Math.round((task.successCount + task.failCount) / task.total * 100) : 0} />
              {task.message && task.status === 'RUNNING' && <p><Tag color="processing">{task.message}</Tag></p>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', fontSize: 14, color: '#52525B' }}>
                <span>成功: {task.successCount}</span>
                <span>失败: {task.failCount}</span>
                <span>共: {task.total}</span>
              </div>
              {task.errors?.length > 0 && <Alert type="error" message={task.errors.join('; ')} />}
            </Card>
          )}
        </>
      )}

      {task && mode === 'single' && (
        <Card size="small" style={{ marginTop: 16 }}>
          <Progress percent={task.total > 0 ? Math.round((task.successCount + task.failCount) / task.total * 100) : 0} />
          {task.message && task.status === 'RUNNING' && <p><Tag color="processing">{task.message}</Tag></p>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', fontSize: 14, color: '#52525B' }}>
            <span>成功: {task.successCount}</span><span>失败: {task.failCount}</span><span>共: {task.total}</span>
          </div>
          {task.errors?.length > 0 && <Alert type="error" message={task.errors.join('; ')} />}
        </Card>
      )}
    </Card>
  )
}
