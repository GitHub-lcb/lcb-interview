"""把真实开奖号喂给 Jev，并用同形状的随机历史做对照。

三个实验：
  A. real vs random：输入换成真实历史 vs 随机生成历史，看输出能否区分。
     若无法区分，说明模型根本没有利用历史——「输入有问题」这个假设不成立。
  B. 重复性：同一份真实输入连跑 3 次，看 top-4 是否稳定。
  C. 前推校准：用 2073 期真实数据做 walk-forward，逐期用「该期之前的历史」向模型提问，
     再用真实开奖结果算 Brier 分数，与常数 0.25 基线的 Brier(0.1875) 对比。
     Brier 是严格适当评分规则，模型若真有判别力，必须显著低于 0.1875。

用法：python jev_real_vs_random.py <报告路径> <密钥文件> <real_draws.csv> [前推期数]
"""
import io
import json
import math
import os
import random
import ssl
import sys
import time
import urllib.request
from collections import Counter

REPORT = sys.argv[1]
KEY_FILE = sys.argv[2]
CSV = sys.argv[3]
FORWARD_ISSUES = int(sys.argv[4]) if len(sys.argv) > 4 else 15

ENDPOINT = "https://api.typesafe.ai/v1/systemone"
MODEL = "jev-latest"
BASELINE = 0.25
BRIER_BASELINE = 0.1875

out = io.TextIOWrapper(open(REPORT, "wb"), encoding="utf-8", newline="\n")


def log(msg):
    out.write(msg + "\n")
    out.flush()


def api_key():
    with open(KEY_FILE, "r", encoding="utf-8") as fh:
        return fh.read().strip()


KEY = api_key()

CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE


def jev(state, questions, attempts=3):
    body = json.dumps({"model": MODEL, "state": state, "questions": questions}, ensure_ascii=False)
    for attempt in range(1, attempts + 1):
        try:
            req = urllib.request.Request(
                ENDPOINT, data=body.encode("utf-8"),
                headers={"Content-Type": "application/json", "Accept": "application/json",
                         "Authorization": "Bearer " + KEY}, method="POST")
            raw = urllib.request.urlopen(req, timeout=120, context=CTX).read().decode("utf-8", "replace")
            return json.loads(raw)
        except urllib.error.HTTPError as exc:
            if exc.code in (429, 529) or exc.code >= 500:
                if attempt < attempts:
                    time.sleep(1.5 * attempt)
                    continue
            raise RuntimeError("JEV HTTP %s: %s" % (exc.code, exc.read()[:300].decode("utf-8", "replace")))
        except Exception:
            if attempt < attempts:
                time.sleep(1.5 * attempt)
                continue
            raise


