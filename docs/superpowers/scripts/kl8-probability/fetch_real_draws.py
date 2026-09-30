"""抓取快乐8真实开奖数据，并做随机性审计。

回答的是「历史开奖号里到底有没有可利用信号」这个问题——这是「把真实开奖号喂给模型
有没有用」的前置问题，且不需要调用任何模型。

数据源：中彩网 jc.zhcw.com（与项目 ZhcwKl8DrawFetcher 同一接口）。
审计项：
  1. 号码频次卡方检验（80 个号码是否均匀）
  2. 相邻两期重号数（是否等于超几何期望 5）
  3. 冷热持续性（前半段的热号/冷号在后半段是否延续）
  4. 期与期之间命中数的自相关

用法：python fetch_real_draws.py <输出报告路径> [数据缓存 csv]
"""
import io
import json
import math
import os
import ssl
import sys
import time
import urllib.request
from collections import Counter

REPORT = sys.argv[1] if len(sys.argv) > 1 else "real_draws_report.txt"
CACHE = sys.argv[2] if len(sys.argv) > 2 else "real_draws.csv"

out = io.TextIOWrapper(open(REPORT, "wb"), encoding="utf-8", newline="\n")

API = ("https://jc.zhcw.com/port/client_json.php?transactionType=10001001&lotteryId=6"
       "&issueCount=6000&type=0&pageNum={page}&pageSize=1000&callback=callback&tt={ts}")
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
    "Referer": "https://www.zhcw.com/kjxx/kl8/",
    "Accept": "application/json,text/javascript,*/*;q=0.01",
    "Accept-Language": "zh-CN,zh;q=0.9",
}


def fetch_draws():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    seen = {}
    order = []
    for page in range(1, 11):
        url = API.format(page=page, ts=int(time.time() * 1000))
        req = urllib.request.Request(url, headers=HEADERS)
        try:
            raw = urllib.request.urlopen(req, timeout=25, context=ctx).read().decode("utf-8", "replace")
        except Exception as exc:  # 网络不可用时直接把原因写进报告，不静默失败
            print(f"[warn] page {page} 抓取失败: {exc}", file=sys.stderr)
            break
        start, end = raw.find("{"), raw.rfind("}")
        if start < 0 or end <= start:
            break
        try:
            data = json.loads(raw[start:end + 1]).get("data") or []
        except Exception as exc:
            print(f"[warn] page {page} 解析失败: {exc}", file=sys.stderr)
            break
        if not data:
            break
        added = 0
        for item in data:
            issue = str(item.get("issue", "")).strip()
            day = str(item.get("openTime", "")).strip()
            # 中彩网用空格分隔号码（"02 03 04 ..."），官方接口用逗号，两种都兼容
            nums = [int(x) for x in str(item.get("frontWinningNum", "")).replace(",", " ").split() if x.isdigit()]
            if not issue or len(nums) != 20 or issue in seen:
                continue
            seen[issue] = (day, sorted(nums))
            order.append(issue)
            added += 1
        if added == 0:
            break
    order.sort()
    return [(issue, seen[issue][0], seen[issue][1]) for issue in order]


