import { useState, useEffect } from 'react'
import { Card, Form, Select, InputNumber, Input, Button, Progress, Alert, message, Radio, Space, Tag, Divider } from 'antd'
import { generateQuestions, getGenerationTask, batchGenerate, getBatchStatus } from '../../api/admin'
import { getCategories } from '../../api/category'
import type { Category } from '../../types'

export default function AIGenerate() {
  const [mode, setMode] = useState<'single' | 'batch'>('single')
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [task, setTask] = useState<any>(null)
  const [batchStatus, setBatchStatus] = useState<'IDLE' | 'RUNNING'>('IDLE')

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {})
    getBatchStatus().then(s => setBatchStatus(s as any)).catch(() => {})
  }, [])

  const categoryOptions = categories.map(c => ({ value: c.name, label: c.name }))

  const onSingleFinish = async (values: any) => {
    setLoading(true)
    setTask(null)
    try {
      const id = await generateQuestions(values)
      pollTask(id)
    } catch {
      message.error('生成失败')
      setLoading(false)
    }
  }

  const pollTask = (id: number) => {
    const timer = setInterval(async () => {
      try {
        const t = await getGenerationTask(id)
        setTask(t)
        if (t.status === 'COMPLETED' || t.status === 'FAILED' || t.status === 'PARTIAL') {
          clearInterval(timer)
          setLoading(false)
          if (t.status === 'COMPLETED') {
            message.success(`成功生成 ${t.successCount} 道题`)
          } else if (t.status === 'PARTIAL') {
            message.warning(`部分成功：${t.successCount}/${t.total}`)
          } else {
            message.error('生成失败')
          }
        }
      } catch {
        clearInterval(timer)
        setLoading(false)
      }
    }, 3000)
  }

  const onBatchFinish = async (values: any) => {
    setLoading(true)
    try {
      await batchGenerate({
        countPerCategory: values.countPerCategory ?? 10,
        categoryName: values.categoryName,
        delaySeconds: values.delaySeconds ?? 3,
      })
      message.success('批量生成任务已启动，请查看后端日志跟踪进度')
      setBatchStatus('RUNNING')
      pollBatchStatus()
    } catch {
      message.error('启动批量任务失败')
      setLoading(false)
    }
  }

  const pollBatchStatus = () => {
    const timer = setInterval(async () => {
      try {
        const s = await getBatchStatus()
        setBatchStatus(s as any)
        if (s === 'IDLE') {
          clearInterval(timer)
          setLoading(false)
          message.success('批量生成任务已完成，请查看后端日志了解详情')
        }
      } catch {
        clearInterval(timer)
        setLoading(false)
      }
    }, 5000)
  }

  return (
    <Card title="AI 生成题目">
      <Radio.Group value={mode} onChange={e => setMode(e.target.value)} style={{ marginBottom: 24 }}>
        <Radio.Button value="single">单分类生成</Radio.Button>
        <Radio.Button value="batch">批量生成（全部分类）</Radio.Button>
      </Radio.Group>

      {mode === 'single' && (
        <Form layout="vertical" onFinish={onSingleFinish} style={{ maxWidth: 500 }}>
          <Form.Item name="category" label="分类" rules={[{ required: true }]}>
            <Select options={categoryOptions} showSearch placeholder="选择分类" />
          </Form.Item>
          <Form.Item name="difficulty" label="难度">
            <Select allowClear options={[
              { value: 'EASY', label: '简单' },
              { value: 'MEDIUM', label: '中等' },
              { value: 'HARD', label: '困难' },
            ]} />
          </Form.Item>
          <Form.Item name="count" label="生成数量" initialValue={5}>
            <InputNumber min={1} max={20} />
          </Form.Item>
          <Form.Item name="topic" label="主题关键词（可选）">
            <Input placeholder="如：HashMap原理" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            开始生成
          </Button>
        </Form>
      )}

      {mode === 'batch' && (
        <>
          <Space style={{ marginBottom: 16 }}>
            <span>批量任务状态：</span>
            <Tag color={batchStatus === 'RUNNING' ? 'processing' : 'default'}>
              {batchStatus === 'RUNNING' ? '运行中' : '空闲'}
            </Tag>
          </Space>
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
            <Button type="primary" htmlType="submit" loading={loading} danger>
              启动批量生成
            </Button>
          </Form>
          <Divider />
          <Alert
            type="info"
            showIcon
            message="批量生成说明"
            description={
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                <li>每个分类会调用一次 AI 接口，间隔时间防止限流</li>
                <li>已有足够题目的分类会自动跳过</li>
                <li>生成的题目直接发布（PUBLISHED），无需审核</li>
                <li>详细进度请查看后端控制台日志</li>
                <li>29 个分类 × 10 题 ≈ 290 道题，预计 5-8 分钟</li>
              </ul>
            }
          />
        </>
      )}

      {task && mode === 'single' && (
        <Card size="small" style={{ marginTop: 16 }}>
          <Progress percent={task.total > 0 ? Math.round((task.successCount + task.failCount) / task.total * 100) : 0} />
          <p>成功: {task.successCount} / 失败: {task.failCount} / 共: {task.total}</p>
          {task.errors?.length > 0 && (
            <Alert type="error" message={task.errors.join('; ')} />
          )}
        </Card>
      )}
    </Card>
  )
}
