package com.lcbinterview.dto.tools;

import com.lcbinterview.service.LotteryKl8AuditCheckResult;

import java.util.List;

/**
 * 快乐8 随机性审计报告。
 * <p>
 * 回答的是「这批开奖数据本身是否可信、是否真随机」，而不是「下一期开什么」。
 * 这是整个工具链里唯一可能推翻「选号无法提升概率」结论的方向：
 * 若真查出偏差，偏差本身就是唯一可能被利用的信号。
 * <p>
 * <b>关于显著性判定</b>：本次审计同时跑 90+ 项检验，逐项用 5% 判定时纯随机就会出现
 * 至少一项误报。因此报告同时给出名义显著项数与 Bonferroni 校正后的显著项数，
 * 后者才是可信的告警依据。
 *
 * @param issueCount                    审计使用的期数
 * @param latestIssueNo                 最新期号
 * @param checks                        各项检验结果
 * @param checkCount                    检验项数
 * @param bonferroniThreshold           Bonferroni 校正后的逐项 p 值阈值
 * @param significantCount              名义 5% 水平的显著项数（仅供对照，含假阳性）
 * @param correctedSignificantCount     通过 Bonferroni 校正的显著项数，告警依据
 * @param invalidNumberCounts           号码个数不等于 20 的期数列表，为空表示数据质量通过
 * @param conclusion                    总结论
 * @param disclaimer                    风险提示
 */
public record LotteryKl8AuditReportVO(
        int issueCount,
        String latestIssueNo,
        List<LotteryKl8AuditCheckResult> checks,
        int checkCount,
        double bonferroniThreshold,
        long significantCount,
        long correctedSignificantCount,
        List<Integer> invalidNumberCounts,
        String conclusion,
        String disclaimer
) {
}
