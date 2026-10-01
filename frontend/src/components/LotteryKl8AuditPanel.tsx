import { useEffect, useMemo, useState } from 'react'
import {
  Alert, Card, Col, Empty, Row, Segmented, Space, Statistic, Table, Tag, Tooltip,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { InfoCircleOutlined } from '@ant-design/icons'
import { getKl8Audit } from '../api/tools'
import type { LotteryKl8AuditCheck, LotteryKl8AuditReport } from '../types'

const ISSUE_OPTIONS = [500, 1000, 2000]

/**
 * p 值格式化。
 *
 * 极小的 p 值（如 1e-12）在样本外校验里是常态，直接显示科学计数法便于判断量级。
 */
function pValue(value: number): string {
  if (value === 0) {
    return '< 1e-16'
  }
  if (value < 0.0001) {
    return value.toExponential(2)
  }
  return value.toFixed(4)
}

/**
 * 判定徽标。区分「名义显著」与「通过多重比较校正」两级，
 * 前者在 90+ 项检验下属于常态假阳性，不能当作异常信号。
 */
function VerdictTag({ check, threshold }: { check: LotteryKl8AuditCheck, threshold: number }) {
  if (check.pValue < threshold) {
    return <Tag color="red">通过校正</Tag>
  }
  if (check.pValue < 0.05) {
    return <Tooltip title="名义 5% 水平显著，但在 90+ 项检验下属于预期假阳性">
      <Tag color="orange">名义显著</Tag>
    </Tooltip>
  }
  return <Tag color="green">未显著</Tag>
}

export default function LotteryKl8AuditPanel() {
  const [report, setReport] = useState<LotteryKl8AuditReport | null>(null)
  const [issueCount, setIssueCount] = useState<number>(2000)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const result = await getKl8Audit({ issueCount })
        if (!cancelled) {
          setReport(result)
        }
      } catch {
        // 全局拦截器已提示，这里兜住 Promise 避免未捕获异常
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [issueCount])

  const columns: ColumnsType<LotteryKl8AuditCheck> = useMemo(() => [
    {
      title: '检验项',
      dataIndex: 'name',
      key: 'name',
      render: (value: string) => <strong>{value}</strong>,
    },
    {
      title: '统计量',
      dataIndex: 'statistic',
      key: 'statistic',
      align: 'right',
      render: (value: number) => value.toFixed(4),
    },
    {
      title: 'p 值',
      dataIndex: 'pValue',
      key: 'pValue',
      align: 'right',
      render: (value: number) => <span style={{ fontFamily: 'var(--font-mono)' }}>{pValue(value)}</span>,
    },
    {
      title: '判定',
      key: 'verdict',
      render: (_, record) => (report
        ? <VerdictTag check={record} threshold={report.bonferroniThreshold} />
        : null),
    },
    {
      title: '结论',
      dataIndex: 'conclusion',
      key: 'conclusion',
      render: (value: string) => <span style={{ color: '#586069', fontSize: 12 }}>{value}</span>,
    },
  ], [report])

  // 逐号码游程检验有 80 项，单独折叠，避免淹没真正需要关注的少数几项
  const coreChecks = report?.checks.filter(check => !check.name.startsWith('游程检验')) ?? []
  const runsChecks = report?.checks.filter(check => check.name.startsWith('游程检验')) ?? []
  const runsAlerts = runsChecks.filter(check => report && check.pValue < report.bonferroniThreshold).length

  return (
    <section className="tool-section lottery-tool" aria-label="随机性审计">
      <div className="tool-section-head">
        <div>
          <div className="dashboard-kicker">随机性审计 · 快乐8</div>
          <h2>这批开奖数据本身可信吗</h2>
          <p>唯一可能推翻「选号无法提升概率」的地方：若摇奖设备有偏或抓取错期，偏差就是可利用的信号。</p>
        </div>
      </div>

      <Alert
        className="lottery-disclaimer"
        type="info"
        showIcon
        message="先看这个：91 项检验里出现一两个「显著」是正常的"
        description="本次同时跑 90+ 项检验，逐项用名义 5% 判定时，纯随机出现至少一项误报的概率接近 99%。所以判据必须做多重比较校正——只有 p 小于 0.05/91 才算真信号。否则干净数据必然被误报成异常，久而久之这个结论就没人再信了。"
      />

      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 6, color: '#586069', fontSize: 12 }}>审计期数</div>
        <Segmented
          options={ISSUE_OPTIONS.map(size => ({ label: `${size} 期`, value: size }))}
          value={issueCount}
          onChange={value => setIssueCount(Number(value))}
        />
      </Card>

      {!report ? (
        <div className="tool-empty-panel lottery-empty-panel">
          <Empty description={loading ? '正在运行检验' : '暂无审计结果'} />
        </div>
      ) : (
        <>
          <Card size="small" title="审计结论" style={{ marginBottom: 16 }}>
            <Row gutter={[16, 16]}>
              <Col xs={12} md={6}>
                <Statistic title="审计期数" value={report.issueCount} />
              </Col>
              <Col xs={12} md={6}>
                <Statistic title="检验项数" value={report.checkCount} />
              </Col>
              <Col xs={12} md={6}>
                <Statistic
                  title="名义 5% 显著"
                  value={report.significantCount}
                  valueStyle={{ color: '#B8820B' }}
                />
              </Col>
              <Col xs={12} md={6}>
                <Statistic
                  title="通过校正"
                  value={report.correctedSignificantCount}
                  valueStyle={{ color: report.correctedSignificantCount > 0 ? '#DC2626' : '#0F8A8F' }}
                />
              </Col>
            </Row>
            <Alert
              style={{ marginTop: 12 }}
              type={report.correctedSignificantCount > 0 ? 'error' : 'success'}
              showIcon
              message={`Bonferroni 校正阈值 p < ${report.bonferroniThreshold.toExponential(2)}`}
              description={`名义 5% 水平有 ${report.significantCount} 项「显著」，与 ${(report.checkCount * 0.05).toFixed(1)} 项的随机期望一致；校正后为 ${report.correctedSignificantCount} 项。`}
            />
            {report.invalidNumberCounts.length > 0 && (
              <Alert
                style={{ marginTop: 12 }}
                type="error"
                showIcon
                message={`数据质量检查未通过：${report.invalidNumberCounts.length} 期号码个数不等于 20`}
                description="号码个数不对时所有统计量的前提都不成立，请先排查抓取逻辑再解读审计结论。"
              />
            )}
          </Card>

          <Card
            size="small"
            title={(
              <Space>
                <span>核心检验</span>
                <Tooltip title="号码频次、相邻期重号、和值、奇偶、区间分布、序列相关性、位置均匀性">
                  <InfoCircleOutlined />
                </Tooltip>
              </Space>
            )}
            style={{ marginBottom: 16 }}
          >
            <Table
              rowKey="name"
              size="small"
              pagination={false}
              columns={columns}
              dataSource={coreChecks}
              locale={{ emptyText: '样本不足，请先同步更多开奖数据' }}
            />
          </Card>

          <Card size="small" title={`逐号码游程检验（${runsChecks.length} 项）`} style={{ marginBottom: 16 }}>
            <Alert
              type={runsAlerts > 0 ? 'error' : 'success'}
              showIcon
              message={runsAlerts > 0
                ? `${runsAlerts} 个号码的游程检验通过校正`
                : '80 个号码的游程检验全部未通过校正'}
              description="逐号码检查「开出/未开出」序列是否存在惯性。单个号码不显著说明它没有冷热惯性；80 项同时看时，同样必须做多重比较校正。"
              style={{ marginBottom: 12 }}
            />
            <Table
              rowKey="name"
              size="small"
              pagination={{ pageSize: 20, size: 'small' }}
              columns={columns}
              dataSource={runsChecks}
            />
          </Card>

          <Alert type="success" showIcon message="总结论" description={report.conclusion} />
          <Alert style={{ marginTop: 12 }} type="info" showIcon message={report.disclaimer} />
        </>
      )}
    </section>
  )
}