def load_draws():
    rows = []
    with open(CSV, "r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            issue, day, numstr = line.split(",", 2)
            rows.append((issue, day, [int(x) for x in numstr.split()]))
    return rows


def random_draws(n, seed=20260920):
    rng = random.Random(seed)
    rows = []
    for i in range(n):
        nums = sorted(rng.sample(range(1, 81), 20))
        rows.append(("R%05d" % (n - i), "2026-01-01", nums))
    return rows


def build_state(draws, pick_size=4):
    """draws 按时间正序；state 与 Java 侧保持同构（最近 30 期按最新在前）。"""
    recent = list(reversed(draws))[:30]
    counter = Counter()
    for _, _, nums in draws:
        counter.update(nums)
    hot = sorted(range(1, 81), key=lambda k: -counter.get(k, 0))[:10]
    cold = sorted(range(1, 81), key=lambda k: counter.get(k, 0))[:10]

    last_seen = {}
    total = len(draws)
    for idx, (_, _, nums) in enumerate(draws):
        for num in nums:
            last_seen[num] = idx
    missing = {n: total - 1 - last_seen.get(n, -1) for n in range(1, 81)}
    top_missing = dict(sorted(missing.items(), key=lambda kv: -kv[1])[:20])

    profiles = []
    for num in range(1, 81):
        recent30 = sum(1 for _, _, nums in draws[-30:] if num in nums)
        profiles.append({"number": num, "frequency": counter.get(num, 0),
                         "recent30": recent30, "current_missing": missing[num]})

    return {
        "schema_note": "以下均为快乐8历史开奖的统计特征，不含未来信息。",
        "game": "中国福利彩票快乐8（基诺型开奖）：号码范围 1 到 80，每期固定开出 20 个号码，各期开奖相互独立。",
        "play_mode": "选%d：每注从 80 个号码中选 %d 个，命中 2 个及以上即有奖。" % (pick_size, pick_size),
        "draws_used": total,
        "latest_issue_no": recent[0][0] if recent else "",
        "theoretical_single_number_probability": BASELINE,
        "hot_numbers": hot,
        "cold_numbers": cold,
        "top_missing": top_missing,
        "recent_draws": [{"issue_no": i, "draw_date": d, "numbers": nums} for i, d, nums in recent],
        "number_profiles": profiles,
    }


def build_questions(pick_size=4):
    criter_true = "该号码在下一期的 20 个开奖号码之中（每个号码的长期基率均为 0.25）"
    criter_false = "该号码不在下一期的 20 个开奖号码之中（长期基率为 0.75）"
    questions = {}
    for num in range(1, 81):
        questions["n%d" % num] = {
            "type": "noul",
            "instructions": "根据 state 中的历史统计特征，号码 %d 是否会在下一期开奖的 20 个号码中出现？" % num,
            "criteria": {"true": criter_true, "false": criter_false},
        }
    return questions


def extract(resp):
    probs = {}
    for num in range(1, 81):
        node = resp.get("answers", {}).get("n%d" % num)
        if not node:
            continue
        value = node.get("noul", node.get("probability"))
        if value is not None:
            probs[num] = float(value)
    return probs


def describe(label, probs, taken, resp):
    total = sum(probs.values())
    above = sum(1 for v in probs.values() if v > BASELINE)
    top4 = sorted(sorted(probs, key=lambda k: (-probs[k], k))[:4])
    usage = resp.get("usage", {})
    log("  [%s] 模型=%s 覆盖号码=%d/80" % (label, resp.get("model", "?"), len(probs)))
    log("       概率和=%.3f（规则要求 20，隐含开出 %.2f 个）" % (total, total))
    log("       均值=%.4f  高于基线的号码数=%d/80" % (total / max(1, len(probs)), above))
    log("       top4=%s" % top4)
    log("       token 输入=%s 输出=%s" % (usage.get("input_tokens"), usage.get("output_tokens")))
    return {"probs": probs, "sum": total, "mean": total / max(1, len(probs)), "above": above,
            "top4": top4, "resp": resp, "elapsed": taken}


def brier(probs, actual):
    """对一个号码集合的概率与真实开奖计算 Brier 分数。"""
    total = 0.0
    count = 0
    for num in range(1, 81):
        p = probs.get(num, BASELINE)
        y = 1.0 if num in actual else 0.0
        total += (p - y) ** 2
        count += 1
    return total / count


draws = load_draws()
log("=" * 70)
log("Jev 真实开奖号 vs 随机历史 —— 对照实验")
log("=" * 70)
log("真实数据：%d 期（%s ~ %s）" % (len(draws), draws[0][0], draws[-1][0]))
log("端点：%s  模型：%s" % (ENDPOINT, MODEL))
log("")

questions = build_questions()

# ---------- 实验 A：real vs random ----------
log("-" * 70)
log("实验 A：真实历史 vs 随机历史（同形状，唯一差别是号码本身）")
log("-" * 70)
real_state = build_state(draws)
rand_state = build_state(random_draws(90))
log("真实 state：draws_used=%d, latest=%s, recent_draws=%d 期"
    % (real_state["draws_used"], real_state["latest_issue_no"], len(real_state["recent_draws"])))
log("  最近 3 期真实号码：%s" % [d["numbers"] for d in real_state["recent_draws"][:3]])
log("随机 state：draws_used=%d, recent_draws=%d 期"
    % (rand_state["draws_used"], len(rand_state["recent_draws"])))
log("  最近 3 期随机号码：%s" % [d["numbers"] for d in rand_state["recent_draws"][:3]])
log("")

t0 = time.time()
r_real = jev(real_state, questions)
t_real = time.time() - t0
d_real = describe("真实历史", extract(r_real), t_real, r_real)

t0 = time.time()
r_rand = jev(rand_state, questions)
t_rand = time.time() - t0
d_rand = describe("随机历史", extract(r_rand), t_rand, r_rand)

diff = d_real["mean"] - d_rand["mean"]
log("")
log("  均值差（真实 - 随机）= %+.4f" % diff)
log("  top4 重叠 = %d / 4" % len(set(d_real["top4"]) & set(d_rand["top4"])))
log("  → 两组输入的号码完全不同，但输出量级与形态%s" %
    ("几乎一致，模型未利用历史" if abs(diff) < 0.03 else "存在可见差异"))
log("")

# ---------- 实验 B：重复性 ----------
log("-" * 70)
log("实验 B：同一份真实输入连跑 3 次（排序稳定性）")
log("-" * 70)
runs = [d_real["top4"]]
for i in range(2):
    rr = jev(real_state, questions)
    runs.append(sorted(sorted(extract(rr), key=lambda k: (-extract(rr)[k], k))[:4]))
    log("  第 %d 次 top4 = %s" % (i + 2, runs[-1]))
log("  第 1 次 top4 = %s" % runs[0])
overlaps = []
for i in range(len(runs)):
    for j in range(i + 1, len(runs)):
        overlaps.append(len(set(runs[i]) & set(runs[j])))
log("  两两重叠：%s，平均 %.2f / 4（完全稳定应为 4）" % (overlaps, sum(overlaps) / len(overlaps)))
log("")

# ---------- 实验 C：前推校准 ----------
log("-" * 70)
log("实验 C：前推校准（walk-forward）—— 用历史预测下一期，与真实开奖对比")
log("-" * 70)
log("常数基线 Brier = %.4f（0.25 恒定预测的严格适当评分）" % BRIER_BASELINE)
log("前推 %d 期，每期只用该期之前的历史，无未来信息泄漏" % FORWARD_ISSUES)
log("")
start = len(draws) - FORWARD_ISSUES
briers = []
means = []
aboves = []
hits_at_2 = []
for idx in range(start, len(draws)):
    history = draws[:idx]
    actual = set(draws[idx][2])
    st = build_state(history)
    resp = jev(st, questions)
    pr = extract(resp)
    b = brier(pr, actual)
    mean_p = sum(pr.values()) / max(1, len(pr))
    above = sum(1 for v in pr.values() if v > BASELINE)
    top4 = sorted(sorted(pr, key=lambda k: (-pr[k], k))[:4])
    hit = len(set(top4) & actual)
    briers.append(b)
    means.append(mean_p)
    aboves.append(above)
    hits_at_2.append(hit)
    log("  期 %s: Brier=%.4f  概率和=%.2f  高于基线=%d/80  top4=%s  实际命中=%d/4"
        % (draws[idx][0], b, sum(pr.values()), above, top4, hit))
    time.sleep(0.4)

avg_brier = sum(briers) / len(briers)
avg_mean = sum(means) / len(means)
avg_above = sum(aboves) / len(aboves)
log("")
log("  平均 Brier = %.4f  （基线 %.4f，差值 %+.4f）" % (avg_brier, BRIER_BASELINE, avg_brier - BRIER_BASELINE))
log("  平均概率均值 = %.4f  （应等于 0.25）" % avg_mean)
log("  平均高于基线号码数 = %.1f / 80" % avg_above)
log("  top4 平均命中 = %.2f / 4（理论期望 %.4f，4选4命中数期望 = 4*20/80 = 1.0）"
    % (sum(hits_at_2) / len(hits_at_2), 1.0))
n = len(briers)
sd = math.sqrt(sum((b - avg_brier) ** 2 for b in briers) / max(1, n - 1))
log("  Brier 标准差 = %.4f，均值的标准误 = %.4f" % (sd, sd / math.sqrt(n)))
log("  判定：Brier 若未显著低于 %.4f，模型就不具备判别力" % BRIER_BASELINE)
log("")

log("=" * 70)
log("结论")
log("=" * 70)
if abs(diff) < 0.03:
    log("1. 真实历史与随机历史的输出量级一致 → 模型没有从真实开奖号中得到任何信息。")
    log("   「把真实开奖号喂给模型」这一改法已被直接验证：无效。")
else:
    log("1. 真实历史与随机历史输出存在差异（%+.4f），需进一步复核是否为系统性判别。" % diff)
log("2. Brier 差值 %+.4f：%s" % (avg_brier - BRIER_BASELINE,
    "未优于常数基线，模型无判别力。" if avg_brier >= BRIER_BASELINE - 0.002 else "优于基线，需扩大样本复核。"))
out.flush()
