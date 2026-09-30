"""穷举检验：同样注数下，『号码不重复』是否真的最大化『至少一注达标』的概率。

做法：把号码集合限制在一个 u 元并集上，枚举所有可能的注结构（M 注、每注 4 个、并集恰好为 u），
对每个结构精确计算 P(至少一注命中 >= t)。因为只依赖并集内的命中分布，
外部 80-u 个号码的组合数用 C(80-u, 20-k) 加权，全程整数精确。
"""
import io
import sys
from itertools import combinations
from math import comb

sys.stdout = io.TextIOWrapper(open(sys.argv[1], "wb"), encoding="utf-8", newline="\n")

N, D, PICK = 80, 20, 4
TOTAL = comb(N, D)


def p_at_least(tickets, union_size, t):
    """tickets: 每注是并集内的索引元组。返回 P(至少一注命中 >= t 个)。"""
    blocks = [sum(1 << i for i in ticket) for ticket in tickets]
    good = 0
    for mask in range(1 << union_size):
        k = bin(mask).count("1")
        if k > D:
            continue
        rest = comb(N - union_size, D - k)
        if rest == 0:
            continue
        if any(bin(mask & block).count("1") >= t for block in blocks):
            good += rest
    return good / TOTAL


def search(m, union_size, t):
    """在 union_size 元并集上枚举 m 注的所有结构，返回最优结构与概率。"""
    subsets = [tuple(c) for c in combinations(range(union_size), PICK)]
    full = (1 << union_size) - 1
    best = (-1.0, None)
    seen = set()
    for combo in combinations(subsets, m):
        union = 0
        for s in combo:
            for i in s:
                union |= 1 << i
        if union != full:
            continue
        key = frozenset(frozenset(s) for s in combo)
        if key in seen:
            continue
        seen.add(key)
        p = p_at_least(combo, union_size, t)
        if p > best[0]:
            best = (p, combo)
    return best


print("=== 同样注数（成本相同）下，重叠 vs 不重复，哪个『至少中一注≥2』更高？ ===")
for m in (2, 3):
    print(f"\n-- {m} 注（成本 {2*m} 元）--")
    for u in range(PICK, PICK * m + 1):
        best = search(m, u, 2)
        if best[1] is None:
            continue
        tag = "完全互不重复" if u == PICK * m else f"并集仅 {u} 个号（有重叠）"
        print(f"  并集 {u:>2} 个号 [{tag:<16}] 最优 P(≥中2) = {best[0]:.4%}  结构={best[1]}")

print("\n=== 结论校验：M=2 时逐结构看一遍（并集=8 的不重复应当最高）===")
subsets = [tuple(c) for c in combinations(range(8), 4)]
rows = []
for combo in combinations(subsets, 2):
    union = set()
    for s in combo:
        union |= set(s)
    if len(union) != 8:
        continue
    key = frozenset(frozenset(s) for s in combo)
    rows.append((p_at_least(combo, 8, 2), combo))
# 只统计不重复配对
disjoint = [r for r in rows if set(r[1][0]).isdisjoint(set(r[1][1]))]
if disjoint:
    ps = [r[0] for r in disjoint]
    print(f"  并集=8 且互不重复的组合共 {len(disjoint)} 种，P(≥中2) 全部 = {ps[0]:.6%}（与配对无关，符合对称性）")
