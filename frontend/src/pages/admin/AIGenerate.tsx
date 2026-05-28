import { useState } from 'react'
import { Card, Form, Select, InputNumber, Input, Button, Progress, Alert, message } from 'antd'
import { generateQuestions, getGenerationTask } from '../../api/admin'

export default function AIGenerate() {
  const [loading, setLoading] = useState(false)
  const [task, setTask] = useState<any>(null)

  const onFinish = async (values: any) => {
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
          if (t.status === 'COMPLETED') message.success(`成功生成 ${t.successCount} 道题`)
          else if (t.status === 'PARTIAL') message.warning(`部分成功：${t.successCount}/${t.total}`)
          else message.error('生成失败')
        }
      } catch {
        clearInterval(timer)
        setLoading(false)
      }
    }, 3000)
  }

  return (
    <Card title="AI 批量生成题目">
      <Form layout="vertical" onFinish={onFinish} style={{ maxWidth: 500 }}>
        <Form.Item name="category" label="分类" rules={[{ required: true }]}>
          <Select options={[
            { value: 'Java基础', label: 'Java基础' },
            { value: 'Java并发', label: 'Java并发' },
            { value: 'JVM', label: 'JVM' },
            { value: 'MySQL', label: 'MySQL' },
            { value: 'Redis', label: 'Redis' },
            { value: 'Spring', label: 'Spring' },
            { value: 'SpringBoot', label: 'SpringBoot' },
            { value: '计算机网络', label: '计算机网络' },
            { value: '操作系统', label: '操作系统' },
            { value: '数据结构', label: '数据结构' },
            { value: '前端', label: '前端' },
          ]} />
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
      {task && (
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
