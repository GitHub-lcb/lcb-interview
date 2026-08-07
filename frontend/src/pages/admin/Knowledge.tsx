import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert, Button, Card, Col, Empty, Progress, Row, Space, Statistic, Typography, Upload, message,
} from 'antd'
import {
  CloudUploadOutlined, DatabaseOutlined, FireOutlined, PlayCircleOutlined, ReloadOutlined,
} from '@ant-design/icons'
import type { RcFile } from 'antd/es/upload'
import {
  getCorpusStatus, getKnowledgeCleaningStatus, importCorpus,
  recalculateKnowledgeWeights, startCorpusExtract, startKnowledgeCleaning,
} from '../../api/admin'
import type { KnowledgeCleanProgress, KnowledgeCorpusProgress } from '../../types'

const { Text, Title } = Typography

function usePolling<T>(fetcher: () => Promise<T>, intervalMs = 5000) {
  const [data, setData] = useState<T | null>(null)
  const timerRef = useRef<number | null>(null)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const stop = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const refresh = useCallback(() => {
    fetcherRef.current().then(setData).catch(() => { /* 轮询失败保持旧值 */ })
  }, [])

  useEffect(() => {
    refresh()
    timerRef.current = window.setInterval(refresh, intervalMs)
    return stop
  }, [refresh, intervalMs, stop])

  return { data, refresh, stop }
}

export default function KnowledgeAdmin() {
  const { data: clean, refresh: refreshClean } = usePolling<KnowledgeCleanProgress>(getKnowledgeCleaningStatus)
  const { data: corpus, refresh: refreshCorpus } = usePolling<KnowledgeCorpusProgress>(getCorpusStatus)
  const [cleanStarting, setCleanStarting] = useState(false)
  const [extractStarting, setExtractStarting] = useState(false)
  const [weighting, setWeighting] = useState(false)
  const [weightResult, setWeightResult] = useState<number | null>(null)

  const startClean = () => {
    setCleanStarting(true)
    startKnowledgeCleaning()
      .then(ok => {
        if (ok) {
          message.success('考点清洗任务已启动')
        } else {
          message.warning('清洗任务已在运行中')
        }
        refreshClean()
      })
      .catch(() => message.error('启动清洗失败'))
      .finally(() => setCleanStarting(false))
  }

  const startExtract = () => {
    setExtractStarting(true)
    startCorpusExtract()
      .then(ok => {
        if (ok) {
          message.success('语料考点提取已启动')
        } else {
          message.warning('提取任务已在运行中')
        }
        refreshCorpus()
      })
      .catch(() => message.error('启动提取失败'))
      .finally(() => setExtractStarting(false))
  }

  const recalc = () => {
    setWeighting(true)
    setWeightResult(null)
    recalculateKnowledgeWeights()
      .then(count => {
        setWeightResult(count)
        message.success(`权重重算完成，更新 ${count} 个考点`)
      })
      .catch(() => message.error('权重重算失败'))
      .finally(() => setWeighting(false))
  }

  const importFiles: import('antd/es/upload').UploadProps['beforeUpload'] = (_, fileList) => {
    const readTasks = (fileList as RcFile[]).map(file => file.text().then(text => ({
      sourceUrl: `upload://${file.name}`,
      sourceName: '管理后台导入',
      company: '',
      position: '',
      publishDate: null,
      rawContent: text.slice(0, 20000),
    })))
    Promise.all(readTasks).then(items => {
      const valid = items.filter(item => item.rawContent.trim().length > 0)
      if (valid.length === 0) {
        message.warning('没有可导入的文本内容')
        return
      }
      importCorpus(valid)
        .then(count => message.success(`导入完成，新增 ${count} 条（共 ${valid.length} 条）`))
        .catch(() => message.error('导入失败'))
    })
    return false
  }

  const cleanPercent = clean && clean.totalQuestions > 0
    ? Math.round((clean.processedQuestions / clean.totalQuestions) * 100)
    : 0
  const corpusPercent = corpus && corpus.totalSources > 0
    ? Math.round((corpus.processedSources / corpus.totalSources) * 100)
    : 0

  return (
    <div style={{ padding: 24, background: '#EEF1F4', minHeight: '100vh' }}>
      <Title level={3} style={{ marginTop: 0 }}>高频考点管道</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 20 }}>
        数据流向：题目清洗 / 面经语料 → 考点 → 权重 → 公开「高频考点」页。AI 任务在后台执行，可离开本页。
      </Text>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title={<Space><DatabaseOutlined />题目考点清洗</Space>} extra={
            <Button type="primary" icon={<PlayCircleOutlined />} loading={cleanStarting} onClick={startClean}>
              启动清洗
            </Button>
          }>
            {clean ? (
              <>
                <Progress percent={cleanPercent} status={clean.running ? 'active' : undefined} />
                <Space size="large" wrap style={{ marginTop: 12 }}>
                  <Statistic title="已处理" value={clean.processedQuestions} suffix={`/ ${clean.totalQuestions}`} />
                  <Statistic title="新增考点" value={clean.newKnowledgePoints} />
                  <Statistic title="补标签题数" value={clean.taggedQuestions} />
                  <Statistic title="失败批次" value={clean.failedBatches} valueStyle={{ color: clean.failedBatches > 0 ? '#DC2626' : undefined }} />
                </Space>
                <Text type="secondary" style={{ display: 'block', marginTop: 12 }}>{clean.message}</Text>
                {clean.failedBatches > 0 && !clean.running ? (
                  <Alert type="warning" showIcon style={{ marginTop: 10 }} message="存在失败批次，可再次启动清洗重试" />
                ) : null}
              </>
            ) : <Empty description="暂无状态" />}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title={<Space><CloudUploadOutlined />面经语料</Space>} extra={
            <Space>
              <Upload
                multiple
                accept=".md,.txt"
                beforeUpload={importFiles}
                showUploadList={false}
              >
                <Button icon={<CloudUploadOutlined />}>导入文件</Button>
              </Upload>
              <Button type="primary" icon={<PlayCircleOutlined />} loading={extractStarting} onClick={startExtract}>
                启动提取
              </Button>
            </Space>
          }>
            {corpus ? (
              <>
                <Progress percent={corpusPercent} status={corpus.running ? 'active' : undefined} />
                <Space size="large" wrap style={{ marginTop: 12 }}>
                  <Statistic title="已处理" value={corpus.processedSources} suffix={`/ ${corpus.totalSources}`} />
                  <Statistic title="考点提及" value={corpus.newMentions} />
                  <Statistic title="失败批次" value={corpus.failedBatches} valueStyle={{ color: corpus.failedBatches > 0 ? '#DC2626' : undefined }} />
                </Space>
                <Text type="secondary" style={{ display: 'block', marginTop: 12 }}>{corpus.message}</Text>
              </>
            ) : <Empty description="暂无状态" />}
          </Card>
        </Col>

        <Col xs={24}>
          <Card title={<Space><FireOutlined />权重计算</Space>} extra={
            <Button icon={<ReloadOutlined />} loading={weighting} onClick={recalc}>
              重算权重
            </Button>
          }>
            <Text type="secondary">
              按「语料提及频次 60% + 覆盖篇数 25% + 题目覆盖度 15%」归一化计算 0-100 高频分，结果即时同步到公开考点排行。
            </Text>
            {weightResult !== null ? (
              <Alert type="success" showIcon style={{ marginTop: 12 }} message={`重算完成，更新 ${weightResult} 个考点权重`} />
            ) : null}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
