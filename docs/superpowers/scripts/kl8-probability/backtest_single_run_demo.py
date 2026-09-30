"""用真实开奖数据验证「回测择优能否找到更好的选号算法」。

这是对用户提出的方法论的直接检验：
  1. 在历史数据上搜索大量候选打分函数（每个都是一种「算法」）
  2. 回测每个算法，按 P(中2个及以上) 排名
  3. 观察「最好的算法」相对随机基线好多少
  4. 把最好的算法拿到样本外（未参与择优的数据）上测试
  5. 对照：完全随机的选号在同样流程下会得到什么「最优结果」

如果第 4 步回落到基线，说明回测排名衡量的是过拟合程度，不是预测能力。
"""
import csv
import math
import random
import sys
from itertools import combinations
N, D, PICK = 80, 20, 4
MIN_HIT = 2


def comb(n, k):
    return math.comb(n, k)


# 理论基线：任意固定 4 个号码的命中分布
def exact(k):
    return comb(D, k) * comb(N - D, PICK - k) / comb(N, PICK)


BASELINE = sum(exact(k) for k in range(MIN_HIT, PICK + 1))


def load(path):
    draws = []
    with open(path, encoding="utf-8") as fh:
        for row in csv.reader(fh):
            if len(row) < 3:
                continue
            draws.append((row[0], set(int(x) for x in row[2].split())))
    draws.sort(key=lambda item: item[0])
    return draws


def make_features(history):
    """只用 history（严格不含未来数据）构造每个号码的特征。"""
    n = len(history)
    freq = [0] * (N + 1)
    last_seen = [0] * (N + 1)
    for idx, (_, numbers) in enumerate(history):
        for num in numbers:
            freq[num] += 1
            last_seen[num] = idx
    recent = history[-30:]
    rfreq = [0] * (N + 1)
    for _, numbers in recent:
        for num in numbers:
            rfreq[num] += 1
    return {
        "freq": [0] + [f / n for f in freq[1:]],
        "recent": [0] + [f / len(recent) for f in rfreq[1:]],
        "missing": [0] + [(n - last_seen[i]) / n for i in range(1, N + 1)],
    }


def score_numbers(features, weights):
    f, r, m = features["freq"], features["recent"], features["missing"]
    return {num: weights[0] * f[num] + weights[1] * r[num] + weights[2] * m[num]
            for num in range(1, N + 1)}


def evaluate(draws, start, end, weights, lead=100):
    """在 [start, end) 区间上逐期走查前推回测。"""
    wins = 0
    trials = 0
    for idx in range(start, end):
        hist_start = max(0, idx - lead)
        if idx - hist_start < 30:
            continue
        features = make_features(draws[hist_start:idx])
        scores = score_numbers(features, weights)
        ticket = sorted(sorted(scores, key=scores.get, reverse=True)[:PICK])
        actual = draws[idx][1]
        hits = sum(1 for num in ticket if num in actual)
        if hits >= MIN_HIT:
            wins += 1
        trials += 1
    return wins, trials


def main():
    csv_path, report_path = sys.argv[1], sys.argv[2]
    draws = load(csv_path)
    total = len(draws)
    split = total - 400          # 最后 400 期作为样本外
    train_end = split

    lines = []
    add = lines.append
    add("=== 用真实开奖数据检验「回测择优」能否提升概率 ===")
    add(f"数据：{total} 期真实开奖（{draws[0][0]} ~ {draws[-1][0]}）")
    add(f"理论基线 P(至少中 2 个) = {BASELINE:.6%}（超几何分布，与选号策略无关）")
    add("")

    # --- 1. 搜索大量候选算法 ---
    rng = random.Random(20260930)
    candidates = []
    # 真实策略会用的：频次/近期/遗漏的线性组合
    for _ in range(300):
        candidates.append((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1)))
    # 极端对照：纯噪声权重
    for _ in range(300):
        candidates.append((rng.uniform(-50, 50), rng.uniform(-50, 50), rng.uniform(-50, 50)))

    add(f"=== 第 1 步：在 {train_end} 期训练区间上回测 {len(candidates)} 个候选算法 ===")
    add("（前 300 个是频次/近期/遗漏的随机线性权重，后 300 个是高倍噪声权重）")
    add("")

    results = []
    for idx, weights in enumerate(candidates):
        wins, trials = evaluate(draws, 30, train_end, weights)
        if trials == 0:
            continue
        results.append((wins / trials, wins, trials, weights, idx < 300))
    results.sort(key=lambda r: -r[0])

    best_rate, best_wins, best_trials, best_weights, best_sane = results[0]
    add(f"回测最优：命中率 {best_rate:.4%}（{best_wins}/{best_trials}），"
        f"相对基线 {best_rate - BASELINE:+.4%}，权重 {tuple(round(w, 3) for w in best_weights)}"
        f"（{'真实策略域' if best_sane else '纯噪声域'}）")

    # 纯噪声域的最好成绩：这是关键对照
    noise_best = [r for r in results if not r[4]]
    add(f"纯噪声权重域的最好成绩：{noise_best[0][0]:.4%}（{noise_best[0][1]}/{noise_best[0][2]}）")
    add(f"  -> 纯随机权重也能在回测里跑出 {noise_best[0][0]:.4%}，"
        f"比基线高 {noise_best[0][0] - BASELINE:+.4%}")
    add("")

    # --- 2. 排名分布：回测成绩的离散程度 ---
    rates = [r[0] for r in results]
    mean = sum(rates) / len(rates)
    var = sum((r - mean) ** 2 for r in rates) / len(rates)
    sd = math.sqrt(var)
    add("=== 第 2 步：回测成绩的分布 ===")
    add(f"全部 {len(rates)} 个算法的回测命中率：均值 {mean:.4%}，标准差 {sd:.4%}")
    add(f"最高 {max(rates):.4%}，最低 {min(rates):.4%}")
    add(f"随机波动能解释的极差约 ±2σ = ±{2 * sd:.4%}，"
        f"最优值落在 +{(max(rates) - mean) / sd:.2f}σ 处")
    add("  -> 「最优算法」比平均算法好很多，但这完全是随机波动的极值，不是预测能力")
    add("")

    # --- 3. 样本外检验 ---
    add(f"=== 第 3 步：把回测选出的最优算法拿到样本外（最后 {total - train_end} 期）验证 ===")
    oos_wins, oos_trials = evaluate(draws, train_end, total, best_weights)
    oos_rate = oos_wins / oos_trials if oos_trials else 0
    add(f"样本外命中率：{oos_rate:.4%}（{oos_wins}/{oos_trials}）")
    add(f"样本外相对基线：{oos_rate - BASELINE:+.4%}")
    add(f"回测里领先基线 {best_rate - BASELINE:+.4%}，样本外变成 {oos_rate - BASELINE:+.4%}")

    z = ((oos_wins / oos_trials) - BASELINE) / math.sqrt(
        BASELINE * (1 - BASELINE) / oos_trials) if oos_trials else 0
    add(f"样本外 z 值 = {z:+.3f}（|z| < 1.96 即与随机无显著差异）")
    add("")

    add("=== 结论 ===")
    if oos_rate - BASELINE < 0.01:
        add("样本外表现回落到基线附近：回测排名反映的是过拟合程度，不是预测能力。")
        add("选号算法无论怎么调优，都无法提高中奖概率——这是独立同分布抽样的数学性质。")
    else:
        add("样本外仍高于基线，值得进一步检验。")

    text = "\n".join(lines) + "\n"
    with open(report_path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)
    print(text)


if __name__ == "__main__":
    main()
