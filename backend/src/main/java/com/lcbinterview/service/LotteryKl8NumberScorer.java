package com.lcbinterview.service;

import java.util.Map;

/**
 * 快乐8号码打分策略。
 *
 * 抽取该接口的目的不是立刻替换现有算法，而是给「任何决策模型」一个统一的接入位：
 * 无论是现有 6 因子规则、Jev 概率，还是以后的其它模型，都只需实现本接口，
 * 就能被同一套走查前推回测栅栏评估，避免出现绕过回测直接上线的旁路。
 *
 * 约定：
 * <ul>
 *   <li>分数越高表示越应入选，量纲由实现自行决定，不要求跨实现可比；</li>
 *   <li>不可用时返回空 Map，不要抛异常，调用方据此回退到其它策略；</li>
 *   <li>{@link #version()} 会写入推荐记录的 strategy_version，必须能唯一标识算法与配置。</li>
 * </ul>
 */
public interface LotteryKl8NumberScorer {

    /**
     * 策略版本标识，写入推荐记录的 strategy_version。
     *
     * @return 版本标识
     */
    String version();

    /**
     * 判断该策略当前是否可用。
     *
     * @return true 表示可参与打分
     */
    boolean available();

    /**
     * 对号码打分。
     *
     * @param report 历史特征报告
     * @return 号码 -&gt; 分数；不可用时返回空映射
     */
    Map<Integer, Double> score(LotteryKl8FeatureReport report);
}