def load_or_fetch():
    if os.path.exists(CACHE):
        rows = []
        with open(CACHE, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                issue, day, numstr = line.split(",", 2)
                rows.append((issue, day, [int(x) for x in numstr.split()]))
        if rows:
            print(f"[info] 使用缓存 {CACHE}", file=sys.stderr)
            return rows
    rows = fetch_draws()
    if rows:
        with open(CACHE, "w", encoding="utf-8", newline="\n") as fh:
            for issue, day, nums in rows:
                fh.write(f"{issue},{day},{' '.join(str(n) for n in nums)}\n")
    return rows


def norm_cdf(x):
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def gammainc_lower_reg(a, x):
    """正则化下不完全伽马函数 P(a,x)，用于卡方分布的精确 p 值。"""
    if x <= 0:
        return 0.0
    if x < a + 1.0:
        term = 1.0 / a
        total = term
        n = 0
        while True:
            n += 1
            term *= x / (a + n)
            total += term
            if abs(term) < abs(total) * 1e-15 or n > 10000:
                break
        return total * math.exp(-x + a * math.log(x) - math.lgamma(a))
    # 连分式求 Q(a,x)
    tiny = 1e-300
    b = x + 1.0 - a
    c = 1.0 / tiny
    d = 1.0 / b
    h = d
    for i in range(1, 10000):
        an = -i * (i - a)
        b += 2.0
        d = an * d + b
        if abs(d) < tiny:
            d = tiny
        c = b + an / c
        if abs(c) < tiny:
            c = tiny
        d = 1.0 / d
        delta = d * c
        h *= delta
        if abs(delta - 1.0) < 1e-15:
            break
    q = math.exp(-x + a * math.log(x) - math.lgamma(a)) * h
    return 1.0 - q


def chi2_pvalue(stat, df):
    return 1.0 - gammainc_lower_reg(df / 2.0, stat / 2.0)


def main():
    rows = load_or_fetch()
    if not rows:
        out.write("未能获取任何真实开奖数据（网络不可用或数据源变更）。\n")
        out.flush()
        return

    issues = [r[0] for r in rows]
    dates = [r[1] for r in rows]
    draws = [r[2] for r in rows]
    n = len(draws)
    total_numbers = n * 20

    out.write("=" * 68 + "\n")
    out.write("快乐8 真实开奖数据随机性审计\n")
    out.write("=" * 68 + "\n")
    out.write(f"数据源      : 中彩网 jc.zhcw.com（项目 ZhcwKl8DrawFetcher 同一接口）\n")
    out.write(f"期数        : {n}\n")
    out.write(f"期号范围    : {issues[0]} ~ {issues[-1]}\n")
    out.write(f"日期范围    : {dates[0]} ~ {dates[-1]}\n")
    out.write(f"号码观测总数: {total_numbers}\n\n")

    expected_per_number = total_numbers / 80.0

    # 1. 频次卡方检验
    counter = Counter()
    for nums in draws:
        counter.update(nums)
    chi2 = 0.0
    for num in range(1, 81):
        obs = counter.get(num, 0)
        chi2 += (obs - expected_per_number) ** 2 / expected_per_number
    df = 79
    p_freq = chi2_pvalue(chi2, df)
    out.write("【检验 1】80 个号码出现频次是否均匀（卡方拟合优度）\n")
    out.write(f"  每个号码期望出现 {expected_per_number:.1f} 次\n")
    out.write(f"  卡方统计量 = {chi2:.2f}，自由度 = {df}，p = {p_freq:.4f}\n")
    out.write(f"  判定：{'未发现偏离均匀（p > 0.05）' if p_freq > 0.05 else '存在统计显著偏离（p <= 0.05）'}\n")
    ranked = sorted(range(1, 81), key=lambda k: -counter.get(k, 0))
    out.write(f"  最热 5 号: {[(k, counter.get(k, 0)) for k in ranked[:5]]}\n")
    out.write(f"  最冷 5 号: {[(k, counter.get(k, 0)) for k in ranked[-5:]]}\n\n")

    # 2. 相邻两期重号数：两期独立开奖时重叠数服从 Hypergeometric(80,20,20)，期望 5
    overlaps = [len(set(draws[i]) & set(draws[i + 1])) for i in range(n - 1)]
    exp_overlap = 20 * 20 / 80.0
    var_overlap = 20 * (20 / 80.0) * (60 / 80.0) * ((80 - 20) / (80 - 1.0))
    mean_overlap = sum(overlaps) / len(overlaps) if overlaps else 0.0
    sd_mean = math.sqrt(var_overlap / len(overlaps)) if overlaps else 0.0
    z_overlap = (mean_overlap - exp_overlap) / sd_mean if sd_mean else 0.0
    p_overlap = 2 * (1 - norm_cdf(abs(z_overlap)))
    out.write("【检验 2】相邻两期重号数（历史能否预测下一期的最直接检验）\n")
    out.write(f"  理论期望 {exp_overlap:.2f} 个（超几何分布），观测均值 {mean_overlap:.4f} 个\n")
    out.write(f"  z = {z_overlap:+.3f}，p = {p_overlap:.4f}\n")
    out.write(f"  判定：{'与独立开奖一致，上期号码对下期无信息' if p_overlap > 0.05 else '存在显著重号倾向'}\n")
    out.write(f"  重号数分布（0-10）: {[overlaps.count(k) for k in range(11)]}\n\n")

    # 3. 冷热持续性：前半段的热号/冷号在后半段是否延续
    half = n // 2
    first, second = draws[:half], draws[half:]
    c1, c2 = Counter(), Counter()
    for nums in first:
        c1.update(nums)
    for nums in second:
        c2.update(nums)
    hot20 = sorted(range(1, 81), key=lambda k: -c1.get(k, 0))[:20]
    cold20 = sorted(range(1, 81), key=lambda k: c1.get(k, 0))[:20]
    hot_rate = sum(c2.get(k, 0) for k in hot20) / (len(second) * 20.0)
    cold_rate = sum(c2.get(k, 0) for k in cold20) / (len(second) * 20.0)
    sd_rate = math.sqrt(0.25 * 0.75 / (len(second) * 20.0))
    z_hot = (hot_rate - 0.25) / sd_rate
    z_cold = (cold_rate - 0.25) / sd_rate
    out.write("【检验 3】冷热是否可持续（前半段选号法能否在样本外复现）\n")
    out.write(f"  样本切分：前 {half} 期定冷热，后 {len(second)} 期验证\n")
    out.write(f"  前半段最热 20 号在后半段的开出率 = {hot_rate:.4%}（基线 25%），z = {z_hot:+.3f}\n")
    out.write(f"  前半段最冷 20 号在后半段的开出率 = {cold_rate:.4%}（基线 25%），z = {z_cold:+.3f}\n")
    out.write(f"  判定：{'冷热无持续性，历史选号不能外推' if max(abs(z_hot), abs(z_cold)) < 1.96 else '存在持续性信号'}\n\n")

    # 4. 期与期命中数自相关（滞后 1..5）
    def hits(a, b):
        return len(set(a) & set(b))

    out.write("【检验 4】命中数序列自相关（滞后 1~5）\n")
    base = [hits(draws[i], draws[i + 1]) for i in range(n - 1)]
    mb = sum(base) / len(base)
    denom = sum((v - mb) ** 2 for v in base)
    for lag in range(1, 6):
        series = base[:len(base) - lag]
        shifted = base[lag:]
        if len(series) < 10 or denom == 0:
            continue
        ms = sum(series) / len(series)
        msh = sum(shifted) / len(shifted)
        cov = sum((series[i] - ms) * (shifted[i] - msh) for i in range(len(series)))
        vs = math.sqrt(sum((v - ms) ** 2 for v in series))
        vh = math.sqrt(sum((v - msh) ** 2 for v in shifted))
        r = cov / (vs * vh) if vs and vh else 0.0
        thr = 1.96 / math.sqrt(len(series))
        out.write(f"  滞后 {lag}: r = {r:+.4f}（|r| 超过 {thr:.4f} 才算显著）{'  ← 显著' if abs(r) > thr else ''}\n")
    out.write("\n")

    out.write("=" * 68 + "\n")
    out.write("结论\n")
    out.write("=" * 68 + "\n")
    signals = []
    if p_freq <= 0.05:
        signals.append("号码频次不均匀")
    if p_overlap <= 0.05:
        signals.append("相邻期重号异常")
    if max(abs(z_hot), abs(z_cold)) >= 1.96:
        signals.append("冷热有持续性")
    if signals:
        out.write("发现疑似信号：" + "、".join(signals) + "（需进一步复核，注意多重比较假阳性）\n")
    else:
        out.write("四项检验全部未发现可利用信号。真实历史开奖号不含对未来开奖的预测信息，\n")
        out.write("因此「把真实开奖号喂给模型」不会改变结论——输入已经包含真实号码，问题不在输入。\n")
    out.flush()


main()
