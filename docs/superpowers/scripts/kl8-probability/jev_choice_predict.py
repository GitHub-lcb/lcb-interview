"""按「直接让模型预测号码」的形态向 Jev 提问，并检验其选号能力。

与 80 个独立 Noul 的形态不同，这里用单次 Choice 提问：
「1 到 80 中哪一个号码最可能在下一期开出」，把返回的选项分布当作排名，
取 top-4 与真实开奖比对，看是否优于随机选号（理论期望命中 1.00 个）。

这样做的目的：彻底排除「是提问形态不对，不是模型不行」这一辩解。
"""
import io
import json
import math
import random
import ssl
import sys
import time
import urllib.request
from collections import Counter

REPORT = sys.argv[1]
KEY_FILE = sys.argv[2]
CSV = sys.argv[3]
ISSUES = int(sys.argv[4]) if len(sys.argv) > 4 else 10

ENDPOINT = "https://api.typesafe.ai/v1/systemone"
MODEL = "jev-latest"
out = io.TextIOWrapper(open(REPORT, "wb"), encoding="utf-8", newline="\n")


def log(m):
    out.write(m + "\n")
    out.flush()


with open(KEY_FILE, "r", encoding="utf-8") as fh:
    KEY = fh.read().strip()
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
            if (exc.code in (429, 529) or exc.code >= 500) and attempt < attempts:
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


def build_state(draws, pick_size=4):
    recent = list(reversed(draws))[:30]
    counter = Counter()
    for _, _, nums in draws:
        counter.update(nums)
    last_seen = {}
    for idx, (_, _, nums) in enumerate(draws):
        for num in nums:
            last_seen[num] = idx
    total = len(draws)
    missing = {n: total - 1 - last_seen.get(n, -1) for n in range(1, 81)}
    profiles = []
    for num in range(1, 81):
        profiles.append({"number": num, "frequency": counter.get(num, 0),
                         "recent30": sum(1 for _, _, ns in draws[-30:] if num in ns),
                         "current_missing": missing[num]})
    return {
        "schema_note": "以下均为快乐8历史开奖的统计特征，不含未来信息。",
        "game": "中国福利彩票快乐8（基诺型开奖）：号码范围 1 到 80，每期固定开出 20 个号码，各期开奖相互独立。",
        "play_mode": "选4：每注从 80 个号码中选 4 个，命中 2 个及以上即有奖。",
        "draws_used": total,
        "latest_issue_no": recent[0][0] if recent else "",
        "theoretical_single_number_probability": 0.25,
        "hot_numbers": sorted(range(1, 81), key=lambda k: -counter.get(k, 0))[:10],
        "cold_numbers": sorted(range(1, 81), key=lambda k: counter.get(k, 0))[:10],
        "top_missing": dict(sorted(missing.items(), key=lambda kv: -kv[1])[:20]),
        "recent_draws": [{"issue_no": i, "draw_date": d, "numbers": ns} for i, d, ns in recent],
        "number_profiles": profiles,
    }


# 单次 Choice 提问：让模型直接挑号码
choice_options = {str(n): "号码 %d" % n for n in range(1, 81)}
questions = {
    "predict_next": {
        "type": "choice",
        "instructions": ("根据 state 中的历史开奖统计，1 到 80 中哪一个号码最可能在下一期开奖的 20 个号码中出现？"
                         "各期开奖相互独立，理论基率为 0.25。"),
        "criteria": choice_options,
    }
}

draws = load_draws()
log("=" * 70)
log("Jev 单次 Choice 提问 —— 直接预测号码的检验")
log("=" * 70)
log("提问形态：单次 Choice，选项 1~80，取返回分布排名前 4 作为推荐")
log("对比基准：随机选 4 个，理论期望命中 1.00 / 4")
log("真实数据：%d 期（%s ~ %s）" % (len(draws), draws[0][0], draws[-1][0]))
log("")

start = len(draws) - ISSUES
hits = []
for idx in range(start, len(draws)):
    st = build_state(draws[:idx])
    actual = set(draws[idx][2])
    resp = jev(st, questions)
    node = resp.get("answers", {}).get("predict_next", {})
    probs = {k: float(v) for k, v in (node.get("probabilities") or {}).items()}
    ranked = sorted(probs, key=lambda k: (-probs[k], int(k) if str(k).isdigit() else 0))
    top4 = sorted(int(x) for x in ranked[:4]) if len(ranked) >= 4 else []
    chosen = node.get("choice")
    hit = len(set(top4) & actual)
    hits.append(hit)
    log("  期 %s: 单选=%s  分布前4=%s  实际开奖含其中 %d 个" % (draws[idx][0], chosen, top4, hit))
    log("       分布项数=%d  前4概率和=%.4f  最大概率=%.4f"
        % (len(probs), sum(probs[k] for k in ranked[:4]) if len(ranked) >= 4 else 0,
           max(probs.values()) if probs else 0))
    time.sleep(0.4)

mean_hit = sum(hits) / len(hits)
sd = math.sqrt(4 * 0.25 * 0.75 * (80 - 20) / (80 - 1.0))
se = sd / math.sqrt(len(hits))
z = (mean_hit - 1.0) / se
log("")
log("  Choice 形态 top4 平均命中 = %.2f / 4（随机期望 1.00）" % mean_hit)
log("  z = %+.2f（%.1f 期样本，标准误 %.3f）" % (z, len(hits), se))
log("")
log("=" * 70)
log("结论")
log("=" * 70)
if mean_hit <= 1.0 + 1.96 * se:
    log("单次 Choice 形态同样未优于随机选号。")
    log("「换个提问方式／直接让它预测」这条路径已被直接检验：无效。")
else:
    log("Choice 形态命中高于随机，需扩大样本复核是否为真实优势。")
out.flush()
